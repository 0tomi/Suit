import { useCallback, useEffect } from 'react';
import { flushSync } from 'react-dom';
import { useLocation, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import TiptapEditor from '../components/Editor/TiptapEditor';
import DocumentEditorAlerts from '../components/Editor/DocumentEditorAlerts.jsx';
import DocumentEditorHeader from '../components/Editor/DocumentEditorHeader.jsx';
import DocumentSettingsModal from '../components/DocumentSettingsModal';
import { useDocuments } from '../context/DocumentsContext';
import { useAuth } from '../context/AuthContext';
import { useDocumentLoader } from '../hooks/useDocumentLoader.js';
import { useDocumentLock } from '../hooks/useDocumentLock.js';
import { createDocument, updateDocument, deleteDocument, getDocumentLockStatus, getDocumentVersionContent } from '../services/documentService.js';
import { getTemplate } from '../services/templateService.js';
import { buildDocumentEditPath } from '../utils/appRoutes.js';
import { normalizeDocumentPayload } from '../utils/documentUtils.js';
import { useUnsavedChanges } from '../hooks/useUnsavedChanges.js';
import { useDocumentEditorUIState } from '../hooks/useDocumentEditorUIState.js';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import useAutosave from '../hooks/useAutosave.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import { createLogger } from '../services/logService.js';
const logger = createLogger('page:document-editor');


const getElectronDB = () => {
    if (typeof window === 'undefined') return null;
    return window.electronAPI?.db || null;
};

const getFileNameFromPath = (value) => {
    if (!value) return '';
    return String(value).split(/[\\/]/).pop() || '';
};

function getPdfBaseFontFamily() {
    if (typeof window === 'undefined') return undefined;
    return window.getComputedStyle(document.body).fontFamily || undefined;
}

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

function DocumentEditorContent({ id, db, templateId, versionId, versionNumberParam, initialCaseId }) {
    const navigate = useNavigate();
    const location = useLocation();
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
        upsertDocumentCache,
    } = useDocumentLoader({ id, db, documents });

    const {
        isEditing,
        isCheckingEdit,
        isLockedByOther,
        lockerName,
        enableEdit,
    } = useDocumentLock({ id, setSaveMessage });

    const isViewingHistoricalVersion = Boolean(id && versionId);

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
                const historicalContent = await getDocumentVersionContent(id, versionId);

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
            } catch (error) {
                if (!cancelled) {
                    loadVersionFail();
                    setSaveMessage({
                        type: 'error',
                        text: `No se pudo cargar la versión histórica: ${error.message}`,
                    });
                }
            }
        };

        void loadHistoricalVersion();

        return () => {
            cancelled = true;
        };
    }, [id, setContent, setSaveMessage, versionId, versionNumberParam]);

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
    }, [id, setContent, setSaveMessage, setTitle, templateId]);

    const { dialogProps: unsavedDialogProps } = useUnsavedChanges(isDirty, {
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

    // Memoizado para que React.memo en TiptapEditor no re-renderice por referencia nueva en cada render.
    // La comparación newContent === content se eliminó: onChange solo se dispara desde edits internos
    // del usuario, nunca desde setContent externo (bloqueado por isUpdatingFromOutside en TiptapEditor).
    const handleEditorChange = useCallback((newContent) => {
        setContent(newContent);
        if (id && !isEditing) return;
        if (!isDirty) setIsDirty(true);
    }, [id, isEditing, isDirty]);

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
        const normalizedContent = (content || '').trim();
        const isPristineNewDraft = !id
            && !title.trim()
            && (normalizedContent === '' || normalizedContent === '<p></p>');

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

        try {
            const result = await updateDocument(id, { content });

            if (result.ok) {
                try {
                    const savedMeta = normalizeDocumentPayload(result.data) || docMeta;
                    await upsertDocumentCache(Number(id), content, savedMeta);
                    if (savedMeta) {
                        setDocMeta(savedMeta);
                    }
                } catch (err) {
                    void logger.warn('no se pudo actualizar caché local tras guardar', err);
                }

                setIsDirty(false);
                setSaveMessage({ type: 'success', text: 'Documento guardado correctamente.' });
                await refreshAll();
                if (versionId) {
                    navigate(buildDocumentEditPath(id), { replace: true, state: safeNavigationState });
                }
            } else {
                setSaveMessage({ type: 'error', text: result.data?.message || 'Error al guardar el documento.' });
            }
        } catch (error) {
            setSaveMessage({ type: 'error', text: `Error de red: ${error.message}` });
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
            const result = await createDocument({ name: normalizedTitle, content, suit_case_id: suitCaseId });

            if (result.ok) {
                flushSync(() => {
                    setIsDirty(false);
                });
                setSettingsOpen(false);
                setSaveMessage({ type: 'success', text: 'Documento creado correctamente.' });
                showAppToast({
                    title: 'Documento creado',
                    description: normalizedTitle,
                    variant: 'success',
                });
                await refreshAll();

                const newId = result.data?.id || result.data?.data?.id;
                if (newId) {
                    navigate(buildDocumentEditPath(newId), { replace: true, state: safeNavigationState });
                } else {
                    navigate('/documents');
                }
            } else {
                setSaveMessage({ type: 'error', text: result.data?.message || 'Error al crear el documento.' });
            }
        } catch (error) {
            setSaveMessage({ type: 'error', text: `Error de red: ${error.message}` });
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
            const result = await window.electronAPI.documents.exportPdf({
                title: title.trim() || (id ? `documento-${id}` : 'documento-sin-titulo'),
                html: content,
                fontFamily: getPdfBaseFontFamily(),
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
        <div className="flex h-full w-full flex-col gap-5 px-2 pb-8 lg:px-4">
            <DocumentEditorHeader
                id={id}
                title={title}
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
            />

            <DocumentEditorAlerts
                id={id}
                isEditing={isEditing}
                isLockedByOther={isLockedByOther}
                lockerName={lockerName}
                saveMessage={saveMessage}
            />

            <div className="flex-1 pb-6">
                <TiptapEditor
                    content={content}
                    onChange={handleEditorChange}
                    readOnly={id ? !isEditing : false}
                    placeholder="Escribe tu documento..."
                />
            </div>

            <DocumentSettingsModal
                isOpen={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                documentData={id
                    ? (docMeta || { name: title, suit_case_id: null })
                    : { name: title, suit_case_id: docMeta?.suit_case_id ?? initialCaseId ?? null }}
                onUpdate={(nextDocMeta) => setDocMeta(nextDocMeta)}
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
