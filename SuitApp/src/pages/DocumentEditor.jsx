import { useCallback, useEffect, useRef, useState } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import TiptapEditor from '../components/Editor/TiptapEditor';
import MarginsModal from '../components/Editor/MarginsModal.jsx';
import { loadMarginPreference, DEFAULT_MARGINS, buildPrintPageCss, normalizeMargins } from '../components/Editor/marginsUtils.js';
import DocumentEditorAlerts from '../components/Editor/DocumentEditorAlerts.jsx';
import DocumentEditorHeader from '../components/Editor/DocumentEditorHeader.jsx';
import DraftingToolsSidebar from '../components/Editor/DraftingToolsSidebar.jsx';
import DocumentSettingsModal from '../components/DocumentSettingsModal';
import { useDocuments } from '../context/DocumentsContext';
import { useAuth } from '../context/AuthContext';
import { useDocumentLoader } from '../hooks/useDocumentLoader.js';
import { useDocumentLock } from '../hooks/useDocumentLock.js';
import { createDocument, updateDocument, deleteDocument, getDocumentLastModified, getDocumentLockStatus } from '../services/documentService.js';
import { invalidateDocumentListingCache } from '../services/documentListingBackendService.js';
import { getTemplate } from '../services/templateService.js';
import { buildDocumentEditPath } from '../utils/appRoutes.js';
import { normalizeDocumentPayload } from '../utils/documentUtils.js';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js';
import { useDocumentEditorUIState } from '../hooks/useDocumentEditorUIState.js';
import { useTabTitle } from '../hooks/useTabTitle.js';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import useAutosave from '../hooks/useAutosave.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import { createLogger } from '../services/logService.js';
import { getDocumentVersionContentCached } from '../services/documentVersionCacheService.js';
const logger = createLogger('page:document-editor');


const getElectronDB = () => {
    if (typeof window === 'undefined') return null;
    return window.electronAPI?.db || null;
};

const getFileNameFromPath = (value) => {
    if (!value) return '';
    return String(value).split(/[\\/]/).pop() || '';
};

function resolveVersionNumber(searchParams, fallbackMeta = null) {
    const rawVersionNumber = searchParams.get('versionNumber');
    if (rawVersionNumber) return rawVersionNumber;
    return fallbackMeta?.version_number ?? fallbackMeta?.number ?? fallbackMeta?.version ?? null;
}

function sanitizeNavigationState(state) {
    if (!state || typeof state !== 'object') return undefined;
    const returnTo = state.returnTo;
    if (!returnTo?.pathname) return undefined;
    return {
        returnTo: {
            pathname: returnTo.pathname,
            state: returnTo.state?.activeTab ? { activeTab: returnTo.state.activeTab } : undefined,
        },
    };
}

function buildSaveFailureCacheMeta(currentMeta, message) {
    return {
        ...(currentMeta || {}),
        pending_local_save: true,
        pending_local_save_error: message,
        pending_local_save_at: new Date().toISOString(),
    };
}

function buildSuccessfulSaveMeta({ currentMeta, responsePayload, documentId, title }) {
    const normalizedPayload = normalizeDocumentPayload(responsePayload) || null;
    const isVersionPayload = Number(normalizedPayload?.document_id) === Number(documentId);

    if (isVersionPayload) {
        return {
            ...(currentMeta || {}),
            id: Number(documentId),
            name: currentMeta?.name || currentMeta?.title || title,
            title: currentMeta?.title || currentMeta?.name || title,
            updated_at: normalizedPayload.created_at || currentMeta?.updated_at || null,
            latest_version_number: normalizedPayload.version_number ?? currentMeta?.latest_version_number ?? null,
            pending_local_save: false,
            pending_local_save_error: null,
            pending_local_save_at: null,
        };
    }

    return {
        ...(normalizedPayload || currentMeta || {}),
        id: Number(documentId),
        pending_local_save: false,
        pending_local_save_error: null,
        pending_local_save_at: null,
    };
}

function isRemoteTimestampNewer(remoteUpdatedAt, localUpdatedAt) {
    if (!remoteUpdatedAt) return false;
    if (!localUpdatedAt) return true;

    const remoteTime = new Date(remoteUpdatedAt).getTime();
    const localTime = new Date(localUpdatedAt).getTime();

    if (!Number.isFinite(remoteTime) || !Number.isFinite(localTime)) {
        return remoteUpdatedAt !== localUpdatedAt;
    }

    return remoteTime > localTime;
}

function getEditorToastTitle(message) {
    const text = String(message?.text || '').toLowerCase();

    if (text.includes('guardado')) {
        return message?.type === 'success' ? 'Documento guardado' : 'Error al guardar';
    }

    if (text.includes('creado')) {
        return message?.type === 'success' ? 'Documento creado' : 'Error al crear';
    }

    if (text.includes('modelo')) {
        return message?.type === 'success' ? 'Modelo cargado' : 'Error al cargar modelo';
    }

    if (text.includes('versión')) {
        return message?.type === 'success' ? 'Versión cargada' : 'Error de versión';
    }

    return message?.type === 'success' ? 'Documento' : 'Error en documento';
}

function DocumentEditorContent({ id, db, templateId, versionId, versionNumberParam, initialCaseId }) {
    const navigate = useNavigate();
    const location = useLocation();
    // Captura el estado inicial de navegación una sola vez para el efecto de carga de plantilla.
    // Usar un ref evita que el efecto se re-ejecute si location cambia después del montaje.
    const initialLocationStateRef = useRef(location.state);
    const initialPrefill = initialLocationStateRef.current;
    const hasInitialPrefillContent = initialPrefill != null && 'prefillContent' in initialPrefill;
    const initialPrefillContent = hasInitialPrefillContent
        ? (typeof initialPrefill.prefillContent === 'string' ? initialPrefill.prefillContent : '')
        : undefined;
    const initialPrefillTitle = typeof initialPrefill?.prefillTitle === 'string'
        ? initialPrefill.prefillTitle
        : '';
    const defaultFont = typeof initialPrefill?.defaultFont === 'string'
        ? initialPrefill.defaultFont
        : null;
    const { documents, refreshDocuments: refreshAll } = useDocuments();
    const { user } = useAuth();

    const {
        isSaving, isExportingPdf, settingsOpen, isVersionLoading, versionMeta, isDirty,
        setIsSaving, setIsExportingPdf, setSettingsOpen, setIsDirty,
        loadVersionSuccess, loadVersionFail,
        startVersionLoad, clearVersionMeta, clearDirty,
    } = useDocumentEditorUIState();

    const {
        title,
        setTitle,
        content,
        setContent,
        docMeta,
        setDocMeta,
        isLoading,
        saveMessage,
        setSaveMessage,
        refreshDocument,
        upsertDocumentCache,
    } = useDocumentLoader({
        id,
        db,
        documents,
        initialTitle: initialPrefillTitle,
        initialContent: initialPrefillContent,
    });

    // Actualiza el label del tab con el nombre del documento (o label genérico si es nuevo)
    useTabTitle(title || (id ? 'Cargando...' : 'Nuevo documento'));

    const syncMetadataAfterLock = useCallback(async () => {
        if (!id) return;

        const remoteMetadata = await getDocumentLastModified(id);
        const remoteUpdatedAt = remoteMetadata?.last_modified ?? null;

        if (!remoteUpdatedAt) {
            void logger.warn('document lock acquired without remote last-modified timestamp', { documentId: id });
            return;
        }

        if (isRemoteTimestampNewer(remoteUpdatedAt, docMeta?.updated_at)) {
            await refreshDocument();
            setSaveMessage({
                type: 'success',
                text: 'El documento se actualizó con la última versión antes de habilitar la edición.',
            });
        }
    }, [docMeta, id, refreshDocument, setSaveMessage]);

    const {
        isEditing,
        isCheckingEdit,
        isLockedByOther,
        lockerName,
        enableEdit,
        exitEditMode,
    } = useDocumentLock({
        id,
        setSaveMessage,
        onLockAcquired: syncMetadataAfterLock,
    });

    const isViewingHistoricalVersion = Boolean(id && versionId);

    useEffect(() => {
        if (!saveMessage?.text) return;

        showAppToast({
            title: getEditorToastTitle(saveMessage),
            description: saveMessage.text,
            variant: saveMessage.type === 'success' ? 'success' : 'danger',
        });
    }, [saveMessage]);

    useEffect(() => {
        if (!id || !versionId) {
            clearVersionMeta();
            return;
        }

        let cancelled = false;

        const loadHistoricalVersion = async () => {
            // Conservamos la metadata del documento actual y solo sustituimos el HTML
            // para abrir una versión puntual sin convertirla en la última hasta guardar.
            startVersionLoad();
            try {
                const historicalContent = await getDocumentVersionContentCached(id, versionId, {
                    id: versionId,
                    document_id: id,
                    version_number: versionNumberParam,
                });

                if (cancelled) return;

                if (typeof historicalContent === 'string') {
                    setContent(historicalContent);
                    // Batchea isVersionLoading=false + isDirty=false + versionMeta en un dispatch.
                    loadVersionSuccess({ id: versionId, version_number: versionNumberParam });
                    setSaveMessage({
                        type: 'success',
                        text: `Visualizando la versión ${versionNumberParam ? `v${versionNumberParam}` : 'histórica'} en modo lectura.`,
                    });
                    return;
                }

                // Batchea isVersionLoading=false + versionMeta=null.
                loadVersionFail();
                setSaveMessage({
                    type: 'error',
                    text: 'No se pudo obtener el contenido de la versión seleccionada.',
                });
            } catch {
                if (!cancelled) {
                    loadVersionFail();
                    setSaveMessage({
                        type: 'error',
                        text: 'No se pudo cargar la versión seleccionada.',
                    });
                }
            }
        };

        void loadHistoricalVersion();

        return () => {
            cancelled = true;
        };
    }, [id, setContent, setSaveMessage, versionId, versionNumberParam, clearVersionMeta, loadVersionFail, loadVersionSuccess, startVersionLoad]);

    // Autoguardado local (SQLite): preserva el contenido sin llamar a la API
    // para no crear versiones nuevas en cada keystroke.
    // El guardado real (API) sigue siendo manual via el botón "Guardar".
    const handleLocalSave = async () => {
        if (!id || !isEditing) return;
        try {
            await upsertDocumentCache(Number(id), content);
        } catch (err) {
            void logger.warn('Autoguardado local falló', err);
        }
    };

    const { lastAutoSavedAt } = useAutosave({
        isEditing,
        isDirty,
        hasId: Boolean(id),
        content,
        onSave: handleLocalSave,
    });

    useEffect(() => {
        if (id || !templateId) return undefined;

        // Si el usuario llegó desde UseTemplateModal con contenido ya rellenado,
        // usarlo directamente sin volver a llamar a la API.
        const prefill = initialLocationStateRef.current;
        // Verificar con 'in' en vez de truthiness para manejar el caso de contenido vacío ('')
        // que ocurre con "Cargar sin rellenar" (getEmptyTemplate devuelve HTML sin placeholders).
        if (prefill != null && 'prefillContent' in prefill) {
            setContent(prefill.prefillContent ?? '');
            if (prefill.prefillTitle) setTitle(prefill.prefillTitle);
            clearDirty();
            setSaveMessage({ type: 'success', text: 'Modelo aplicado correctamente.' });
            return undefined;
        }

        let cancelled = false;

        const loadTemplate = async () => {
            try {
                const template = await getTemplate(templateId);
                if (cancelled || !template) return;

                const templateTitle = typeof template.title === 'string' ? template.title : '';
                const templateContent = typeof template.content === 'string' ? template.content : '';

                if (templateTitle) {
                    setTitle(templateTitle);
                }

                if (templateContent) {
                    setContent(templateContent);
                    clearDirty();
                    setSaveMessage({ type: 'success', text: 'Modelo cargado correctamente.' });
                }
            } catch (error) {
                if (!cancelled) {
                    setSaveMessage({ type: 'error', text: `No se pudo cargar el modelo: ${error.message}` });
                }
            }
        };

        void loadTemplate();

        return () => {
            cancelled = true;
        };
    }, [id, setContent, setSaveMessage, setTitle, templateId, clearDirty]);

    // Documento nuevo sin título ni contenido: no vale la pena advertir sobre cambios sin guardar.
    const isPristineNewDraft = !id
        && !title.trim()
        && (content === '' || content?.trim() === '' || content === '<p></p>');

    const { dialogProps: unsavedDialogProps } = useUnsavedChanges(isDirty && !isPristineNewDraft, {
        title: 'Cambios sin guardar',
        desc: 'Tienes cambios sin guardar en este documento. Si sales ahora, se perderán.',
        confirmText: 'Salir sin guardar',
        cancelText: 'Continuar editando'
    });
    const {
        dialogProps: deleteDialogProps,
        openDialog,
        closeDialog,
        setDialogLoading,
    } = useConfirmDialog();

    // Márgenes: heredar de la plantilla si viene de UseTemplateModal (prefillMargins),
    // o cargar la preferencia guardada del usuario, o usar el default de 1 pulgada.
    const [margins, setMargins] = useState(() => {
        const prefill = initialLocationStateRef.current;
        if (prefill?.prefillMargins) return normalizeMargins(prefill.prefillMargins);
        return loadMarginPreference(user?.id) || null;
    });
    const [isMarginsModalOpen, setIsMarginsModalOpen] = useState(false);
    const [marginsModalContext, setMarginsModalContext] = useState({ indentLevel: 0, onIndentChange: null });

    // Ref al editor TipTap: permite obtener el HTML más fresco al guardar/exportar
    // sin depender del estado React que puede estar desactualizado por el debounce de 300ms.
    const editorRef = useRef(null);

    // Estabiliza la referencia del callback para que React.memo en TiptapEditor no pierda
    // la comparación y rerenderice el canvas completo en cada tecla presionada.
    const handleOpenMarginsModal = useCallback((context) => {
        setMarginsModalContext({
            indentLevel: context?.indentLevel ?? 0,
            onIndentChange: context?.onIndentChange ?? null,
        });
        setIsMarginsModalOpen(true);
    }, []);

    // Memoizado para que React.memo en TiptapEditor no re-renderice por referencia nueva en cada render.
    // Se usa forma funcional en setIsDirty para eliminar isDirty de las deps: así el callback es estable
    // toda la sesión de edición y TiptapEditor no recibe una nueva referencia de onChange al primer keystroke.
    const handleEditorChange = useCallback((newContent) => {
        setContent(newContent);
        if (id && !isEditing) return;
        setIsDirty((prev) => prev || true);
    }, [id, isEditing, setContent, setIsDirty]);

    const canDeleteDocument = Boolean(id) && Boolean(user?.role && user.role !== 'user');
    const deleteDisabled = isEditing || isLockedByOther;
    const safeNavigationState = sanitizeNavigationState(location.state);
    const returnTo = safeNavigationState?.returnTo || null;

    useEffect(() => {
        if (id || initialCaseId == null) return;

        setDocMeta((previous) => {
            const currentCaseId = previous?.suit_case_id;
            if (currentCaseId !== null && currentCaseId !== undefined && currentCaseId !== '') {
                return previous;
            }
            return { ...(previous || {}), suit_case_id: initialCaseId };
        });
    }, [id, initialCaseId, setDocMeta]);

    const navigateBack = () => {
        // isPristineNewDraft se computa arriba (junto al useUnsavedChanges) para compartir la lógica.
        if (isPristineNewDraft && isDirty) {
            flushSync(() => {
                setIsDirty(false);
            });
        }

        if (returnTo?.pathname) {
            try {
                navigate(returnTo.pathname, returnTo.state ? { state: returnTo.state } : undefined);
            } catch (error) {
                void logger.warn('fallback navigation without state after back action', error);
                navigate(returnTo.pathname);
            }
            return;
        }

        const historyIndex = typeof window !== 'undefined'
            ? Number(window.history?.state?.idx ?? -1)
            : -1;
        if (Number.isFinite(historyIndex) && historyIndex > 0) {
            navigate(-1);
            return;
        }

        navigate('/documents');
    };

    const getDeleteDocumentErrorMessage = (result) => {
        if (result?.status === 403) return 'No tienes permisos para eliminar este documento.';
        if (result?.status === 409) return 'No se puede eliminar un documento bloqueado.';
        if (result?.status === 422) return result?.data?.message || 'No se pudo eliminar el documento.';
        return result?.data?.message || result?.error || 'Error al eliminar documento.';
    };

    const requestDeleteDocument = () => {
        if (!id) return;

        if (deleteDisabled) {
            showAppToast({
                title: 'Documento bloqueado',
                description: 'No se puede eliminar un documento en uso.',
                variant: 'warning',
            });
            return;
        }

        openDialog({
            title: '¿Eliminar documento?',
            desc: `Se eliminará permanentemente "${title || `Documento #${id}`}" y todas sus versiones.`,
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const lockStatus = await getDocumentLockStatus(id);
                    if (lockStatus.ok && lockStatus.is_locked) {
                        showAppToast({
                            title: 'Documento bloqueado',
                            description: 'No se puede eliminar un documento en uso.',
                            variant: 'warning',
                        });
                        await refreshAll();
                        closeDialog();
                        return;
                    }

                    const result = await deleteDocument(id);
                    if (!result.ok) {
                        throw new Error(getDeleteDocumentErrorMessage(result));
                    }

                    if (window.electronAPI?.db?.deleteById) {
                        try {
                            await window.electronAPI.db.deleteById('documents', Number(id));
                        } catch (error) {
                            void logger.warn('no se pudo eliminar documento de caché local', error);
                        }
                    }

                    await invalidateDocumentListingCache();
                    await refreshAll();
                    showAppToast({
                        title: 'Documento eliminado',
                        description: `${title || `Documento #${id}`} eliminado correctamente.`,
                        variant: 'success',
                    });
                    closeDialog();
                    setSettingsOpen(false);
                    navigate('/documents', { replace: true });
                } catch (error) {
                    showAppToast({
                        title: 'Error al eliminar',
                        description: error.message || 'No se pudo eliminar el documento.',
                        variant: 'danger',
                    });
                } finally {
                    setDialogLoading(false);
                }
            },
        });
    };

    const handleSave = async () => {
        if (isSaving || isLockedByOther || (id && !isEditing)) return;
        if (!id) {
            setSettingsOpen(true);
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);

        // Usa el HTML más fresco del editor (evita guardar contenido stale del debounce).
        const latestContent = editorRef.current?.getLatestContent() ?? content;

        try {
            const result = await updateDocument(id, { content: latestContent });

            if (result.ok) {
                let savedMeta = null;
                try {
                    savedMeta = buildSuccessfulSaveMeta({
                        currentMeta: docMeta,
                        responsePayload: result.data,
                        documentId: id,
                        title,
                    });
                    // Sanitizar meta para evitar persistir campos extraños de la API (como event_id)
                    const sanitized = {
                        id: Number(id),
                        name: savedMeta.name || savedMeta.title || title,
                        title: savedMeta.title || savedMeta.name || title,
                        status: savedMeta.status || docMeta?.status || 'Borrador',
                        suit_case_id: savedMeta.suit_case_id || docMeta?.suit_case_id,
                        updated_at: savedMeta.updated_at || docMeta?.updated_at || null,
                        pending_local_save: false,
                        pending_local_save_error: null,
                        pending_local_save_at: null,
                    };
                    await upsertDocumentCache(Number(id), latestContent, sanitized);
                    if (savedMeta) {
                        setDocMeta(savedMeta);
                    }
                } catch (err) {
                    void logger.error('no se pudo actualizar caché local tras guardar', err);
                    showAppToast({
                        title: 'Guardado parcial',
                        description: 'El documento se guardó en el servidor, pero falló la actualización de la caché local.',
                        variant: 'warning',
                    });
                }

                setIsDirty(false);
                // Salir del modo edición y liberar el lock en el servidor.
                await exitEditMode();
                setSaveMessage({ type: 'success', text: 'Documento guardado correctamente.' });
                await invalidateDocumentListingCache();
                await refreshAll();
                if (versionId) {
                    navigate(buildDocumentEditPath(id), { replace: true, state: safeNavigationState });
                }
            } else {
                const failureMessage = result.data?.message || result.error || 'Error al guardar el documento.';
                void logger.error('document save rejected by api', {
                    documentId: id,
                    status: result.status,
                    message: failureMessage,
                    payloadKeys: ['content'],
                });
                try {
                    await upsertDocumentCache(Number(id), latestContent, buildSaveFailureCacheMeta(docMeta, failureMessage));
                } catch (cacheError) {
                    void logger.error('no se pudo marcar la caché local como pendiente tras fallo de guardado', cacheError);
                }
                setSaveMessage({ type: 'error', text: failureMessage });
            }
        } catch (error) {
            const failureMessage = `Error de red: ${error.message}`;
            void logger.error('document save request failed', {
                documentId: id,
                error: error.message,
            });
            try {
                await upsertDocumentCache(Number(id), latestContent, buildSaveFailureCacheMeta(docMeta, failureMessage));
            } catch (cacheError) {
                void logger.error('no se pudo marcar la caché local como pendiente tras error de red', cacheError);
            }
            setSaveMessage({ type: 'error', text: failureMessage });
        } finally {
            setIsSaving(false);
        }
    };

    const handleCreateDocument = async () => {
        if (isSaving) return;

        const normalizedTitle = title.trim();
        if (!normalizedTitle) {
            setSaveMessage({ type: 'error', text: 'El documento necesita un título.' });
            return;
        }

        setIsSaving(true);
        setSaveMessage(null);
        try {
            const normalizedCaseId = Number(docMeta?.suit_case_id ?? initialCaseId ?? null);
            const suitCaseId = Number.isFinite(normalizedCaseId) && normalizedCaseId > 0
                ? normalizedCaseId
                : null;
            const status = docMeta?.status || 'Borrador';
            // Usa el HTML más fresco del editor para no crear el documento con contenido stale.
            const latestContent = editorRef.current?.getLatestContent() ?? content;
            const result = await createDocument({
                name: normalizedTitle,
                title: normalizedTitle,
                content: latestContent,
                suit_case_id: suitCaseId,
                status,
            });

            if (result.ok) {
                flushSync(() => {
                    setIsDirty(false);
                });
                setSettingsOpen(false);
                setSaveMessage({ type: 'success', text: 'Documento creado correctamente.' });
                await invalidateDocumentListingCache();
                await refreshAll();

                navigate('/documents');
            } else {
                const failureMessage = result.data?.message || result.error || 'Error al crear el documento.';
                void logger.error('document create rejected by api', {
                    status: result.status,
                    message: failureMessage,
                    title: normalizedTitle,
                });
                setSaveMessage({ type: 'error', text: failureMessage });
            }
        } catch (error) {
            const failureMessage = `Error de red: ${error.message}`;
            void logger.error('document create request failed', {
                error: error.message,
                title: normalizedTitle,
            });
            setSaveMessage({ type: 'error', text: failureMessage });
        } finally {
            setIsSaving(false);
        }
    };

    const handleExportPdf = async () => {
        if (isExportingPdf) return;

        if (typeof window === 'undefined' || typeof window.electronAPI?.documents?.exportPdf !== 'function') {
            showAppToast({
                title: 'Exportación no disponible',
                description: 'La exportación a PDF solo está disponible en Electron.',
                variant: 'danger',
            });
            return;
        }

        setIsExportingPdf(true);

        try {
            const { getReportStyles } = await import('../utils/pdf/pdfStyleHelper.js');
            const styles = getReportStyles();
            
            const m = normalizeMargins(margins || DEFAULT_MARGINS);
            // Usa el HTML más fresco del editor para no exportar contenido stale.
            const latestContent = editorRef.current?.getLatestContent() ?? content;
            const wrappedHtml = `
                <div class="prose prose-base max-w-none bg-white export-document" style="box-sizing: border-box; width: 100%; min-height: auto; margin: 0 auto;">
                    ${latestContent}
                </div>
            `;

            const result = await window.electronAPI.documents.exportPdf({
                title: title.trim() || (id ? `documento-${id}` : 'documento-sin-titulo'),
                html: wrappedHtml,
                styles: `${styles}\n${buildPrintPageCss(m)}\n.export-document { width: 100%; max-width: none; }`
            });

            if (result?.canceled) return;

            if (result?.error) {
                throw new Error(result.error);
            }

            const fileName = result?.filePath ? getFileNameFromPath(result.filePath) : 'documento.pdf';
            showAppToast({
                title: 'PDF exportado',
                description: `Se generó "${fileName}".`,
                variant: 'success',
            });
        } catch (error) {
            void logger.error('Error exportando PDF desde editor', error);
            showAppToast({
                title: 'Error al exportar PDF',
                description: error.message || 'No se pudo exportar el documento a PDF.',
                variant: 'danger',
            });
        } finally {
            setIsExportingPdf(false);
        }
    };

    if (isLoading || isVersionLoading) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center px-2 lg:px-4">
                <div className="flex flex-col items-center gap-3 text-(--text-secondary)">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-sm">Cargando documento...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="flex h-full min-h-0 w-full flex-col overflow-hidden px-2 pb-4 lg:px-4">
            <div className="shrink-0">
                <DocumentEditorHeader
                    id={id}
                    title={title}
                    status={docMeta?.status}
                    onTitleChange={setTitle}
                    isEditing={isEditing}
                    isCheckingEdit={isCheckingEdit}
                    isSaving={isSaving}
                    isExportingPdf={isExportingPdf}
                    isLockedByOther={isLockedByOther}
                    lastAutoSavedAt={lastAutoSavedAt}
                    historyVersionLabel={isViewingHistoricalVersion ? `v${versionMeta?.version_number || versionNumberParam || versionId}` : ''}
                    onBack={navigateBack}
                    onEnableEdit={enableEdit}
                    onExportPdf={handleExportPdf}
                    onSave={handleSave}
                    onOpenSettings={() => setSettingsOpen(true)}
                />
            </div>

            <div className="shrink-0 pt-5">
                <DocumentEditorAlerts
                    id={id}
                    isEditing={isEditing}
                    isLockedByOther={isLockedByOther}
                    lockerName={lockerName}
                />
            </div>

            <div className="mt-5 flex min-h-0 flex-1 overflow-hidden rounded-2xl border border-(--border-default) bg-(--bg-card)">
                <div className="min-w-0 flex-1 overflow-auto px-4 py-4">
                    <TiptapEditor
                        ref={editorRef}
                        content={content}
                        onChange={handleEditorChange}
                        readOnly={id ? !isEditing : false}
                        placeholder="Escribe tu documento..."
                        margins={margins}
                        defaultFont={defaultFont}
                        onMarginsChange={setMargins}
                        onEditMargins={handleOpenMarginsModal}
                    />
                </div>

                {!isViewingHistoricalVersion && (
                    <DraftingToolsSidebar 
                        caseId={docMeta?.suit_case_id ?? initialCaseId} 
                    />
                )}
            </div>

            <DocumentSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                documentData={id
                    ? (docMeta || { name: title, suit_case_id: null })
                    : { name: title, suit_case_id: docMeta?.suit_case_id ?? initialCaseId ?? null }}
                onUpdate={(nextDocMeta) => {
                    // Sanitizar meta para evitar persistir campos extraños de la API (como event_id)
                    const sanitized = {
                        id: nextDocMeta.id,
                        name: nextDocMeta.name,
                        title: nextDocMeta.title || nextDocMeta.name,
                        status: nextDocMeta.status,
                        suit_case_id: nextDocMeta.suit_case_id,
                        updated_at: nextDocMeta.updated_at,
                        user_id: nextDocMeta.user_id,
                    };
                    setDocMeta(nextDocMeta);
                    if (id) {
                        void upsertDocumentCache(Number(id), content, sanitized);
                    }
                }}
                onTitleChange={!id ? setTitle : undefined}
                onConfirmCreate={!id ? handleCreateDocument : undefined}
                creating={!id ? isSaving : false}
                allowCaseAssociationEdit={!id}
                canDelete={canDeleteDocument}
                deleteDisabled={deleteDisabled}
                deleteDisabledReason="No se puede eliminar un documento bloqueado."
                onDelete={requestDeleteDocument}
                deleting={deleteDialogProps.loading}
            />
            {unsavedDialogProps.open && <ConfirmDialog {...unsavedDialogProps} />}
            <ConfirmDialog {...deleteDialogProps} />
            <MarginsModal
                open={isMarginsModalOpen}
                onClose={() => setIsMarginsModalOpen(false)}
                margins={margins}
                onSave={setMargins}
                userId={user?.id}
                indentLevel={marginsModalContext.indentLevel}
                onIndentChange={marginsModalContext.onIndentChange}
            />
        </div>
    );
}

const DocumentEditor = () => {
    const { id } = useParams();
    const [searchParams] = useSearchParams();
    const db = getElectronDB();
    const templateId = searchParams.get('templateId');
    const rawCaseId = searchParams.get('caseId');
    const parsedCaseId = Number(rawCaseId);
    const initialCaseId = Number.isFinite(parsedCaseId) && parsedCaseId > 0 ? parsedCaseId : null;
    const versionId = searchParams.get('versionId');
    const versionNumber = resolveVersionNumber(searchParams);

    if (!db) {
        return (
            <div className="flex h-[60vh] w-full items-center justify-center px-2 lg:px-4">
                <div className="flex flex-col items-center gap-3 text-(--text-secondary)">
                    <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
                    <span className="text-sm">Inicializando editor...</span>
                </div>
            </div>
        );
    }

    return (
        <DocumentEditorContent
            key={`${id || 'new'}:${templateId || 'blank'}:${versionId || 'latest'}`}
            id={id}
            db={db}
            templateId={templateId}
            initialCaseId={initialCaseId}
            versionId={versionId}
            versionNumberParam={versionNumber}
        />
    );
};

export default DocumentEditor;
