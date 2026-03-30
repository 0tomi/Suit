import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import { buildPrintPageCss, normalizeMargins } from '../components/Editor/marginsUtils.js';
import { buildDocumentEditPath } from '../utils/appRoutes.js';
import { createLogger } from '../services/logService.js';

const logger = createLogger('hook:use-document-action-controls');

const INITIAL_DOCUMENT_MODAL_STATE = {
    settingsOpen: false,
    detailsOpen: false,
    selectedDoc: null,
};

/**
 * Centraliza acciones UI de documentos reutilizables entre listados:
 * abrir detalle/propiedades, navegar al editor y exportar PDF.
 */
export function useDocumentActionControls({
    onDocumentUpdated,
} = {}) {
    const navigate = useNavigate();
    const [exportingDocId, setExportingDocId] = useState(null);
    const [modalState, setModalState] = useState(INITIAL_DOCUMENT_MODAL_STATE);

    const openSettingsModal = useCallback((doc) => {
        setModalState({ settingsOpen: true, detailsOpen: false, selectedDoc: doc || null });
    }, []);

    const openDetailsModal = useCallback((doc) => {
        setModalState({ settingsOpen: false, detailsOpen: true, selectedDoc: doc || null });
    }, []);

    const closeSettingsModal = useCallback(() => {
        setModalState((current) => ({ ...current, settingsOpen: false, selectedDoc: null }));
    }, []);

    const closeDetailsModal = useCallback(() => {
        setModalState((current) => ({ ...current, detailsOpen: false, selectedDoc: null }));
    }, []);

    const openDocumentEditor = useCallback((documentId) => {
        navigate(buildDocumentEditPath(documentId));
    }, [navigate]);

    const handleExportPdf = useCallback(async (doc) => {
        if (!doc) return;
        if (typeof window === 'undefined' || typeof window.electronAPI?.documents?.exportPdf !== 'function') {
            showAppToast({
                title: 'Exportación no disponible',
                description: 'La exportación a PDF solo está disponible en Electron.',
                variant: 'danger',
            });
            return;
        }

        setExportingDocId(doc.id);
        try {
            const [
                { getDocumentContent },
                { getReportStyles },
            ] = await Promise.all([
                import('../services/documentService.js'),
                import('../utils/pdf/pdfStyleHelper.js'),
            ]);
            const content = await getDocumentContent(doc.id);

            if (!content) {
                throw new Error('No se pudo obtener el contenido del documento.');
            }

            const styles = getReportStyles();
            const resolvedMargins = normalizeMargins(doc?.margins || null);
            const wrappedHtml = `
                <div class="prose prose-base max-w-none bg-white export-document" style="box-sizing: border-box; width: 100%; min-height: auto; margin: 0 auto;">
                    ${content}
                </div>
            `;

            const result = await window.electronAPI.documents.exportPdf({
                title: doc.name || doc.title || `documento-${doc.id}`,
                html: wrappedHtml,
                styles: `${styles}\n${buildPrintPageCss(resolvedMargins)}\n.export-document { width: 100%; max-width: none; }`,
            });

            if (result?.canceled) return;
            if (result?.error) throw new Error(result.error);

            const pathHelper = result?.filePath || '';
            const fileName = pathHelper.split(/[\\/]/).pop() || 'documento.pdf';
            showAppToast({
                title: 'PDF exportado',
                description: `Se generó "${fileName}".`,
                variant: 'success',
            });
        } catch (error) {
            void logger.error('Error exportando PDF desde listado', error);
            showAppToast({
                title: 'Error al exportar',
                description: error.message || 'No se pudo generar el PDF.',
                variant: 'danger',
            });
        } finally {
            setExportingDocId(null);
        }
    }, []);

    const applyDocumentUpdate = useCallback((updatedDoc) => {
        setModalState((current) => (
            current.selectedDoc?.id === updatedDoc?.id
                ? { ...current, selectedDoc: { ...current.selectedDoc, ...updatedDoc } }
                : current
        ));
        onDocumentUpdated?.(updatedDoc);
    }, [onDocumentUpdated]);

    return {
        modalState,
        exportingDocId,
        openSettingsModal,
        openDetailsModal,
        closeSettingsModal,
        closeDetailsModal,
        openDocumentEditor,
        handleExportPdf,
        applyDocumentUpdate,
    };
}
