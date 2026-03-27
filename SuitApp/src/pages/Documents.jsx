import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, Edit, Eye, File, Settings, Plus, FileDown, Loader2, FileUp } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useHotkeyAction } from '../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';
import DocumentSettingsModal from '../components/DocumentSettingsModal.jsx';
import DocumentDetailsModal from '../components/documents/DocumentDetailsModal.jsx';
import DocumentCaseFilterDialog from '../components/documents/DocumentCaseFilterDialog.jsx';
import FilterAutosuggest from '../components/ui/FilterAutosuggest.jsx';
import { useCases } from '../context/CasesContext';
import { useClients } from '../context/ClientsContext';
import { useUsers } from '../context/UsersContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { PrimaryActionButton } from '../components/ui/PrimaryActionButton';
import { SearchBar } from '../components/ui/SearchBar';
import { Table } from '../components/ui/Table';
import { Badge } from '../components/ui/Badge.jsx';
import { Pagination } from '../components/ui/Pagination';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { useConfirmDialog } from '../hooks/useConfirmDialog.js';
import { showAppToast } from '../components/ui/show-app-toast.jsx';
import {
    DEFAULT_DOCUMENT_FILTERS,
    DOCUMENT_SORT_OPTIONS,
    getCaseLifecycle,
    loadDocumentFilterState,
    saveDocumentFilterState,
} from './documentsFilters.js';
import { getClosedCases } from '../services/caseService.js';
import { deleteDocument, getDocumentLockStatus } from '../services/documentService.js';
import {
    getDocumentListingPage,
    invalidateDocumentListingCache,
} from '../services/documentListingBackendService.js';
import { buildDocumentCreatePath, buildDocumentEditPath } from '../utils/appRoutes.js';
import { DOCUMENT_STATUS_OPTIONS, getDocumentStatusLabel, getDocumentStatusVariant } from '../utils/documentStatus.js';
import { Button } from '../components/ui/Button.jsx';
import { convertDocumentToHtml } from '../services/documentConverterService.js';
import { createLogger } from '../services/logService.js';
import { buildPrintPageCss, normalizeMargins } from '../components/Editor/marginsUtils.js';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
import { documentosSteps } from '../constants/tutorialSteps.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../components/ui/Select.jsx';
import { getBaseNameWithoutExtension } from '../utils/fileNameUtils.js';
const logger = createLogger('page:documents');

const FALLBACK_ITEMS_PER_PAGE = 15;
const DOCUMENT_COLUMNS = [
    { header: 'Nombre' },
    { header: 'Caso' },
    { header: 'Estado' },
    { header: 'Últ. Modificación' },
    { header: 'Creación' },
    { header: 'Acciones', align: 'right' },
];
const INITIAL_UI_STATE = { settingsOpen: false, detailsOpen: false, selectedDoc: null, caseDialogOpen: false };
const INITIAL_CLOSED_CASES_STATE = { items: [], loaded: false, loading: false };
const INITIAL_LISTING_STATE = {
    items: [],
    totalDocuments: 0,
    totalPages: 1,
    perPage: FALLBACK_ITEMS_PER_PAGE,
    loading: true,
    source: 'cache',
};

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

function DocumentsFiltersPanel({
    filters,
    selectedCaseLabel,
    creatorOptions,
    clientOptions,
    showCreatorFilter,
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

                {showCreatorFilter && (
                    <FilterAutosuggest
                        label="Abogados"
                        placeholder="Buscar abogado..."
                        value={filters.selectedCreator}
                        options={creatorOptions}
                        onChange={(value) => onUpdateFilters({ selectedCreator: value })}
                        onClear={() => onUpdateFilters({ selectedCreator: '' })}
                        emptyMessage="No se encontraron abogados."
                    />
                )}

                <FilterAutosuggest
                    label="Clientes"
                    placeholder="Buscar cliente..."
                    value={filters.selectedClientId}
                    options={clientOptions}
                    onChange={(value) => onUpdateFilters({ selectedClientId: value })}
                    onClear={() => onUpdateFilters({ selectedClientId: '' })}
                    emptyMessage="No se encontraron clientes."
                />
                <div className="flex flex-col gap-1.5">
                    <label htmlFor="documents-status-filter" className="text-xs font-medium text-(--text-secondary)">Estado</label>
                    <select
                        id="documents-status-filter"
                        data-testid="filter-status-select"
                        value={filters.selectedStatus || ''}
                        onChange={(e) => onUpdateFilters({ selectedStatus: e.target.value })}
                        className="w-full rounded-lg bg-(--bg-card) border border-(--border-subtle) px-3 py-2 text-sm text-(--text-primary) outline-none focus:ring-2 focus:ring-blue-500/20"
                    >
                        <option value="">Todos los estados</option>
                        {DOCUMENT_STATUS_OPTIONS.map((statusOption) => (
                            <option key={statusOption} value={statusOption}>{statusOption}</option>
                        ))}
                    </select>
                </div>
                <div className="flex min-w-[280px] flex-1 flex-col gap-1.5">
                    <label htmlFor="documents-sort-select" className="text-xs font-medium text-(--text-secondary)">Orden</label>
                    <Select
                        value={`${filters.sortBy}:${filters.sortDirection}`}
                        onValueChange={(value) => {
                            const [sortBy, sortDirection] = String(value).split(':');
                            onUpdateFilters({ sortBy, sortDirection });
                        }}
                    >
                        <SelectTrigger
                            id="documents-sort-select"
                            className="bg-(--bg-card)"
                            data-testid="documents-sort-select"
                        >
                            <SelectValue placeholder="Ordenar documentos" />
                        </SelectTrigger>
                        <SelectContent>
                            {DOCUMENT_SORT_OPTIONS.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>
        </div>
    );
}

function DocumentsTableSection({
    paginatedDocs,
    filteredDocsCount,
    itemsPerPage,
    currentPage,
    onPageChange,
    onOpenSettings,
    onOpenDetails,
    onEditDocument,
    onExportPdf,
    exportingDocId,
    getCaseName,
}) {
    return (
        <div className="flex flex-col gap-4">
            {filteredDocsCount > itemsPerPage && (
                <Pagination
                    totalItems={filteredDocsCount}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={onPageChange}
                    className="rounded-xl border border-(--border-subtle) shadow-sm border-t-0"
                />
            )}

            <Table
                isEmpty={paginatedDocs.length === 0}
                emptyMessage="No se encontraron documentos."
                columns={DOCUMENT_COLUMNS}
                currentPage={currentPage}
            >
                {paginatedDocs.map((doc) => (
                    <tr key={doc.id} className="group transition-colors hover:bg-(--bg-card-hover)">
                        <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                                <div className="rounded-lg bg-blue-500/10 p-2 text-blue-600">
                                    <File className="h-5 w-5" />
                                </div>
                                <button
                                    type="button"
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
                        <td className="px-6 py-4 text-sm" data-testid="document-status-cell">
                            <Badge variant={getDocumentStatusVariant(doc.status)}>
                                {getDocumentStatusLabel(doc.status)}
                            </Badge>
                        </td>
                        <td className="px-6 py-4 text-sm text-(--text-secondary)">
                            {formatDocumentDate(doc.updated_at)}
                        </td>
                        <td className="px-6 py-4 text-sm text-(--text-secondary)">
                            {formatDocumentDate(doc.created_at)}
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex min-w-[7.5rem] flex-wrap items-center justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => onOpenDetails(doc)}
                                    className="cursor-pointer rounded-md p-1 text-(--text-tertiary) transition-colors hover:bg-sky-500/10 hover:text-sky-600"
                                    title="Ver información del documento"
                                >
                                    <Eye className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onOpenSettings(doc)}
                                    className="cursor-pointer rounded-md p-1 text-(--text-tertiary) transition-colors hover:bg-blue-500/10 hover:text-blue-600"
                                    title="Configuración y Permisos"
                                >
                                    <Settings className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onEditDocument(doc.id)}
                                    className="cursor-pointer rounded-md p-1 text-(--text-tertiary) transition-colors hover:bg-green-500/10 hover:text-green-600"
                                    title="Editar Contenido"
                                >
                                    <Edit className="h-5 w-5" />
                                </button>
                                <button
                                    type="button"
                                    onClick={() => onExportPdf(doc)}
                                    disabled={exportingDocId === doc.id}
                                    className={`cursor-pointer rounded-md p-1 transition-colors ${exportingDocId === doc.id
                                        ? 'text-blue-400'
                                        : 'text-(--text-tertiary) hover:bg-blue-500/10 hover:text-blue-600'
                                        }`}
                                    title="Exportar a PDF"
                                >
                                    {exportingDocId === doc.id ? (
                                        <Loader2 className="h-5 w-5 animate-spin" />
                                    ) : (
                                        <FileDown className="h-5 w-5" />
                                    )}
                                </button>
                            </div>
                        </td>
                    </tr>
                ))}
            </Table>
        </div>
    );
}

const Documents = () => {
    const navigate = useNavigate();
    const { cases } = useCases();
    const { clients } = useClients();
    const { users = [] } = useUsers();
    const { user } = useAuth();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    const [filters, setFilters] = useState(() => loadDocumentFilterState());
    const [ui, setUi] = useState(INITIAL_UI_STATE);
    const [currentPage, setCurrentPage] = useState(1);
    const [listingState, setListingState] = useState(INITIAL_LISTING_STATE);
    const [closedCasesState, setClosedCasesState] = useState(INITIAL_CLOSED_CASES_STATE);
    const [exportingDocId, setExportingDocId] = useState(null);
    const [isImporting, setIsImporting] = useState(false);
    const listingRequestRef = useRef(0);
    const deferredSearchQuery = useDeferredValue(filters.searchQuery);
    const isAdmin = user?.role === 'admin';

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
        filters.selectedStatus,
        filters.sortBy,
        filters.sortDirection,
    ]);

    const effectiveFilters = useMemo(
        () => ({ ...filters, searchQuery: deferredSearchQuery }),
        [deferredSearchQuery, filters]
    );

    const loadDocumentsPage = useCallback(async ({ page = currentPage, forceRefresh = false } = {}) => {
        const requestId = listingRequestRef.current + 1;
        listingRequestRef.current = requestId;

        setListingState((current) => ({ ...current, loading: true }));

        try {
            const response = await getDocumentListingPage({
                page,
                filters: effectiveFilters,
                forceRefresh,
            });

            if (listingRequestRef.current !== requestId) return;

            const normalizedPage = Math.max(1, Number(response?.page) || page);
            const totalPages = Math.max(1, Number(response?.totalPages) || 1);
            const items = Array.isArray(response?.items) ? response.items : [];

            if (normalizedPage > totalPages) {
                setCurrentPage(totalPages);
                return;
            }

            if (items.length === 0 && normalizedPage > 1 && !effectiveFilters.searchQuery) {
                setCurrentPage(Math.max(1, normalizedPage - 1));
                return;
            }

            setListingState({
                items,
                totalDocuments: Number(response?.totalDocuments) || items.length,
                totalPages,
                perPage: Math.max(1, Number(response?.perPage) || FALLBACK_ITEMS_PER_PAGE),
                loading: false,
                source: response?.source || 'cache',
            });
        } catch (error) {
            if (listingRequestRef.current !== requestId) return;

            void logger.error('error loading document listing page', error);
            setListingState((current) => ({
                ...current,
                items: [],
                totalDocuments: 0,
                totalPages: 1,
                perPage: FALLBACK_ITEMS_PER_PAGE,
                loading: false,
                source: 'error',
            }));
            showAppToast({
                title: 'No se pudieron cargar los documentos',
                description: error.message || 'Ocurrió un problema al consultar el listado.',
                variant: 'danger',
            });
        }
    }, [currentPage, effectiveFilters]);

    useEffect(() => {
        void loadDocumentsPage({ page: currentPage });
    }, [currentPage, loadDocumentsPage]);

    const refreshCurrentListing = useCallback(async ({ forceRefresh = true } = {}) => {
        await loadDocumentsPage({ page: currentPage, forceRefresh });
    }, [currentPage, loadDocumentsPage]);

    const handleUpdateDocument = useCallback((updatedDoc) => {
        setListingState((current) => ({
            ...current,
            items: current.items.map((doc) => (
                doc.id === updatedDoc.id
                    ? { ...doc, ...updatedDoc }
                    : doc
            )),
        }));
        setUi((current) => (
            current.selectedDoc?.id === updatedDoc.id
                ? { ...current, selectedDoc: { ...current.selectedDoc, ...updatedDoc } }
                : current
        ));
        void invalidateDocumentListingCache();
        void refreshCurrentListing({ forceRefresh: true });
    }, [refreshCurrentListing]);

    // Hotkeys contextuales
    useHotkeyAction(HOTKEY_ACTIONS.NEW_DOCUMENT, () => navigate(buildDocumentCreatePath()));
    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => refreshCurrentListing({ forceRefresh: true }));

    const creatorOptions = useMemo(() => {
        if (!isAdmin) return [];

        return users
            .map((currentUser) => ({
                value: String(currentUser.id),
                label: currentUser.name || currentUser.tag || `Usuario #${currentUser.id}`,
            }))
            .sort((left, right) => left.label.localeCompare(right.label, 'es'));
    }, [isAdmin, users]);

    const clientOptions = useMemo(() => {
        return clients
            .map((client) => ({
                value: String(client.id),
                label: `${client.name || client.first_name || ''} ${client.last_name || ''}`.trim() || `Cliente #${client.id}`,
            }))
            .sort((left, right) => left.label.localeCompare(right.label, 'es'));
    }, [clients]);

    const getCaseName = (suitCaseId) => {
        if (!suitCaseId) return 'Personal';
        const caseItem = casesMap.get(String(suitCaseId));
        return caseItem ? caseItem.title : `Caso #${suitCaseId}`;
    };

    const selectedCaseLabel = getSelectedCaseLabel(filters, selectedCase);

    const canDeleteDocuments = Boolean(user?.role && user.role !== 'user');
    const itemsPerPage = listingState.perPage || FALLBACK_ITEMS_PER_PAGE;
    const paginatedDocs = listingState.items;
    const filteredDocsCount = listingState.totalDocuments;

    const openDocumentEditor = useCallback((documentId) => {
        navigate(buildDocumentEditPath(documentId));
    }, [navigate]);

    /** Abre el diálogo de archivo, convierte DOCX/PDF a HTML y abre el editor con el resultado. */
    const handleImportDocument = useCallback(async () => {
        const dialogResult = await window.electronAPI?.dialog?.openFile({
            filters: [{ name: 'Documentos', extensions: ['docx', 'pdf'] }],
        });
        if (!dialogResult || dialogResult.canceled) return;

        setIsImporting(true);
        try {
            const result = await convertDocumentToHtml(dialogResult.filePath);
            if (!result.ok) throw new Error(result.error || 'No se pudo convertir el documento.');

            if (result.warnings?.length > 0) {
                showAppToast({
                    title: 'Conversión con advertencias',
                    description: result.warnings.join(' '),
                    variant: 'warning',
                });
            }

            navigate(buildDocumentCreatePath(), {
                state: {
                    prefillContent: result.html,
                    prefillTitle: getBaseNameWithoutExtension(dialogResult.filePath),
                    prefillMargins: result.margins ?? null,
                    defaultFont: result.defaultFont ?? null,
                },
            });
        } catch (error) {
            showAppToast({
                title: 'Error al importar',
                description: error.message || 'No se pudo importar el documento.',
                variant: 'danger',
            });
        } finally {
            setIsImporting(false);
        }
    }, [navigate]);

    const openSettingsModal = useCallback((doc) => {
        setUi((current) => ({ ...current, settingsOpen: true, detailsOpen: false, selectedDoc: doc }));
    }, []);

    const openDetailsModal = useCallback((doc) => {
        setUi((current) => ({ ...current, detailsOpen: true, settingsOpen: false, selectedDoc: doc }));
    }, []);

    const closeSettingsModal = useCallback(() => {
        setUi((current) => ({ ...current, settingsOpen: false, selectedDoc: null }));
    }, []);

    const closeDetailsModal = useCallback(() => {
        setUi((current) => ({ ...current, detailsOpen: false, selectedDoc: null }));
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
            await refreshCurrentListing({ forceRefresh: true });
            return;
        }

        const result = await deleteDocument(doc.id);
        if (!result.ok) {
            throw new Error(getDeleteDocumentErrorMessage(result));
        }

        setListingState((current) => ({
            ...current,
            items: current.items.filter((item) => item.id !== doc.id),
            totalDocuments: Math.max(0, current.totalDocuments - 1),
        }));
        await Promise.all([
            deleteDocumentFromCache(doc.id),
            invalidateDocumentListingCache(),
        ]);
        await refreshCurrentListing({ forceRefresh: true });
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
    }, [deleteDocumentFromCache, refreshCurrentListing]);

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
                styles: `${styles}\n${buildPrintPageCss(resolvedMargins)}\n.export-document { width: 100%; max-width: none; }`
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
            void logger.error('Error exportando PDF desde lista', error);
            showAppToast({
                title: 'Error al exportar',
                description: error.message || 'No se pudo generar el PDF.',
                variant: 'danger',
            });
        } finally {
            setExportingDocId(null);
        }
    }, []);

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 data-testid="page-documents-title" className="flex items-center gap-3 text-3xl font-bold text-(--text-primary)">
                        <span>Documentos</span>
                        <SectionTutorialTrigger
                            steps={documentosSteps}
                            ariaLabel="Ver tutorial de Documentos"
                            testId="documentos-tutorial-trigger"
                        />
                    </h1>
                    <p className="mt-1 text-(--text-secondary)">Administra tus escritos y expedientes</p>
                </div>
                <div className="flex items-center gap-2">
                    <Button
                        variant="outline"
                        icon={isImporting ? Loader2 : FileUp}
                        onClick={handleImportDocument}
                        disabled={isImporting}
                        className={isImporting ? '[&_svg]:animate-spin' : ''}
                    >
                        Importar PDF/Word
                    </Button>
                    <PrimaryActionButton
                        data-testid="action-button-nuevo-documento"
                        onClick={() => navigate(buildDocumentCreatePath())}
                        icon={Plus}
                        label="Nuevo Documento"
                    />
                </div>
            </div>

            <DocumentsFiltersPanel
                filters={filters}
                selectedCaseLabel={selectedCaseLabel}
                creatorOptions={creatorOptions}
                clientOptions={clientOptions}
                showCreatorFilter={isAdmin}
                onSearchChange={(searchQuery) => updateFilters({ searchQuery })}
                onOpenCaseDialog={openCaseFilterDialog}
                onUpdateFilters={updateFilters}
            />

            <DocumentsTableSection
                paginatedDocs={paginatedDocs}
                filteredDocsCount={filteredDocsCount}
                itemsPerPage={itemsPerPage}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                onOpenSettings={openSettingsModal}
                onOpenDetails={openDetailsModal}
                onEditDocument={openDocumentEditor}
                onExportPdf={handleExportPdf}
                exportingDocId={exportingDocId}
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
                onUpdate={handleUpdateDocument}
                allowCaseAssociationEdit={false}
                canDelete={canDeleteDocuments}
                onDelete={() => requestDeleteDocument(ui.selectedDoc)}
            />

            <DocumentDetailsModal
                open={ui.detailsOpen}
                onClose={closeDetailsModal}
                documentData={ui.selectedDoc}
            />

            <ConfirmDialog {...dialogProps} />
        </div>
    );
};

export default Documents;
