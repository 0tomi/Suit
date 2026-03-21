import { useCallback, useEffect, useMemo, useState } from 'react';
import { ChevronDown, Edit, File, Settings, Plus } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHotkeyAction } from '../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';
import DocumentSettingsModal from '../components/DocumentSettingsModal.jsx';
import DocumentCaseFilterDialog from '../components/documents/DocumentCaseFilterDialog.jsx';
import FilterAutosuggest from '../components/ui/FilterAutosuggest.jsx';
import { useDocuments } from '../context/DocumentsContext';
import { useCases } from '../context/CasesContext';
import { useClients } from '../context/ClientsContext';
import { useAuth } from '../context/AuthContext.jsx';
import { PrimaryActionButton } from '../components/ui/PrimaryActionButton';
import { SearchBar } from '../components/ui/SearchBar';
import { Table } from '../components/ui/Table';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import {
    DEFAULT_DOCUMENT_FILTERS,
    filterDocuments,
    getCaseLifecycle,
    loadDocumentFilterState,
    saveDocumentFilterState,
} from './documentsFilters.js';
import { getClosedCases } from '../services/caseService.js';
import { deleteDocument, getDocumentLockStatus } from '../services/documentService.js';
import { buildDocumentCreatePath, buildDocumentEditPath } from '../utils/appRoutes.js';
import { createLogger } from '../services/logService.js';
const logger = createLogger('page:documents');

const itemsPerPage = 10;
const DOCUMENT_COLUMNS = [
    { header: 'Nombre' },
    { header: 'Caso' },
    { header: 'Últ. Modificación' },
    { header: 'Creación' },
    { header: 'Acciones', align: 'right' },
];
const INITIAL_UI_STATE = { settingsOpen: false, selectedDoc: null, caseDialogOpen: false };
const INITIAL_CLOSED_CASES_STATE = { items: [], loaded: false, loading: false };

function mergeCases(openCases, closedCases) {
    const merged = new Map();
    openCases.forEach((caseItem) => merged.set(String(caseItem.id), caseItem));
    closedCases.forEach((caseItem) => {
        const key = String(caseItem.id);
        if (!merged.has(key)) {
            merged.set(key, caseItem);
        }
    });
    return [...merged.values()];
}

function getDeleteDocumentErrorMessage(result) {
    if (result?.status === 403) return 'No tienes permisos para eliminar este documento.';
    if (result?.status === 409) return 'No se puede eliminar un documento bloqueado.';
    if (result?.status === 422) return result?.data?.message || 'No se pudo eliminar el documento.';
    return result?.data?.message || result?.error || 'Error al eliminar documento.';
}

function formatDocumentDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function getSelectedCaseLabel(filters, selectedCase) {
    if (filters.caseMode === 'personal') return 'Personal (sin caso)';
    if (filters.caseMode === 'specific' && selectedCase) return selectedCase.title;
    if (filters.caseMode === 'specific' && filters.selectedCaseId) return `Caso #${filters.selectedCaseId}`;
    return 'Todos los casos';
}

function DocumentsHeader({ onCreate }) {
    return (
        <div className="flex items-center justify-between">
            <div>
                <h1 className="text-3xl font-bold text-(--text-primary)">Documentos</h1>
                <p className="mt-1 text-(--text-secondary)">Administra tus escritos y expedientes</p>
            </div>
            <PrimaryActionButton
                onClick={onCreate}
                icon={Plus}
                label="Nuevo Documento"
            />
        </div>
    );
}

function DocumentsFiltersPanel({
    filters,
    selectedCaseLabel,
    creatorOptions,
    clientOptions,
    onSearchChange,
    onOpenCaseDialog,
    onUpdateFilters,
}) {
    return (
        <div className="space-y-4 rounded-xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-sm">
            <SearchBar
                value={filters.searchQuery}
                onChange={(event) => onSearchChange(event.target.value)}
                placeholder="Buscar documentos..."
            />

            <div className="flex flex-wrap gap-3">
                <div className="min-w-[220px] flex-1">
                    <span className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">
                        Casos
                    </span>
                    <button
                        type="button"
                        onClick={onOpenCaseDialog}
                        className={`flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left text-sm shadow-sm transition-colors ${filters.caseMode !== 'all' || filters.includeClosedCases
                            ? 'border-blue-500/60 bg-blue-50/70 text-blue-700'
                            : 'border-(--border-default) bg-(--bg-input) text-(--text-primary) hover:bg-(--bg-card-hover)'
                            }`}
                        aria-label="Filtro por caso"
                    >
                        <span className="truncate">{selectedCaseLabel}</span>
                        <ChevronDown className="h-4 w-4 shrink-0 opacity-70" />
                    </button>
                    {filters.includeClosedCases && (
                        <p className="mt-1 text-xs text-(--text-secondary)">Incluye casos finalizados</p>
                    )}
                </div>

                <FilterAutosuggest
                    label="Abogados"
                    placeholder="Buscar abogado..."
                    value={filters.selectedCreator}
                    options={creatorOptions}
                    onChange={(value) => onUpdateFilters({ selectedCreator: value })}
                    onClear={() => onUpdateFilters({ selectedCreator: '' })}
                    emptyMessage="No se encontraron abogados."
                />

                <FilterAutosuggest
                    label="Clientes"
                    placeholder="Buscar cliente..."
                    value={filters.selectedClientId}
                    options={clientOptions}
                    onChange={(value) => onUpdateFilters({ selectedClientId: value })}
                    onClear={() => onUpdateFilters({ selectedClientId: '' })}
                    emptyMessage="No se encontraron clientes."
                />
            </div>
        </div>
    );
}

function DocumentsTableSection({
    paginatedDocs,
    filteredDocsCount,
    currentPage,
    onPageChange,
    onOpenSettings,
    onEditDocument,
    getCaseName,
}) {
    return (
        <div className="flex flex-col gap-4">
            <Table
                isEmpty={paginatedDocs.length === 0}
                emptyMessage="No se encontraron documentos."
                columns={DOCUMENT_COLUMNS}
            >
                {paginatedDocs.map((doc) => (
                    <tr key={doc.id} className="group transition-colors hover:bg-(--bg-card-hover)">
                        <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                                <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                                    <File className="h-5 w-5" />
                                </div>
                                <button
                                    onClick={() => onEditDocument(doc.id)}
                                    className="cursor-pointer text-left font-medium text-(--text-primary) hover:text-blue-600"
                                >
                                    {doc.name || doc.title || 'Sin título'}
                                </button>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-sm text-(--text-secondary)">
                            {getCaseName(doc.suit_case_id)}
                        </td>
                        <td className="px-6 py-4 text-sm text-(--text-secondary)">
                            {formatDocumentDate(doc.updated_at)}
                        </td>
                        <td className="px-6 py-4 text-sm text-(--text-secondary)">
                            {formatDocumentDate(doc.created_at)}
                        </td>
                        <td className="space-x-2 px-6 py-4 text-right">
                            <button
                                onClick={() => onOpenSettings(doc)}
                                className="cursor-pointer rounded-md p-1 text-(--text-tertiary) transition-colors hover:bg-blue-500/10 hover:text-blue-600"
                                title="Configuración y Permisos"
                            >
                                <Settings className="h-5 w-5" />
                            </button>
                            <button
                                onClick={() => onEditDocument(doc.id)}
                                className="cursor-pointer rounded-md p-1 text-(--text-tertiary) transition-colors hover:bg-green-500/10 hover:text-green-600"
                                title="Editar Contenido"
                            >
                                <Edit className="h-5 w-5" />
                            </button>
                        </td>
                    </tr>
                ))}
            </Table>

            <Pagination
                totalItems={filteredDocsCount}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={onPageChange}
            />
        </div>
    );
}

const Documents = () => {
    const navigate = useNavigate();
    const { documents, refreshDocuments } = useDocuments();
    const { cases } = useCases();
    const { clients } = useClients();
    const { user } = useAuth();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    const [filters, setFilters] = useState(() => loadDocumentFilterState());
    const [ui, setUi] = useState(INITIAL_UI_STATE);
    const [currentPage, setCurrentPage] = useState(1);
    const [closedCasesState, setClosedCasesState] = useState(INITIAL_CLOSED_CASES_STATE);

    const updateFilters = useCallback((patch) => {
        setFilters((current) => ({ ...current, ...patch }));
    }, []);

    const loadClosedCases = useCallback(async () => {
        if (closedCasesState.loading || closedCasesState.loaded) return;

        setClosedCasesState((current) => ({ ...current, loading: true }));
        try {
            const result = await getClosedCases();
            if (result.ok && Array.isArray(result.data)) {
                setClosedCasesState({ items: result.data, loaded: true, loading: false });
                return;
            }
        } catch (error) {
            void logger.error('error loading closed cases', error);
        }
        setClosedCasesState((current) => ({ ...current, loaded: true, loading: false }));
    }, [closedCasesState.loaded, closedCasesState.loading]);

    useEffect(() => {
        saveDocumentFilterState(filters);
    }, [filters]);

    useEffect(() => {
        void refreshDocuments();
    }, [refreshDocuments]);

    // Hotkeys contextuales
    useHotkeyAction(HOTKEY_ACTIONS.NEW_DOCUMENT, () => navigate(buildDocumentCreatePath()));
    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => refreshDocuments());

    useEffect(() => {
        if (filters.includeClosedCases) {
            loadClosedCases();
        }
    }, [filters.includeClosedCases, loadClosedCases]);

    const allCases = useMemo(
        () => mergeCases(cases, closedCasesState.items),
        [cases, closedCasesState.items]
    );

    const casesMap = useMemo(() => {
        const map = new Map();
        allCases.forEach((caseItem) => map.set(String(caseItem.id), caseItem));
        return map;
    }, [allCases]);

    const selectedCase = useMemo(() => {
        if (filters.caseMode !== 'specific' || !filters.selectedCaseId) return null;
        return casesMap.get(filters.selectedCaseId) ?? null;
    }, [casesMap, filters.caseMode, filters.selectedCaseId]);

    useEffect(() => {
        if (
            !filters.includeClosedCases &&
            filters.caseMode === 'specific' &&
            selectedCase &&
            getCaseLifecycle(selectedCase) === 'closed'
        ) {
            setFilters((current) => ({
                ...current,
                caseMode: DEFAULT_DOCUMENT_FILTERS.caseMode,
                selectedCaseId: DEFAULT_DOCUMENT_FILTERS.selectedCaseId,
            }));
        }
    }, [filters.caseMode, filters.includeClosedCases, selectedCase]);

    useEffect(() => {
        setCurrentPage(1);
    }, [
        filters.searchQuery,
        filters.caseMode,
        filters.selectedCaseId,
        filters.includeClosedCases,
        filters.selectedCreator,
        filters.selectedClientId,
    ]);

    const uniqueCreators = useMemo(() => {
        const creators = new Set();
        documents.forEach((doc) => {
            const name = doc.latest_version?.creator?.name;
            if (name) creators.add(name);
        });
        return [...creators].sort((left, right) => left.localeCompare(right, 'es'));
    }, [documents]);

    const creatorOptions = useMemo(
        () => uniqueCreators.map((name) => ({ value: name, label: name })),
        [uniqueCreators]
    );

    const clientOptions = useMemo(() => {
        return clients
            .map((client) => ({
                value: String(client.id),
                label: `${client.name || client.first_name || ''} ${client.last_name || ''}`.trim() || `Cliente #${client.id}`,
            }))
            .sort((left, right) => left.label.localeCompare(right.label, 'es'));
    }, [clients]);

    const filteredDocs = useMemo(
        () => filterDocuments(documents, filters, casesMap),
        [casesMap, documents, filters]
    );

    const paginatedDocs = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredDocs.slice(startIndex, startIndex + itemsPerPage);
    }, [currentPage, filteredDocs]);

    const getCaseName = (suitCaseId) => {
        if (!suitCaseId) return 'Personal';
        const caseItem = casesMap.get(String(suitCaseId));
        return caseItem ? caseItem.title : `Caso #${suitCaseId}`;
    };

    const selectedCaseLabel = getSelectedCaseLabel(filters, selectedCase);

    const canDeleteDocuments = Boolean(user?.role && user.role !== 'user');

    const openDocumentEditor = useCallback((documentId) => {
        navigate(buildDocumentEditPath(documentId));
    }, [navigate]);

    const openSettingsModal = useCallback((doc) => {
        setUi((current) => ({ ...current, settingsOpen: true, selectedDoc: doc }));
    }, []);

    const closeSettingsModal = useCallback(() => {
        setUi((current) => ({ ...current, settingsOpen: false, selectedDoc: null }));
    }, []);

    const openCaseFilterDialog = useCallback(() => {
        setUi((current) => ({ ...current, caseDialogOpen: true }));
    }, []);

    const handleCaseDialogOpenChange = useCallback((open) => {
        setUi((current) => ({ ...current, caseDialogOpen: open }));
    }, []);

    const deleteDocumentFromCache = useCallback(async (documentId) => {
        if (!window.electronAPI?.db?.deleteById) return;
        try {
            await window.electronAPI.db.deleteById('documents', documentId);
        } catch (error) {
            void logger.warn('no se pudo eliminar documento de caché local', error);
        }
    }, []);

    const executeDeleteDocument = useCallback(async (doc) => {
        const lockStatus = await getDocumentLockStatus(doc.id);
        if (lockStatus.ok && lockStatus.is_locked) {
            showAppToast({
                title: 'Documento bloqueado',
                description: 'No se puede eliminar un documento en uso.',
                variant: 'warning',
            });
            await refreshDocuments();
            return;
        }

        const result = await deleteDocument(doc.id);
        if (!result.ok) {
            throw new Error(getDeleteDocumentErrorMessage(result));
        }

        await deleteDocumentFromCache(doc.id);
        await refreshDocuments();
        setUi((current) => (
            current.selectedDoc?.id === doc.id
                ? { ...current, settingsOpen: false, selectedDoc: null }
                : current
        ));
        showAppToast({
            title: 'Documento eliminado',
            description: `${doc.name || doc.title || `Documento #${doc.id}`} eliminado correctamente.`,
            variant: 'success',
        });
    }, [deleteDocumentFromCache, refreshDocuments]);

    const requestDeleteDocument = useCallback((doc) => {
        if (!doc) return;
        openDialog({
            title: '¿Eliminar documento?',
            desc: `Se eliminará permanentemente "${doc.name || doc.title || `Documento #${doc.id}`}" y sus versiones.`,
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    await executeDeleteDocument(doc);
                    closeDialog();
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
    }, [closeDialog, executeDeleteDocument, openDialog, setDialogLoading]);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 data-testid="page-documents-title" className="text-3xl font-bold text-(--text-primary)">Documentos</h1>
                    <p className="mt-1 text-(--text-secondary)">Administra tus escritos y expedientes</p>
                </div>
                <PrimaryActionButton
                    onClick={() => navigate(buildDocumentCreatePath())}
                    icon={Plus}
                    label="Nuevo Documento"
                />
            </div>

            <DocumentsFiltersPanel
                filters={filters}
                selectedCaseLabel={selectedCaseLabel}
                creatorOptions={creatorOptions}
                clientOptions={clientOptions}
                onSearchChange={(searchQuery) => updateFilters({ searchQuery })}
                onOpenCaseDialog={openCaseFilterDialog}
                onUpdateFilters={updateFilters}
            />

            <DocumentsTableSection
                paginatedDocs={paginatedDocs}
                filteredDocsCount={filteredDocs.length}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onOpenSettings={openSettingsModal}
                onEditDocument={openDocumentEditor}
                getCaseName={getCaseName}
            />

            <DocumentCaseFilterDialog
                open={ui.caseDialogOpen}
                onOpenChange={handleCaseDialogOpenChange}
                cases={allCases.filter((caseItem) => filters.includeClosedCases || getCaseLifecycle(caseItem) !== 'closed')}
                selectedCaseId={filters.selectedCaseId}
                caseMode={filters.caseMode}
                includeClosedCases={filters.includeClosedCases}
                onIncludeClosedCasesChange={(includeClosedCases) => updateFilters({ includeClosedCases })}
                onSelectCase={(selectedCaseId) => updateFilters({ caseMode: 'specific', selectedCaseId })}
                onSelectPersonal={() => updateFilters({ caseMode: 'personal', selectedCaseId: '' })}
                onClearCaseFilter={() => updateFilters({ caseMode: 'all', selectedCaseId: '' })}
                loadingClosedCases={closedCasesState.loading}
            />

            <DocumentSettingsModal
                isOpen={ui.settingsOpen}
                onClose={closeSettingsModal}
                documentData={ui.selectedDoc}
                allowCaseAssociationEdit={false}
                canDelete={canDeleteDocuments}
                onDelete={() => requestDeleteDocument(ui.selectedDoc)}
            />

            <ConfirmDialog {...dialogProps} />
        </div>
    );
};

export default Documents;
