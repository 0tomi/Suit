import { useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Button } from "../components/ui/Button";
import { Printer, FileText } from 'lucide-react';
// import html2pdf from 'html2pdf.js'; // ELIMINADO: Usamos API nativa de Electron
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { useEntityDetail } from '../hooks/useEntityDetail.js';
import { getReportStyles } from '../utils/pdf/pdfStyleHelper';
import { useCaseSyncDown } from '../hooks/useCaseSyncDown.js';
import { useCases } from '../context/CasesContext';
import { getCase, closeCase } from '../services/caseService.js';
import { getCaseReportData } from '../services/caseDetailService.js';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import { getApiErrorMessage } from '../utils/apiErrorMessage.js';
import CaseDetailHeader from '../components/cases/CaseDetailHeader';
import CaseDetailTabs from '../components/cases/CaseDetailTabs';
import { CASE_DETAIL_TAB_IDS } from '../components/cases/caseDetailTabsConfig.js';
import CaseDetailTabContent from '../components/cases/CaseDetailTabContent';
import { CaseReportView } from '../components/cases/CaseReportView';

function normalizeCaseDetailTab(tabId) {
    return CASE_DETAIL_TAB_IDS.includes(tabId) ? tabId : 'overview';
}

const CaseDetail = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const [activeTab, setActiveTab] = useState(() => normalizeCaseDetailTab(location.state?.activeTab));

    // Estados para el reporte personalizado
    const [reportModalOpen, setReportModalOpen] = useState(false);
    const [reportData, setReportData] = useState(null);
    const [loadingReport, setLoadingReport] = useState(false);
    const [isDownloading, setIsDownloading] = useState(false);

    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const { cases, updateItem } = useCases();
    // Dispara sync incremental al entrar al caso. syncResult se pasa a CaseDetailTabContent
    // para que los sub-recursos puedan refrescarse al detectar cambios.
    const { syncResult, syncing: caseSyncing } = useCaseSyncDown(id);

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

    if (loading) return <div className="flex justify-center items-center h-full p-8"><p className="text-(--text-secondary)">Cargando caso...</p></div>;
    if (error) return <div className="flex justify-center items-center h-full p-8"><p className="text-red-500">{error}</p></div>;
    if (!caseData) return <div className="flex justify-center items-center h-full p-8"><p className="text-(--text-secondary)">Caso no encontrado.</p></div>;

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
                            description: caseData.title || `Caso #${caseData.id}`,
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

        const reportTitle = `Ficha_Ejecutiva_${caseData.id}_${caseData.title.replace(/\s+/g, '_')}`;

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
        <div className="space-y-6 h-full flex flex-col max-w-6xl mx-auto">
            <CaseDetailHeader
                caseData={caseData}
                onBack={() => navigate('/cases')}
                onCloseCase={handleCloseCase}
                onGenerateReport={handleGenerateReport}
                isLoadingReport={loadingReport}
            />
            <CaseDetailTabs activeTab={activeTab} onTabChange={setActiveTab} />
            <div className="flex-1 pb-10">
                <CaseDetailTabContent
                    activeTab={activeTab}
                    caseData={caseData}
                    syncResult={syncResult}
                    caseSyncing={caseSyncing}
                />
            </div>

            {/* Modal de Previsualización de Reporte */}
            <Modal
                open={reportModalOpen}
                onClose={() => setReportModalOpen(false)}
                title="Previsualización de Reporte"
                subtitle={`Ficha ejecutiva: ${caseData.title}`}
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
