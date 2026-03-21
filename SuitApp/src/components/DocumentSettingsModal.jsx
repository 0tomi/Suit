import React, { useEffect, useMemo, useReducer } from 'react';
import { Loader2, Trash2, X } from 'lucide-react';
import { useCases } from '../context/CasesContext';
import { getDocumentLockStatus } from '../services/documentService';
import FilterAutosuggest from './ui/FilterAutosuggest.jsx';
import { createLogger } from '../services/logService.js';

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
    const { cases } = useCases();
    const [modalState, dispatch] = useReducer(modalReducer, MODAL_INITIAL_STATE);
    const { selectedCaseId, deleteCheckLoading, remoteDeleteDisabled, remoteDeleteDisabledReason } = modalState;
    const setSelectedCaseId = (v) => dispatch({ type: 'SET_CASE_ID', payload: v });

    const isCreateMode = Boolean(onConfirmCreate);
    const titleValue = (documentData?.name || documentData?.title || '').trim();

    useEffect(() => {
        if (!isOpen) return;
        const caseId = documentData?.suit_case_id ? String(documentData.suit_case_id) : '';
        setSelectedCaseId(caseId);
    }, [documentData?.suit_case_id, isOpen]);

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

    if (!isOpen || !documentData) return null;

    const isDeleteDisabled = deleteCheckLoading || deleteDisabled || remoteDeleteDisabled || deleting;
    const effectiveDeleteDisabledReason = deleteDisabled ? deleteDisabledReason : remoteDeleteDisabledReason;
    const deleteButtonTitle = deleteCheckLoading
        ? 'Verificando bloqueo del documento...'
        : (isDeleteDisabled ? effectiveDeleteDisabledReason : 'Eliminar documento');

    const handleCaseChange = (nextCaseId) => {
        const normalizedValue = nextCaseId ?? '';
        setSelectedCaseId(normalizedValue);
        onUpdate?.({
            ...documentData,
            suit_case_id: normalizedValue ? Number(normalizedValue) : null,
        });
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
                        {onTitleChange ? (
                            <input
                                id="document-settings-title"
                                type="text"
                                value={documentData?.name || documentData?.title || ''}
                                onChange={(event) => onTitleChange(event.target.value)}
                                placeholder="Ingresa un título"
                                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-500"
                            />
                        ) : (
                            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-800">
                                {documentData?.name || documentData?.title || 'Sin título'}
                            </p>
                        )}
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
