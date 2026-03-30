import { useMemo, useEffect, useCallback, useState, useRef } from 'react';
import { parseISO, formatISO } from 'date-fns';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeyAction } from '../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';
import { Plus, Printer, FileText, Briefcase } from 'lucide-react';
// import html2pdf from 'html2pdf.js'; // ELIMINADO: Usamos API nativa de Electron
import { getReportStyles } from '../utils/pdf/pdfStyleHelper';
import { useCaseTypes } from '../context/CaseTypesContext';
import { useEvents } from '../context/EventsContext.jsx';
import { closeCase } from '../services/caseService.js';
import { getCasesListingPage, invalidateCasesListingCache } from '../services/casesListingBackendService.js';
import { getCaseReportData } from '../services/caseDetailService.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { useCasesPageState } from '../hooks/useCasesPageState.js';
import { Button } from '../components/ui/Button';
import { Modal } from '../components/ui/Modal';
import { PrimaryActionButton } from '../components/ui/PrimaryActionButton';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import { Pagination } from '../components/ui/Pagination';
import NewCaseForm from '../components/cases/NewCaseForm';
import CasesFilterBar from '../components/cases/CasesFilterBar';
import CasesTable from '../components/cases/CasesTable';
import { CaseReportView } from '../components/cases/CaseReportView';
import { casosSteps } from '../constants/tutorialSteps.js';
import { buildCaseCacheRow } from '../services/cache/caseCacheRow.js';
import { createLogger } from '../services/logService.js';
import { usePageFocus } from '../hooks/usePageFocus.js';

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
};

const INITIAL_LISTING_STATE = {
    items: [],
    page: 1,
    total: 0,
    totalPages: 1,
    perPage: 40,
    source: 'cache',
    appliedLocalFilters: false,
};

function toBackendStatus(statusFilter) {
    if (statusFilter === 'Finalizado') return 'closed';
    if (statusFilter === 'Activo') return 'active';
    return 'all';
}

function normalizeCasesListingResponse(response) {
    const payload = response && typeof response === 'object' ? response : {};
    const items = Array.isArray(payload.items) ? payload.items : [];
    const total = Number(payload.total ?? payload.totalDocuments ?? items.length) || 0;
    const totalPages = Number(payload.totalPages ?? 1) || 1;
    const perPage = Number(payload.perPage ?? 40) || 40;

    return {
        items,
        page: Number(payload.page ?? 1) || 1,
        total,
        totalPages: Math.max(1, totalPages),
        perPage: Math.max(1, perPage),
        source: payload.source || 'cache',
        appliedLocalFilters: Boolean(payload.appliedLocalFilters),
    };
}

// ─── Componente principal ─────────────────────────────────────────────────────
const Cases = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { case_types: caseTypes = [] } = useCaseTypes();
    const { loadLocalData: loadLocalEvents } = useEvents();
    const listingRequestIdRef = useRef(0);
    const [listingState, setListingState] = useState(INITIAL_LISTING_STATE);
    const [listingLoading, setListingLoading] = useState(true);
    const [currentPage, setCurrentPage] = useState(1);

    // Restaurar filtros desde localStorage + todo el estado local de la página
    const savedFilters = loadFilterState() || {};
    const {
        searchTerm, setSearchTerm,
        statusFilter, setStatusFilter,
        typeFilter, setTypeFilter,
        sortBy, setSortBy,
        sortOrder, setSortOrder,
        isModalOpen, setIsModalOpen,
        reportModalOpen, setReportModalOpen,
        reportData, setReportData,
        activeReportCase, setActiveReportCase,
        isDownloading, setIsDownloading,
    } = useCasesPageState(savedFilters);

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

    // Tipos disponibles desde CaseTypesContext (nombre de cada tipo)
    const caseTypeNames = useMemo(() => caseTypes.map(ct => ct.name).sort(), [caseTypes]);

    // Mapa ID → nombre para usarlo en el filtro de tipo
    const caseTypeIdByName = useMemo(() => {
        const map = {};
        for (const ct of caseTypes) map[ct.name] = String(ct.id);
        return map;
    }, [caseTypes]);
    const backendListingFilters = useMemo(() => ({
        status: toBackendStatus(statusFilter),
        caseTypeId: typeFilter === 'all' ? null : Number(caseTypeIdByName[typeFilter] || 0) || null,
        sortBy,
        sortDirection: sortOrder,
    }), [caseTypeIdByName, sortBy, sortOrder, statusFilter, typeFilter]);
    const listingFiltersKey = useMemo(() => JSON.stringify(backendListingFilters), [backendListingFilters]);
    const listingFiltersKeyRef = useRef(listingFiltersKey);

    const refreshCasesListing = useCallback(async ({ invalidate = false, page = currentPage } = {}) => {
        const requestId = ++listingRequestIdRef.current;
        setListingLoading(true);

        try {
            if (invalidate) {
                await invalidateCasesListingCache();
            }

            const response = await getCasesListingPage({
                page,
                filters: backendListingFilters,
            });

            if (listingRequestIdRef.current !== requestId) return;

            const normalized = normalizeCasesListingResponse(response);
            setListingState(normalized);
            if (normalized.page !== page) {
                setCurrentPage(normalized.page);
            }
        } catch (error) {
            if (listingRequestIdRef.current !== requestId) return;
            void logger.error('No se pudo cargar el listado de casos', {
                error: error?.message || String(error),
                page,
                filters: backendListingFilters,
            });
        } finally {
            if (listingRequestIdRef.current === requestId) {
                setListingLoading(false);
            }
        }
    }, [backendListingFilters, currentPage]);

    usePageFocus({
        onFocus: () => {
            void refreshCasesListing({ page: currentPage });
        },
    });

    // Hotkeys contextuales
    useHotkeyAction(HOTKEY_ACTIONS.NEW_CASE, () => setIsModalOpen(true));
    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => {
        void refreshCasesListing({ invalidate: true, page: currentPage });
    });

    useEffect(() => {
        if (listingFiltersKeyRef.current !== listingFiltersKey) {
            listingFiltersKeyRef.current = listingFiltersKey;
            if (currentPage !== 1) {
                setCurrentPage(1);
                return;
            }
        }

        void refreshCasesListing({ page: currentPage });
    }, [currentPage, listingFiltersKey, refreshCasesListing]);

    const visibleCases = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        const filtered = search
            ? listingState.items.filter((caseItem) => {
                const title = String(caseItem?.title || '').toLowerCase();
                const ownerTag = String(caseItem?.owner_tag || '').toLowerCase();
                return title.includes(search) || ownerTag.includes(search);
            })
            : listingState.items;

        return sortCases(filtered, sortBy, sortOrder);
    }, [listingState.items, searchTerm, sortBy, sortOrder]);

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

                    await refreshCasesListing({ invalidate: true, page: currentPage });
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
                } finally {
                    setDialogLoading(false);
                }
            },
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
            await refreshCasesListing({ invalidate: true, page: currentPage });
            showAppToast({ title: toastTitle, description: toastDescription, variant: toastVariant });
            if (partialFailure && createdCaseId) {
                navigate(`/cases/${createdCaseId}`, { state: { caseData: createdCase || createdPayload } });
            }
            return;
        }

        try {
            const cacheUpdated = await cacheCreatedResources(createdPayload);
            if (!cacheUpdated) {
                await refreshCasesListing({ invalidate: true, page: currentPage });
                await loadLocalEvents();
                showAppToast({ title: toastTitle, description: toastDescription, variant: toastVariant });
                if (partialFailure && createdCaseId) {
                    navigate(`/cases/${createdCaseId}`, { state: { caseData: createdCase || createdPayload } });
                }
                return;
            }

            await refreshCasesListing({ invalidate: true, page: currentPage });
            await loadLocalEvents();
            showAppToast({ title: toastTitle, description: toastDescription, variant: toastVariant });
            if (partialFailure && createdCaseId) {
                navigate(`/cases/${createdCaseId}`, { state: { caseData: createdCase || createdPayload } });
            }
        } catch (err) {
            void logger.error('Error caching created case locally', err);
            await refreshCasesListing({ invalidate: true, page: currentPage });
            await loadLocalEvents();
            showAppToast({ title: toastTitle, description: toastDescription, variant: toastVariant });
            if (partialFailure && createdCaseId) {
                navigate(`/cases/${createdCaseId}`, { state: { caseData: createdCase || createdPayload } });
            }
        }
    };

    const handleGenerateReport = async (caseId, e) => {
        if (e) e.stopPropagation();
        const fullCaseData = visibleCases.find((c) => c.id === caseId);
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
                onStatusChange={(value) => {
                    setStatusFilter(value);
                    setCurrentPage(1);
                }}
                typeFilter={typeFilter}
                onTypeChange={(value) => {
                    setTypeFilter(value);
                    setCurrentPage(1);
                }}
                sortBy={sortBy}
                onSortByChange={(value) => {
                    setSortBy(value);
                    setCurrentPage(1);
                }}
                sortOrder={sortOrder}
                onSortOrderChange={(value) => {
                    setSortOrder(value);
                    setCurrentPage(1);
                }}
                caseTypes={caseTypeNames}
                resultCount={searchTerm.length > 0 ? visibleCases.length : undefined}
            />

            <Pagination
                totalItems={listingState.total}
                itemsPerPage={listingState.perPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                className="rounded-xl border border-(--border-subtle) shadow-sm border-t-0"
            />

            <CasesTable
                cases={visibleCases}
                onNavigate={(c) => navigate(`/cases/${c.id}`, { state: { caseData: c } })}
                onClose={handleClose}
                onGenerateReport={handleGenerateReport}
                isLoading={listingLoading}
                trigger={`${searchTerm}-${statusFilter}-${typeFilter}-${sortBy}-${sortOrder}-${currentPage}-${listingState.source}`}
            />

            <ConfirmDialog {...dialogProps} />
        </div>
    );
};

export default Cases;
