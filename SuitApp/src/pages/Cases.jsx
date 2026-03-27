import { useMemo, useEffect, useCallback } from 'react';
import { parseISO, formatISO } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeyAction } from '../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';
import { Plus, Printer, FileText, Briefcase } from 'lucide-react';
// import html2pdf from 'html2pdf.js'; // ELIMINADO: Usamos API nativa de Electron
import { getReportStyles } from '../utils/pdf/pdfStyleHelper';
import { useCases } from '../context/CasesContext';
import { useCaseTypes } from '../context/CaseTypesContext';
import { useEvents } from '../context/EventsContext.jsx';
import { closeCase, getClosedCases } from '../services/caseService.js';
import { getCaseReportData } from '../services/caseDetailService.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { useCasesPageState } from '../hooks/useCasesPageState.js';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PrimaryActionButton } from '../components/ui/PrimaryActionButton';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import NewCaseForm from '../components/cases/NewCaseForm';
import CasesFilterBar from '../components/cases/CasesFilterBar';
import CasesTable from '../components/cases/CasesTable';
import { CaseReportView } from '../components/cases/CaseReportView';
import { casosSteps } from '../constants/tutorialSteps.js';
import { buildCaseCacheRow } from '../services/cache/caseCacheRow.js';
import { createLogger } from '../services/logService.js';
import { getCaseStatusLabel } from '../utils/caseStatus.js';
import { usePageFocus } from '../hooks/usePageFocus.js';
import caseSyncService from '../services/sync/caseSyncService.js';

// ─── Persistencia de filtros en localStorage ─────────────────────────────────
const FILTER_STORAGE_KEY = 'cases-filter-state';
const logger = createLogger('cases-page');

function loadFilterState() {
    try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        void logger.warn('No se pudieron restaurar los filtros de casos', error);
        return null;
    }
}

function saveFilterState(state) {
    try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        void logger.warn('No se pudieron persistir los filtros de casos', error);
    }
}

// ─── Helpers de caché local ───────────────────────────────────────────────────
function normalizeCreatedCasePayload(payload) {
    if (!payload || typeof payload !== 'object') {
        return { createdCase: null, createdAgenda: null, casesLastModified: null, agendasLastModified: null };
    }

    const source = payload.data && typeof payload.data === 'object' ? payload.data : payload;
    const directCase = source?.id ? source : null;

    return {
        createdCase: source.case ?? source.suit_case ?? source.createdCase ?? directCase,
        createdAgenda: source.agenda ?? null,
        casesLastModified: source.cases_last_modified ?? null,
        agendasLastModified: source.agendas_last_modified ?? null,
    };
}

function buildAgendaRow(createdAgenda) {
    if (!createdAgenda?.id) return null;

    return {
        id: createdAgenda.id,
        name: createdAgenda.name,
        color: createdAgenda.color || null,
        suit_case_id: createdAgenda.suit_case_id || null,
        user_id: createdAgenda.user_id || null,
        data_json: JSON.stringify(createdAgenda),
        synced_at: formatISO(new Date()),
    };
}

async function cacheCreatedResources(payload) {
    if (!window.electronAPI) return;

    const { createdCase, createdAgenda, casesLastModified, agendasLastModified } = normalizeCreatedCasePayload(payload);
    if (!createdCase && !createdAgenda && !casesLastModified && !agendasLastModified) {
        return false;
    }

    const writes = [];

    const caseRow = buildCaseCacheRow(createdCase);
    if (caseRow) {
        writes.push(window.electronAPI.db.upsertMany('cases', [caseRow]));
    }

    const agendaRow = buildAgendaRow(createdAgenda);
    if (agendaRow) {
        writes.push(window.electronAPI.db.upsertMany('agendas', [agendaRow]));
    }

    if (casesLastModified) {
        writes.push(window.electronAPI.sync.setMeta('cases', formatISO(new Date()), casesLastModified));
    }

    if (agendasLastModified) {
        writes.push(window.electronAPI.sync.setMeta('agendas', formatISO(new Date()), agendasLastModified));
    }

    await Promise.all(writes);
    return true;
}

async function refreshLocalResources(loadCases, loadEvents) {
    await Promise.allSettled([
        loadCases(),
        loadEvents(),
    ]);
}

// ─── Helpers de ordenamiento ──────────────────────────────────────────────────
function sortCases(list, sortBy, sortOrder) {
    return [...list].sort((a, b) => {
        const aVal = a[sortBy] ? parseISO(String(a[sortBy]).replace(' ', 'T')).getTime() : 0;
        const bVal = b[sortBy] ? parseISO(String(b[sortBy]).replace(' ', 'T')).getTime() : 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
}

// ─── Defaults ─────────────────────────────────────────────────────────────────
const DEFAULT_FILTERS = {
    searchTerm: '',
    statusFilter: 'Activo',
    typeFilter: 'all',
    sortBy: 'updated_at',
    sortOrder: 'desc',
    showFinished: false,
};

// ─── Componente principal ─────────────────────────────────────────────────────
const Cases = () => {
    // Sincronizar al volver a la pestaña
    usePageFocus({ onFocus: caseSyncService.syncCases });

    const navigate = useNavigate();
    const location = useLocation();
    const { cases, refreshCases: refreshAll, loadLocalData: loadLocalCases } = useCases();
    const { case_types: caseTypes = [] } = useCaseTypes();
    const { loadLocalData: loadLocalEvents } = useEvents();

    // Restaurar filtros desde localStorage + todo el estado local de la página
    const savedFilters = loadFilterState() || {};
    const {
        searchTerm, setSearchTerm,
        statusFilter, setStatusFilter,
        typeFilter, setTypeFilter,
        sortBy, setSortBy,
        sortOrder, setSortOrder,
        closedCases, setClosedCases,
        loadingClosed, setLoadingClosed,
        closedLoaded, setClosedLoaded,
        isModalOpen, setIsModalOpen,
        reportModalOpen, setReportModalOpen,
        reportData, setReportData,
        activeReportCase, setActiveReportCase,
        isDownloading, setIsDownloading,
    } = useCasesPageState(savedFilters);

    // showFinished: derivado del filtro de estado
    const showFinished = statusFilter === 'Finalizado' || statusFilter === 'all';

    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    // Persistir filtros al cambiarlos
    useEffect(() => {
        saveFilterState({ searchTerm, statusFilter, typeFilter, sortBy, sortOrder });
    }, [searchTerm, statusFilter, typeFilter, sortBy, sortOrder]);

    // Manejar trigger global de nuevo caso
    useEffect(() => {
        if (location.state?.openNewCaseModal) {
            setIsModalOpen(true);
            // Limpiar estado
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname, setIsModalOpen]);

    // Hotkeys contextuales
    useHotkeyAction(HOTKEY_ACTIONS.NEW_CASE, () => setIsModalOpen(true));
    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => refreshAll());

    // Tipos disponibles desde CaseTypesContext (nombre de cada tipo)
    const caseTypeNames = useMemo(() => caseTypes.map(ct => ct.name).sort(), [caseTypes]);

    // Mapa ID → nombre para usarlo en el filtro de tipo
    const caseTypeIdByName = useMemo(() => {
        const map = {};
        for (const ct of caseTypes) map[ct.name] = String(ct.id);
        return map;
    }, [caseTypes]);

    // Carga de casos cerrados (lazy, con fallback offline desde caché)
    const loadClosedCases = useCallback(async () => {
        setLoadingClosed(true);
        setClosedLoaded(false);
        try {
            const result = await getClosedCases();
            if (result.ok && Array.isArray(result.data)) {
                setClosedCases(result.data);
                // Cachear en SQLite para fallback offline
                if (window.electronAPI && result.data.length > 0) {
                    const rows = result.data.map(buildCaseCacheRow).filter(Boolean);
                    await window.electronAPI.db.upsertMany('cases', rows);
                }
            } else {
                // Fallback offline: cargar cerrados que ya estén en caché
                if (window.electronAPI) {
                    const allLocal = await window.electronAPI.db.getAll('cases');
                    const closedLocal = (allLocal || []).filter(
                        c => c.status === 'closed' || c.end_date
                    );
                    setClosedCases(closedLocal);
                }
            }
        } catch (error) {
            void logger.warn('Fallo la carga remota de casos cerrados; usando cache local', error);
            // Fallback offline
            if (window.electronAPI) {
                const allLocal = await window.electronAPI.db.getAll('cases');
                const closedLocal = (allLocal || []).filter(
                    c => c.status === 'closed' || c.end_date
                );
                setClosedCases(closedLocal);
            }
        } finally {
            setLoadingClosed(false);
            setClosedLoaded(true);
        }
    }, [setClosedCases, setClosedLoaded, setLoadingClosed]);

    // Si el toggle arranca con showFinished=true (restaurado de localStorage), cargar automáticamente
    useEffect(() => {
        if (showFinished && !closedLoaded) {
            loadClosedCases();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Solo al montar

    const handleStatusChange = useCallback((value) => {
        setStatusFilter(value);
        const needsClosed = value === 'Finalizado' || value === 'all';
        if (needsClosed && !closedLoaded) {
            loadClosedCases();
        }
    }, [closedLoaded, loadClosedCases, setStatusFilter]);

    // Combinar activos + cerrados (evitar duplicados por ID)
    const allDisplayedCases = useMemo(() => {
        if (!showFinished) return cases;
        const activeIds = new Set(cases.map(c => c.id));
        const uniqueClosed = closedCases.filter(c => !activeIds.has(c.id));
        return [...cases, ...uniqueClosed];
    }, [cases, closedCases, showFinished]);

    const filteredAndSortedCases = useMemo(() => {
        const filtered = allDisplayedCases.filter(c => {
            const title = c.title || '';
            const ownerTag = c.owner_tag || '';
            const matchesSearch = title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                ownerTag.toLowerCase().includes(searchTerm.toLowerCase());

            const statusLabel = getCaseStatusLabel(c);
            const matchesStatus = statusFilter === 'all' || statusLabel === statusFilter;

            // Comparar por case_type_id (número) usando el mapa de nombre → id
            const matchesType = typeFilter === 'all'
                || String(c.case_type_id || '') === caseTypeIdByName[typeFilter];

            const matchesFinished = showFinished || statusLabel !== 'Finalizado';

            return matchesSearch && matchesStatus && matchesType && matchesFinished;
        });

        return sortCases(filtered, sortBy, sortOrder);
    }, [allDisplayedCases, searchTerm, statusFilter, typeFilter, caseTypeIdByName, showFinished, sortBy, sortOrder]);

    const handleClose = (caseItem, e) => {
        e.stopPropagation();
        openDialog({
            title: '¿Cerrar expediente?',
            desc: '¿Estás seguro de cerrar este expediente? Pasará a estado Finalizado.',
            type: 'warning',
            confirmText: 'Sí, cerrar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await closeCase(caseItem.id);
                    if (!result.ok) throw new Error(result.error || 'Error al cerrar caso.');

                    await refreshAll();
                    // Si tenemos casos cerrados cargados, también los refrescamos
                    if (closedLoaded) {
                        await loadClosedCases();
                    }
                    showAppToast({
                        title: 'Caso archivado correctamente',
                        description: caseItem.title || `Caso #${caseItem.id}`,
                        variant: 'success',
                    });
                    closeDialog();
                } catch (err) {
                    void logger.error('Error closing case', err);
                    closeDialog();
                    openDialog({
                        title: 'Error',
                        desc: err.message || 'Error al cerrar caso.',
                        type: 'danger',
                        confirmText: 'Aceptar',
                        onConfirm: closeDialog,
                    });
                }
            }
        });
    };

    const handleCaseCreated = async ({ title, case: createdPayload, partialFailure = null } = {}) => {
        setIsModalOpen(false);
        const toastTitle = partialFailure ? 'Caso creado con vínculos pendientes' : 'Caso creado';
        const toastDescription = partialFailure?.message || title || 'El expediente se creo correctamente.';
        const toastVariant = partialFailure ? 'warning' : 'success';
        const { createdCase } = normalizeCreatedCasePayload(createdPayload);
        const createdCaseId = createdCase?.id ?? null;

        if (!window.electronAPI) {
            await refreshAll();
            showAppToast({ title: toastTitle, description: toastDescription, variant: toastVariant });
            if (partialFailure && createdCaseId) {
                navigate(`/cases/${createdCaseId}`, { state: { caseData: createdCase || createdPayload } });
            }
            return;
        }

        try {
            const cacheUpdated = await cacheCreatedResources(createdPayload);
            if (!cacheUpdated) {
                await refreshAll();
                await loadLocalEvents();
                showAppToast({ title: toastTitle, description: toastDescription, variant: toastVariant });
                if (partialFailure && createdCaseId) {
                    navigate(`/cases/${createdCaseId}`, { state: { caseData: createdCase || createdPayload } });
                }
                return;
            }

            await refreshLocalResources(loadLocalCases, loadLocalEvents);
            showAppToast({ title: toastTitle, description: toastDescription, variant: toastVariant });
            if (partialFailure && createdCaseId) {
                navigate(`/cases/${createdCaseId}`, { state: { caseData: createdCase || createdPayload } });
            }
        } catch (err) {
            void logger.error('Error caching created case locally', err);
            await refreshAll();
            await loadLocalEvents();
            showAppToast({ title: toastTitle, description: toastDescription, variant: toastVariant });
            if (partialFailure && createdCaseId) {
                navigate(`/cases/${createdCaseId}`, { state: { caseData: createdCase || createdPayload } });
            }
        }
    };

    const handleGenerateReport = async (caseId, e) => {
        if (e) e.stopPropagation();
        const fullCaseData = allDisplayedCases.find(c => c.id === caseId);
        setActiveReportCase(fullCaseData);
        try {
            const data = await getCaseReportData(caseId);
            if (data) {
                setReportData(data);
                setReportModalOpen(true);
            } else {
                showAppToast({
                    title: 'Error',
                    description: 'No se pudo obtener la información completa del reporte.',
                    variant: 'danger',
                });
            }
        } catch (err) {
            console.error(err);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById('case-report-content');
        if (!element || !activeReportCase) return;

        const reportTitle = `Ficha_Ejecutiva_${activeReportCase.id}_${activeReportCase.title.replace(/\s+/g, '_')}`;

        setIsDownloading(true);
        showAppToast({
            title: 'Preparando Exportación',
            description: 'Elija la ubicación del archivo en el diálogo nativo...',
            variant: 'info',
        });

        try {
            // Recolectar estilos exhaustivamente (Tailwind, link, etc)
            const styles = getReportStyles();
            
            // Capturar HTML completo incluyendo el contenedor raíz y sus clases de Tailwind
            const html = element.outerHTML;

            const result = await window.electronAPI.documents.exportPdf({
                title: reportTitle,
                html: html,
                styles: styles
            });

            if (result.canceled) {
                showAppToast({
                    title: 'Descarga cancelada',
                    description: 'No se guardó el archivo.',
                    variant: 'info',
                });
                return;
            }

            if (result.filePath) {
                showAppToast({
                    title: 'PDF Exportado',
                    description: `Guardado en: ${result.filePath}`,
                    variant: 'success',
                });
            }
        } catch (error) {
            console.error('CRITICAL: Fallo en exportación nativa:', error);
            showAppToast({
                title: 'Fallo en la generación',
                description: `Error técnico: ${error.message || 'Error en proceso principal'}`,
                variant: 'danger',
            });
        } finally {
            setIsDownloading(false);
        }
    };

    return (
        <div className="space-y-6 relative">
            <div className="flex justify-between items-center">
                <div>
                    <h1 data-testid="page-cases-title" className="flex items-center gap-3 text-3xl font-bold text-(--text-primary)">
                        <span>Gestión de Casos</span>
                        <SectionTutorialTrigger
                            steps={casosSteps}
                            ariaLabel="Ver tutorial de Casos"
                            testId="cases-tutorial-trigger"
                        />
                    </h1>
                    <p className="text-(--text-secondary) mt-1">Administra tus expedientes y causas</p>
                </div>
                <PrimaryActionButton onClick={() => setIsModalOpen(true)} icon={Plus} label="Nuevo Caso" />
            </div>

            <Modal
                open={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Iniciar Nuevo Caso"
                subtitle="Completá la información básica para dar de alta el expediente del caso."
                maxWidth="max-w-5xl"
                maxHeight="max-h-[95vh]"
                footer={
                    <div className="flex w-full justify-center">
                        <Button
                            type="submit"
                            form="new-case-form"
                            icon={Briefcase}
                            className="px-8"
                        >
                            Crear Expediente
                        </Button>
                    </div>
                }
            >
                <NewCaseForm
                    onSuccess={handleCaseCreated}
                    onClose={() => setIsModalOpen(false)}
                    showFooter={false}
                />
            </Modal>

            {/* Modal de Previsualización de Reporte */}
            <Modal
                open={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                title="Previsualización de Reporte"
                subtitle={activeReportCase ? `Ficha ejecutiva: ${activeReportCase.title}` : ''}
                maxWidth="max-w-4xl"
                footer={(
                    <div className="flex justify-between w-full">
                        <Button variant="ghost" onClick={() => setReportModalOpen(false)}>
                            Cerrar
                        </Button>
                        <div className="flex gap-2">
                            <Button 
                                variant="outline" 
                                icon={Printer} 
                                onClick={handlePrint}
                                className="text-slate-600 border-slate-200 hover:bg-slate-50"
                            >
                                Imprimir Ficha
                            </Button>
                            <Button 
                                variant="primary" 
                                icon={FileText} 
                                onClick={handleDownloadPDF}
                                disabled={isDownloading}
                                className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            >
                                {isDownloading ? 'Generando Archivo...' : 'Generar PDF'}
                            </Button>
                        </div>
                    </div>
                )}
            >
                <CaseReportView data={reportData} />
            </Modal>

            <CasesFilterBar
                searchTerm={searchTerm}
                onSearchChange={setSearchTerm}
                statusFilter={statusFilter}
                onStatusChange={handleStatusChange}
                typeFilter={typeFilter}
                onTypeChange={setTypeFilter}
                sortBy={sortBy}
                onSortByChange={setSortBy}
                sortOrder={sortOrder}
                onSortOrderChange={setSortOrder}
                caseTypes={caseTypeNames}
                resultCount={searchTerm.length > 0 ? filteredAndSortedCases.length : undefined}
            />

            <CasesTable
                cases={filteredAndSortedCases}
                onNavigate={(c) => navigate(`/cases/${c.id}`, { state: { caseData: c } })}
                onClose={handleClose}
                onGenerateReport={handleGenerateReport}
                isLoading={loadingClosed}
                trigger={`${searchTerm}-${statusFilter}-${typeFilter}-${sortBy}-${sortOrder}`}
            />

            <ConfirmDialog {...dialogProps} />
        </div>
    );
};

export default Cases;
