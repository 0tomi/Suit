import React, { useEffect, useMemo, useReducer } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { useCases } from '../context/CasesContext';
import { getDocumentLockStatus, updateDocumentName, updateDocumentStatus } from '../services/documentService';
import { showAppToast } from './ui/show-app-toast.jsx';
import FilterAutosuggest from './ui/FilterAutosuggest.jsx';
import { createLogger } from '../services/logService.js';
import { DOCUMENT_STATUS_OPTIONS, getDocumentStatusLabel } from '../utils/documentStatus.js';

const logger = createLogger('component:document-settings-modal');

const MODAL_INITIAL_STATE = {
    selectedCaseId: '',
    deleteCheckLoading: false,
    remoteDeleteDisabled: false,
    remoteDeleteDisabledReason: '',
};

function modalReducer(state, action) {
    switch (action.type) {
        case 'SET_CASE_ID':
            return { ...state, selectedCaseId: action.payload };
        case 'DELETE_CHECK_START':
            return { ...state, deleteCheckLoading: true };
        // Batches loading=false + disabled + reason en un único re-render.
        case 'DELETE_CHECK_RESULT':
            return {
                ...state,
                deleteCheckLoading: false,
                remoteDeleteDisabled: action.isLocked,
                remoteDeleteDisabledReason: action.isLocked ? 'No se puede eliminar un documento bloqueado.' : '',
            };
        case 'DELETE_CHECK_END':
            return { ...state, deleteCheckLoading: false };
        default:
            return state;
    }
}

const DocumentSettingsModal = ({
    isOpen,
    onClose,
    documentData,
    onUpdate,
    onTitleChange,
    onConfirmCreate,
    creating = false,
    allowCaseAssociationEdit = false,
    canDelete = false,
    deleteDisabled = false,
    deleteDisabledReason = '',
    onDelete,
    deleting = false,
}) => {
    const { cases, refreshCases } = useCases();
    const [modalState, dispatch] = useReducer(modalReducer, MODAL_INITIAL_STATE);
    const { selectedCaseId, deleteCheckLoading, remoteDeleteDisabled, remoteDeleteDisabledReason } = modalState;
    const setSelectedCaseId = (v) => dispatch({ type: 'SET_CASE_ID', payload: v });
    const handleCaseChange = (caseId) => {
        const newCaseId = caseId ? Number(caseId) : null;
        setSelectedCaseId(caseId);

        onUpdate?.({ ...documentData, suit_case_id: newCaseId });
    };

    const isCreateMode = Boolean(onConfirmCreate);
    const titleValue = (documentData?.name || documentData?.title || '').trim();

    useEffect(() => {
        if (!isOpen) return;
        const caseId = documentData?.suit_case_id ? String(documentData.suit_case_id) : '';
        setSelectedCaseId(caseId);
    }, [documentData?.suit_case_id, isOpen]);

    useEffect(() => {
        if (!isOpen || !allowCaseAssociationEdit) return;
        void refreshCases?.();
    }, [allowCaseAssociationEdit, isOpen, refreshCases]);

    useEffect(() => {
        if (!isOpen || !canDelete || !documentData?.id) return;

        let cancelled = false;
        const resolveDeleteState = async () => {
            dispatch({ type: 'DELETE_CHECK_START' });
            try {
                const lockStatus = await getDocumentLockStatus(documentData.id);
                if (cancelled) return;
                if (lockStatus.ok) {
                    const isLocked = Boolean(lockStatus.is_locked);
                    // Batchea loading=false + disabled + reason en un único re-render.
                    dispatch({ type: 'DELETE_CHECK_RESULT', isLocked });
                }
            } catch (error) {
                if (!cancelled) {
                    void logger.warn('no se pudo verificar estado de bloqueo', error);
                }
            } finally {
                if (!cancelled) {
                    dispatch({ type: 'DELETE_CHECK_END' });
                }
            }
        };

        void resolveDeleteState();

        return () => {
            cancelled = true;
        };
    }, [canDelete, documentData?.id, isOpen]);

    const associatedCaseName = useMemo(() => {
        if (!documentData?.suit_case_id) return 'Sin caso (Personal)';
        const foundCase = cases.find((caseItem) => String(caseItem.id) === String(documentData.suit_case_id));
        return foundCase?.title || `Caso #${documentData.suit_case_id}`;
    }, [cases, documentData?.suit_case_id]);

    const caseOptions = useMemo(() => ([
        { value: '', label: '— Sin caso (Personal)' },
        ...cases.map((caseItem) => ({ value: String(caseItem.id), label: caseItem.title || `Caso #${caseItem.id}` })),
    ]), [cases]);

    const [localStatus, setLocalStatus] = React.useState(getDocumentStatusLabel(documentData?.status));
    const [localTitle, setLocalTitle] = React.useState(documentData?.name || documentData?.title || '');

    useEffect(() => {
        setLocalTitle(documentData?.name || documentData?.title || '');
    }, [documentData?.name, documentData?.title]);

    const handleTitleBlur = async () => {
        if (!documentData?.id || isCreateMode) return;
        const trimmed = localTitle.trim();
        if (!trimmed || trimmed === (documentData.name || documentData.title)) return;

        try {
            const result = await updateDocumentName(documentData.id, trimmed);
            if (result.ok) {
                onUpdate?.({ ...documentData, name: trimmed, title: trimmed });
                showAppToast({ title: 'Título actualizado', variant: 'success' });
            } else {
                void logger.error('document title update rejected by api', {
                    documentId: documentData.id,
                    status: result.status,
                    message: result.data?.message || result.error || null,
                    name: trimmed,
                });
                showAppToast({
                    title: 'Error al actualizar título',
                    description: result.data?.message || result.error || 'No se pudo actualizar el título del documento.',
                    variant: 'danger',
                });
            }
        } catch (err) {
            void logger.error('error al actualizar título del documento', err);
            showAppToast({
                title: 'Error al actualizar título',
                description: err.message || 'No se pudo actualizar el título del documento.',
                variant: 'danger',
            });
        }
    };

    useEffect(() => {
        setLocalStatus(getDocumentStatusLabel(documentData?.status));
    }, [documentData?.status]);

    if (!isOpen || !documentData) return null;

    const isDeleteDisabled = deleteCheckLoading || deleteDisabled || remoteDeleteDisabled || deleting;
    const effectiveDeleteDisabledReason = deleteDisabled ? deleteDisabledReason : remoteDeleteDisabledReason;
    const deleteButtonTitle = deleteCheckLoading
        ? 'Verificando bloqueo del documento...'
        : (isDeleteDisabled ? effectiveDeleteDisabledReason : 'Eliminar documento');

    const handleStatusChange = async (nextStatus) => {
        if (!documentData) return;

        // Optimistic update
        setLocalStatus(nextStatus);

        // Si es un documento existente, actualizamos inmediatamente vía API.
        if (documentData.id && !isCreateMode) {
            try {
                const result = await updateDocumentStatus(documentData.id, nextStatus);
                if (result.ok) {
                    showAppToast({
                        title: 'Estado actualizado',
                        description: `El documento ahora está en estado "${nextStatus}".`,
                        variant: 'success',
                    });
                    // Informamos al padre para que refresque la UI/caché.
                    onUpdate?.({ ...documentData, status: nextStatus });
                } else {
                    showAppToast({
                        title: 'Error al actualizar estado',
                        description: result.error || 'No se pudo cambiar el estado del documento.',
                        variant: 'destructive',
                    });
                }
            } catch (error) {
                void logger.error('error al actualizar estado del documento', error);
                showAppToast({
                    title: 'Error de red',
                    description: 'No se pudo comunicar con el servidor.',
                    variant: 'destructive',
                });
            }
        } else {
            // En modo creación, solo actualizamos el estado local del padre.
            onUpdate?.({ ...documentData, status: nextStatus });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
            <div className="relative flex max-h-[90vh] w-full max-w-lg flex-col overflow-visible rounded-2xl bg-white shadow-xl">
                <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50 px-6 py-4">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {isCreateMode ? 'Guardar Documento' : 'Propiedades del Documento'}
                    </h2>
                    <button onClick={onClose} className="cursor-pointer text-gray-400 transition-colors hover:text-gray-600">
                        <X size={20} />
                    </button>
                </div>

                <div className="relative flex-1 space-y-4 overflow-visible p-6">
                    <div className="space-y-1">
                        <label htmlFor="document-settings-title" className="block text-sm text-gray-500">Título del documento</label>
                        <input
                            id="document-settings-title"
                            type="text"
                            value={onTitleChange ? (documentData?.name || documentData?.title || '') : localTitle}
                            onChange={(event) => {
                                if (onTitleChange) {
                                    onTitleChange(event.target.value);
                                } else {
                                    setLocalTitle(event.target.value);
                                }
                            }}
                            onBlur={handleTitleBlur}
                            placeholder="Ingresa un título"
                            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                        />
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="document-settings-status" className="block text-sm text-gray-500">Estado</label>
                        <select
                            id="document-settings-status"
                            data-testid="modal-status-select"
                            value={localStatus}
                            onChange={(e) => handleStatusChange(e.target.value)}
                            className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500"
                        >
                            {DOCUMENT_STATUS_OPTIONS.map((statusOption) => (
                                <option key={statusOption} value={statusOption}>{statusOption}</option>
                            ))}
                        </select>
                    </div>

                    {allowCaseAssociationEdit ? (
                        <FilterAutosuggest
                            label="Caso asociado"
                            placeholder="Buscar caso para asociar..."
                            options={caseOptions}
                            value={selectedCaseId}
                            onChange={handleCaseChange}
                            onClear={() => handleCaseChange('')}
                            emptyMessage="No se encontraron casos"
                        />
                    ) : (
                        <div className="space-y-1">
                            <span className="block text-sm text-gray-500">Caso asociado</span>
                            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                                {associatedCaseName}
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-between gap-3 border-t border-gray-100 bg-gray-50 p-4">
                    <div className="flex items-center gap-2">
                        {canDelete && onDelete ? (
                            <button
                                onClick={onDelete}
                                disabled={isDeleteDisabled}
                                title={deleteButtonTitle}
                                className="cursor-pointer inline-flex items-center gap-2 rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:bg-transparent"
                            >
                                <Trash2 size={14} />
                                {deleting ? 'Eliminando...' : (deleteCheckLoading ? 'Verificando...' : 'Eliminar documento')}
                            </button>
                        ) : null}
                        <button onClick={onClose} className="cursor-pointer rounded-lg px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800">
                            Cerrar
                        </button>
                    </div>

                    {isCreateMode ? (
                        <button
                            type="button"
                            onClick={onConfirmCreate}
                            disabled={creating || titleValue.length < 1}
                            className="cursor-pointer inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                            {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                            {creating ? 'Guardando...' : 'Guardar documento'}
                        </button>
                    ) : <span />}
                </div>
            </div>
        </div>
    );
};

export default DocumentSettingsModal;
