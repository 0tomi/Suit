import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Button } from "../components/ui/Button";
import { Printer, FileText, Save } from 'lucide-react';
// import html2pdf from 'html2pdf.js'; // ELIMINADO: Usamos API nativa de Electron
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { useEntityDetail } from '../hooks/useEntityDetail.js';
import { useTabTitle } from '../hooks/useTabTitle.js';
import { getReportStyles } from '../utils/pdf/pdfStyleHelper';
import { useCaseSyncDown } from '../hooks/useCaseSyncDown.js';
import { useCases } from '../context/CasesContext';
import { useAuth } from '../context/AuthContext.jsx';
import { getCase, closeCase } from '../services/caseService.js';
import { getCaseReportData } from '../services/caseDetailService.js';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import { getApiErrorMessage } from '../utils/apiErrorMessage.js';
import CaseDetailHeader from '../components/cases/CaseDetailHeader';
import CaseDetailTabs from '../components/cases/CaseDetailTabs';
import { CASE_DETAIL_TAB_IDS } from '../components/cases/caseDetailTabsConfig.js';
import CaseDetailTabContent from '../components/cases/CaseDetailTabContent';
import { CaseReportView } from '../components/cases/CaseReportView';
import NewCaseForm from '../components/cases/NewCaseForm.jsx';
import { buildCaseCacheRow } from '../services/cache/caseCacheRow.js';

function normalizeCaseDetailTab(tabId) {
    return CASE_DETAIL_TAB_IDS.includes(tabId) ? tabId : 'overview';
}

function normalizeCaseDetailData(caseData) {
    return {
        ...caseData,
        linkedTipoExpedientes: caseData.linkedTipoExpedientes || [],
        linkedParticipants: caseData.linkedParticipants || [],
        linkedClients: caseData.linkedClients || [],
        linkedParties: caseData.linkedParties || [],
    };
}

const CaseDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(() => normalizeCaseDetailTab(location.state?.activeTab));
    
    // Soporte para atajos de salto de pestañas
    useEffect(() => {
        const handler = (e) => {
            const index = e.detail.index;
            if (CASE_DETAIL_TAB_IDS[index]) {
                setActiveTab(CASE_DETAIL_TAB_IDS[index]);
            }
        };
        window.addEventListener('app:tab-change', handler);
        return () => window.removeEventListener('app:tab-change', handler);
    }, []);

    // Estados para el reporte personalizado
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);

    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const { cases, updateItem } = useCases();
    const { user } = useAuth();
    
    // Estado para rastrear items nuevos detectados en el sync
    const [newItemsByEntity, setNewItemsByEntity] = useState({
        documents: new Set(),
        events: new Set(),
        multimedia: new Set(),
        archivos: new Set()
    });

    const markAsSeen = useCallback((entity, id) => {
        const numericId = Number(id);
        setNewItemsByEntity(prev => {
            if (!prev[entity]?.has(numericId)) return prev;
            const nextSet = new Set(prev[entity]);
            nextSet.delete(numericId);
            return { ...prev, [entity]: nextSet };
        });
    }, []);

    const {
        entity: caseData,
        loading,
        error,
        setEntity: setCaseData,
    } = useEntityDetail({
        id,
        items: cases,
        fetchById: getCase,
        initialEntity: location.state?.caseData || null,
        notFoundMessage: 'Caso no encontrado.',
        loadErrorMessage: 'Error al cargar caso.',
    });

    const { syncResult, syncing: caseSyncing, refresh: refreshCaseSync } = useCaseSyncDown(id);

    // Actualiza el label del tab con la carátula del caso cuando carga
    useTabTitle(caseData?.title);

    useEffect(() => {
        if (!syncResult?.changed) return;

        const syncedCase = syncResult.data.case;
        if (syncedCase) {
            const nextCase = normalizeCaseDetailData(syncedCase);
            setCaseData(nextCase);
            updateItem(nextCase.id, nextCase);
        }

        setNewItemsByEntity(prev => {
            const next = {
                documents: new Set(prev.documents),
                events: new Set(prev.events),
                multimedia: new Set(prev.multimedia),
                archivos: new Set(prev.archivos)
            };

            const data = syncResult.data;
            if (Array.isArray(data.documentos)) {
                data.documentos.forEach(d => d.is_new && next.documents.add(Number(d.id)));
            }
            if (Array.isArray(data.eventos)) {
                data.eventos.forEach(e => e.is_new && next.events.add(Number(e.id)));
            }
            if (Array.isArray(data.multimedia)) {
                data.multimedia.forEach(m => m.is_new && next.multimedia.add(Number(m.id)));
            }
            if (Array.isArray(data.archivos)) {
                data.archivos.forEach(a => a.is_new && next.archivos.add(Number(a.id)));
            }

            return next;
        });
    }, [setCaseData, syncResult, updateItem]);

    const isAdmin = user?.role === 'admin';
    if (loading) return <div className="flex justify-center items-center h-full p-8"><p className="text-(--text-secondary)">Cargando caso...</p></div>;
    if (error) return <div className="flex justify-center items-center h-full p-8"><p className="text-red-500">{error}</p></div>;
    if (!caseData) return <div className="flex justify-center items-center h-full p-8"><p className="text-(--text-secondary)">Caso no encontrado.</p></div>;

    const resolvedCaseData = normalizeCaseDetailData(caseData);
    const isOwner = Boolean(user?.tag && resolvedCaseData.owner_tag && String(user.tag) === String(resolvedCaseData.owner_tag));
    const hasWriteParticipantPermission = resolvedCaseData.linkedParticipants.some((participant) => {
        const participantTag = participant.user?.tag ?? participant.tag ?? participant.user_tag ?? null;
        if (!participantTag || !user?.tag || String(participantTag) !== String(user.tag)) {
            return false;
        }

        return ['write', 'admin', 'owner'].includes(String(participant.permission_level ?? participant.role ?? '').toLowerCase());
    });
    const canEditCase = isAdmin || isOwner || hasWriteParticipantPermission;

    const handleCloseCase = () => {
        openDialog({
            title: '¿Cerrar caso?',
            desc: 'Se marcará como Finalizado y se establecerá la fecha de fin hoy.',
            type: 'warning',
            confirmText: 'Sí, cerrar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await closeCase(caseData.id);
                    if (result.ok) {
                        const closedData = {
                            status: 'closed',
                            end_date: new Date().toISOString().split('T')[0]
                        };
                        // 1. Actualizar estado local (esta vista)
                        setCaseData((prev) => ({ ...prev, ...closedData }));
                        // 2. Actualizar contexto global (para la lista y navegación)
                        updateItem(caseData.id, closedData);
                        showAppToast({
                            title: 'Caso archivado correctamente',
                            description: resolvedCaseData.title || `Caso #${resolvedCaseData.id}`,
                            variant: 'success',
                        });
                        closeDialog();
                    } else {
                        closeDialog();
                        openDialog({
                            title: 'Error',
                            desc: getApiErrorMessage(result, 'Error al cerrar caso.'),
                            type: 'danger',
                            confirmText: 'Aceptar',
                            onConfirm: closeDialog,
                        });
                    }
                } catch {
                    closeDialog();
                    openDialog({
                        title: 'Error de Red',
                        desc: 'Ocurrió un error al contactar al servidor.',
                        type: 'danger',
                        confirmText: 'Aceptar',
                        onConfirm: closeDialog,
                    });
                }
            }
        });
    };

    const handleGenerateReport = async () => {
        setLoadingReport(true);
        try {
            const data = await getCaseReportData(caseData.id);
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
        } finally {
            setLoadingReport(false);
        }
    };

    const handlePrint = () => {
        window.print();
    };

    const handleDownloadPDF = async () => {
        const element = document.getElementById('case-report-content');
        if (!element) return;

        const reportTitle = `Ficha_Ejecutiva_${resolvedCaseData.id}_${resolvedCaseData.title.replace(/\s+/g, '_')}`;

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

    const handleCaseUpdated = async ({ case: updatedPayload, partialFailure = null } = {}) => {
        const updatedCase = updatedPayload?.case ?? updatedPayload?.data?.case ?? updatedPayload?.data ?? updatedPayload ?? null;
        if (!updatedCase?.id) {
            showAppToast({
                title: 'Caso actualizado',
                description: partialFailure?.message || 'Se guardaron los cambios del expediente.',
                variant: partialFailure ? 'warning' : 'success',
            });
            setIsEditModalOpen(false);
            return;
        }

        const nextCaseData = {
            ...resolvedCaseData,
            ...updatedCase,
            linkedTipoExpedientes: updatedCase.linkedTipoExpedientes ?? resolvedCaseData.linkedTipoExpedientes ?? [],
        };

        setCaseData(nextCaseData);
        updateItem(updatedCase.id, nextCaseData);

        if (window.electronAPI?.db?.upsertMany) {
            const row = buildCaseCacheRow(nextCaseData);
            if (row) {
                await window.electronAPI.db.upsertMany('cases', [row]);
            }
        }

        setIsEditModalOpen(false);
        showAppToast({
            title: partialFailure ? 'Caso actualizado con vínculos pendientes' : 'Caso actualizado',
            description: partialFailure?.message || nextCaseData.title || `Caso #${nextCaseData.id}`,
            variant: partialFailure ? 'warning' : 'success',
        });
    };

    /**
     * Al cerrar un QR de carga, re-ejecuta el sync del caso para incorporar
     * archivos/multimedia subidos desde el flujo móvil.
     */
    const handleCloseUploadQrModal = () => {
        refreshCaseSync();
    };

    return (
        <div className="w-full space-y-6 h-full flex flex-col max-w-[98%] mx-auto px-4">
            <CaseDetailHeader
                caseData={resolvedCaseData}
                onBack={() => navigate('/cases')}
                onCloseCase={handleCloseCase}
                onGenerateReport={handleGenerateReport}
                onEditCase={() => setIsEditModalOpen(true)}
                canEditCase={canEditCase}
                isLoadingReport={loadingReport}
            />
            <CaseDetailTabs
                activeTab={activeTab}
                onTabChange={setActiveTab}
                caseId={id}
                newItemsByEntity={newItemsByEntity}
            />
            <div className="flex-1 pb-10">
                <CaseDetailTabContent
                    activeTab={activeTab}
                    caseData={resolvedCaseData}
                    syncResult={syncResult}
                    caseSyncing={caseSyncing}
                    newItemsByEntity={newItemsByEntity}
                    onMarkAsSeen={markAsSeen}
                    onCloseUploadQrModal={handleCloseUploadQrModal}
                />
            </div>

            {/* Modal de Previsualización de Reporte */}
            <Modal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Editar Caso"
                subtitle="Actualizá la información del expediente y sus vínculos asociados."
                maxWidth="max-w-5xl"
                maxHeight="max-h-[95vh]"
                footer={
                    <div className="flex w-full justify-center">
                        <Button
                            type="submit"
                            form="new-case-form"
                            icon={Save}
                            className="px-8"
                        >
                            Guardar Cambios
                        </Button>
                    </div>
                }
            >
                <NewCaseForm
                    mode="edit"
                    initialCaseData={caseData}
                    onSuccess={handleCaseUpdated}
                />
            </Modal>

            <Modal
                open={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                title="Previsualización de Reporte"
                subtitle={`Ficha ejecutiva: ${resolvedCaseData.title}`}
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

            <ConfirmDialog {...dialogProps} />
        </div>
    );
};

export default CaseDetail;
