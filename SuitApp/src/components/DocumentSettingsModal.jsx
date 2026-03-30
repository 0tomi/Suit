import React, { useEffect, useMemo, useReducer } from 'react';
import { Loader2, Plus, Trash2, X } from 'lucide-react';
import { useCases } from '../context/CasesContext';
import { useClients } from '../context/ClientsContext.jsx';
import { useModal } from '../context/ModalContext.jsx';
import {
    getDocumentClients,
    getDocumentLockStatus,
    linkClientsToDocument,
    unlinkClientFromDocument,
    updateDocumentName,
    updateDocumentStatus,
} from '../services/documentService';
import FilterAutosuggest from './ui/FilterAutosuggest.jsx';
import { createLogger } from '../services/logService.js';
import { DOCUMENT_STATUS_OPTIONS, getDocumentStatusLabel } from '../utils/documentStatus.js';
import { Modal } from './ui/Modal.jsx';
import { Button } from './ui/Button.jsx';
import AddCasePersonModal from './cases/AddCasePersonModal.jsx';
import { NewClientModal } from './clients/NewClientModal.jsx';
import { getClientDisplayName } from '../utils/clientDisplayName.js';

const logger = createLogger('component:document-settings-modal');

const MODAL_INITIAL_STATE = {
    selectedCaseId: '',
    deleteCheckLoading: false,
    remoteDeleteDisabled: false,
    remoteDeleteDisabledReason: '',
    modalError: null,
};
const EMPTY_LINKED_CLIENTS = [];

function normalizeDocumentSettingsErrorMessage(rawMessage, fallbackMessage) {
    const message = typeof rawMessage === 'string' ? rawMessage.trim() : '';
    if (!message) return fallbackMessage;

    const normalized = message.toLowerCase();
    if (
        normalized.includes('failed to fetch')
        || normalized.includes('networkerror')
        || normalized.includes('network error')
        || normalized.includes('unexpected token')
        || normalized.includes('request failed')
    ) {
        return fallbackMessage;
    }

    if (normalized.includes('forbidden') || normalized.includes('unauthorized')) {
        return 'No tenés permisos para realizar esta acción sobre el documento.';
    }

    if (normalized.includes('not found')) {
        return 'El documento ya no existe o no está disponible.';
    }

    if (normalized.includes('validation') || normalized.includes('unprocessable')) {
        return 'No se pudieron guardar los cambios porque algunos datos no son válidos.';
    }

    return fallbackMessage;
}

function getLinkedClientsErrorMessage(result, fallbackMessage) {
    if (result?.status === 403) return 'No tenés permisos para consultar los clientes vinculados.';
    if (result?.status === 404) return 'El documento ya no está disponible.';
    if (result?.status === 422) return 'No se pudieron procesar los datos para esta operación.';
    return fallbackMessage;
}

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
        case 'SET_ERROR':
            return { ...state, modalError: action.payload };
        case 'CLEAR_ERROR':
            return { ...state, modalError: null };
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
    error = null,
}) => {
    const { cases, refreshCases } = useCases();
    const { clients = [] } = useClients();
    const { openModal } = useModal();
    const [modalState, dispatch] = useReducer(modalReducer, MODAL_INITIAL_STATE);
    const {
        selectedCaseId,
        deleteCheckLoading,
        remoteDeleteDisabled,
        remoteDeleteDisabledReason,
        modalError,
    } = modalState;
    const setSelectedCaseId = React.useCallback((v) => dispatch({ type: 'SET_CASE_ID', payload: v }), []);
    const setModalError = React.useCallback((v) => dispatch({ type: 'SET_ERROR', payload: v }), []);
    const clearModalError = React.useCallback(() => dispatch({ type: 'CLEAR_ERROR' }), []);
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
    }, [documentData?.suit_case_id, isOpen, setSelectedCaseId]);

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
    const [linkedClients, setLinkedClients] = React.useState(EMPTY_LINKED_CLIENTS);
    const [linkedClientsLoading, setLinkedClientsLoading] = React.useState(false);
    const [clientMutationLoading, setClientMutationLoading] = React.useState(false);
    const [linkSelectorOpen, setLinkSelectorOpen] = React.useState(false);

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
            } else {
                const message = normalizeDocumentSettingsErrorMessage(
                    result.data?.message || result.error,
                    'No se pudo actualizar el título.',
                );
                void logger.error('document title update rejected by api', {
                    documentId: documentData.id,
                    status: result.status,
                    message,
                    name: trimmed,
                });
                setModalError(message);
            }
        } catch (err) {
            void logger.error('error al actualizar título del documento', err);
            setModalError('No se pudo actualizar el título por un problema de conexión.');
        }
    };

    const linkedClientIds = useMemo(
        () => linkedClients.map((client) => String(client.id)),
        [linkedClients],
    );

    const selectableClientItems = useMemo(() => {
        const linkedIdsSet = new Set(linkedClientIds);
        return clients
            .filter((client) => !linkedIdsSet.has(String(client.id)))
            .map((client) => ({
                id: client.id,
                label: getClientDisplayName(client),
                sublabel: client.identification_number || client.email || 'Sin identificación',
                data: client,
            }));
    }, [clients, linkedClientIds]);

    const loadLinkedClients = React.useCallback(async () => {
        if (!documentData?.id || isCreateMode) return;

        setLinkedClientsLoading(true);
        try {
            const result = await getDocumentClients(documentData.id);
            if (!result.ok) {
                const message = getLinkedClientsErrorMessage(result, 'No se pudo cargar la lista de clientes vinculados.');
                setModalError(message);
                setLinkedClients(EMPTY_LINKED_CLIENTS);
                return;
            }

            const payload = Array.isArray(result.data?.data)
                ? result.data.data
                : (Array.isArray(result.data) ? result.data : EMPTY_LINKED_CLIENTS);
            setLinkedClients(payload);
        } catch (err) {
            void logger.error('error loading linked clients for document', err);
            setModalError('No se pudo cargar la lista de clientes vinculados.');
            setLinkedClients(EMPTY_LINKED_CLIENTS);
        } finally {
            setLinkedClientsLoading(false);
        }
    }, [documentData?.id, isCreateMode, setModalError]);

    const attachClients = React.useCallback(async (selectedClients = []) => {
        if (!documentData?.id || isCreateMode) return;

        const clientIds = selectedClients
            .map((client) => Number(client?.id))
            .filter((id) => Number.isInteger(id) && id > 0);
        if (clientIds.length === 0) return;

        setClientMutationLoading(true);
        clearModalError();
        try {
            const result = await linkClientsToDocument(documentData.id, clientIds);
            if (!result.ok) {
                const message = getLinkedClientsErrorMessage(result, 'No se pudieron vincular los clientes al documento.');
                setModalError(message);
                return;
            }

            await loadLinkedClients();
            setLinkSelectorOpen(false);
        } catch (err) {
            void logger.error('error attaching clients to document', err);
            setModalError('No se pudieron vincular los clientes al documento.');
        } finally {
            setClientMutationLoading(false);
        }
    }, [clearModalError, documentData?.id, isCreateMode, loadLinkedClients, setModalError]);

    const detachClient = React.useCallback(async (clientId) => {
        if (!documentData?.id || isCreateMode) return;

        setClientMutationLoading(true);
        clearModalError();
        try {
            const result = await unlinkClientFromDocument(documentData.id, clientId);
            if (!result.ok) {
                const message = getLinkedClientsErrorMessage(result, 'No se pudo desvincular el cliente del documento.');
                setModalError(message);
                return;
            }
            await loadLinkedClients();
        } catch (err) {
            void logger.error('error detaching client from document', err);
            setModalError('No se pudo desvincular el cliente del documento.');
        } finally {
            setClientMutationLoading(false);
        }
    }, [clearModalError, documentData?.id, isCreateMode, loadLinkedClients, setModalError]);

    const handleOpenCreateClient = React.useCallback(() => {
        openModal(NewClientModal, {
            onSuccess: (newClient) => {
                if (newClient?.id) {
                    void attachClients([newClient]);
                }
            },
        });
    }, [attachClients, openModal]);

    useEffect(() => {
        if (!isOpen || !documentData?.id || isCreateMode) {
            setLinkedClients(EMPTY_LINKED_CLIENTS);
            setLinkSelectorOpen(false);
            return;
        }
        void loadLinkedClients();
    }, [documentData?.id, isCreateMode, isOpen, loadLinkedClients]);

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
        clearModalError();

        // Si es un documento existente, actualizamos inmediatamente vía API.
        if (documentData.id && !isCreateMode) {
            try {
                const result = await updateDocumentStatus(documentData.id, nextStatus);
                if (result.ok) {
                    onUpdate?.({ ...documentData, status: nextStatus });
                } else {
                    setModalError(
                        normalizeDocumentSettingsErrorMessage(
                            result.data?.message || result.error,
                            'No se pudo cambiar el estado del documento.',
                        ),
                    );
                }
            } catch (error) {
                void logger.error('error al actualizar estado del documento', error);
                setModalError('No se pudo cambiar el estado por un problema de conexión.');
            }
        } else {
            // En modo creación, solo actualizamos el estado local del padre.
            onUpdate?.({ ...documentData, status: nextStatus });
        }
    };

    return (
        <>
            <Modal
                open={isOpen}
                onClose={onClose}
                title={isCreateMode ? 'Guardar documento' : 'Propiedades del documento'}
                subtitle={isCreateMode
                    ? 'Definí el título, el estado y el caso asociado antes de guardar.'
                    : 'Editá la información principal del documento desde un único lugar.'
                }
                maxWidth="max-w-lg"
                bodyClassName="relative space-y-4 overflow-visible"
                footerAlignment={isCreateMode ? 'justify-between' : 'justify-center'}
                showCloseButton
                footer={(
                    <>
                        {canDelete && onDelete ? (
                            <Button
                                variant="outline"
                                icon={Trash2}
                                onClick={onDelete}
                                disabled={isDeleteDisabled}
                                title={deleteButtonTitle}
                                className="border-red-200 text-red-600 hover:bg-red-500/10 hover:text-red-700"
                            >
                                {deleting ? 'Eliminando...' : (deleteCheckLoading ? 'Verificando...' : 'Eliminar documento')}
                            </Button>
                        ) : (isCreateMode ? <Button variant="ghost" onClick={onClose}>Cerrar</Button> : null)}

                        {isCreateMode ? (
                            <Button
                                variant="primary"
                                onClick={onConfirmCreate}
                                disabled={creating || titleValue.length < 1}
                                icon={creating ? Loader2 : null}
                                className={creating ? '[&_.lucide]:animate-spin' : ''}
                            >
                                {creating ? 'Guardando...' : 'Guardar documento'}
                            </Button>
                        ) : <span />}
                    </>
                )}
            >
                <div className="space-y-4">
                    <div className="space-y-1">
                        <label htmlFor="document-settings-title" className="block text-sm font-medium text-(--text-secondary)">Título del documento</label>
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
                                clearModalError();
                            }}
                            onBlur={handleTitleBlur}
                            placeholder="Ingresa un título"
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) outline-none transition-colors focus:border-blue-500"
                        />
                        {(error || modalError) && <p className="mt-1 text-xs text-red-500">{error || modalError}</p>}
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="document-settings-status" className="block text-sm font-medium text-(--text-secondary)">Estado</label>
                        <select
                            id="document-settings-status"
                            data-testid="modal-status-select"
                            value={localStatus}
                            onChange={(e) => {
                                handleStatusChange(e.target.value);
                                clearModalError();
                            }}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) outline-none transition-colors focus:border-blue-500"
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
                            <span className="block text-sm font-medium text-(--text-secondary)">Caso asociado</span>
                            <p className="rounded-lg border border-(--border-default) bg-(--bg-card-hover) px-3 py-2 text-sm text-(--text-primary)">
                                {associatedCaseName}
                            </p>
                        </div>
                    )}

                    {!isCreateMode && documentData?.id && (
                        <div className="space-y-3 rounded-xl border border-(--border-default) bg-(--bg-card-hover) p-3">
                            <div className="flex items-center justify-between gap-2">
                                <div>
                                    <p className="text-sm font-semibold text-(--text-primary)">Clientes vinculados</p>
                                    <p className="text-xs text-(--text-secondary)">
                                        Administrá qué clientes tienen este documento en su sección personal.
                                    </p>
                                </div>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    icon={Plus}
                                    onClick={() => setLinkSelectorOpen(true)}
                                    disabled={clientMutationLoading || linkedClientsLoading}
                                >
                                    Vincular
                                </Button>
                            </div>

                            {linkedClientsLoading ? (
                                <div className="flex items-center gap-2 text-sm text-(--text-secondary)">
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                    <span>Cargando clientes vinculados...</span>
                                </div>
                            ) : linkedClients.length === 0 ? (
                                <p className="text-sm text-(--text-secondary)">Este documento no tiene clientes vinculados.</p>
                            ) : (
                                <ul className="space-y-2">
                                    {linkedClients.map((client) => (
                                        <li
                                            key={client.id}
                                            className="flex items-center justify-between gap-2 rounded-lg border border-(--border-subtle) bg-(--bg-card) px-3 py-2"
                                        >
                                            <span className="text-sm text-(--text-primary)">{getClientDisplayName(client)}</span>
                                            <button
                                                type="button"
                                                onClick={() => void detachClient(client.id)}
                                                disabled={clientMutationLoading}
                                                className="rounded-md p-1 text-(--text-tertiary) transition-colors hover:bg-red-500/10 hover:text-red-600 disabled:cursor-not-allowed disabled:opacity-60"
                                                title="Desvincular cliente"
                                            >
                                                <X className="h-4 w-4" />
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    )}
                </div>
            </Modal>

            {linkSelectorOpen && (
                <AddCasePersonModal
                    open
                    onClose={() => setLinkSelectorOpen(false)}
                    title="Vincular clientes al documento"
                    subtitle="Seleccioná uno o más clientes para asociarlos al documento."
                    items={selectableClientItems}
                    onConfirmSelection={attachClients}
                    onCreateNew={handleOpenCreateClient}
                    createNewText="Crear nuevo cliente"
                    placeholder="Buscar por nombre, razón social o identificación..."
                    emptyMessage="No hay clientes disponibles para vincular."
                    noOverlay
                    multiSelect
                    linkingId={clientMutationLoading ? 'batch' : null}
                    confirmText="Vincular seleccionados"
                />
            )}
        </>
    );
};


export default DocumentSettingsModal;
