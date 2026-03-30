import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    ChevronDown,
    Edit,
    Eye,
    FileDown,
    FileText,
    FolderOpen,
    Loader2,
    Settings,
    WifiOff,
} from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import DocumentSettingsModal from '../DocumentSettingsModal.jsx';
import DocumentDetailsModal from '../documents/DocumentDetailsModal.jsx';
import { getClientDocuments } from '../../services/clientService.js';
import { createLogger } from '../../services/logService.js';
import { useDocumentActionControls } from '../../hooks/useDocumentActionControls.js';
import { getDocumentStatusLabel, getDocumentStatusVariant } from '../../utils/documentStatus.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';

const logger = createLogger('component:client-documents-tab');

const INITIAL_PERSONAL_STATE = {
    items: [],
    page: 0,
    hasMore: false,
    loading: false,
};

const INITIAL_CASES_STATE = {
    items: [],
    page: 0,
    hasMore: false,
    loading: false,
};

function normalizePaginatorMeta(paginator) {
    const currentPage = Number(paginator?.meta?.current_page) || 1;
    const lastPage = Number(paginator?.meta?.last_page) || 1;

    return {
        currentPage,
        lastPage,
        hasMore: currentPage < lastPage,
    };
}

function dedupeDocuments(existingDocs = [], incomingDocs = []) {
    const byId = new Map();

    existingDocs.forEach((doc) => {
        byId.set(String(doc.id), doc);
    });

    incomingDocs.forEach((doc) => {
        byId.set(String(doc.id), doc);
    });

    return Array.from(byId.values());
}

function formatDocumentDate(dateStr) {
    if (!dateStr) return '—';
    return new Date(dateStr).toLocaleDateString('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
    });
}

function getDocumentLabel(doc) {
    return doc?.name || doc?.title || `Documento #${doc?.id || '—'}`;
}

function DocumentActionButtons({
    doc,
    onOpenDetails,
    onOpenSettings,
    onEditDocument,
    onExportPdf,
    exportingDocId,
}) {
    return (
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
                title="Editar contenido"
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
    );
}

function DocumentRow({
    doc,
    onOpenDetails,
    onOpenSettings,
    onEditDocument,
    onExportPdf,
    exportingDocId,
}) {
    return (
        <li className="flex items-center justify-between gap-4 p-4 hover:bg-(--bg-card-hover)">
            <div className="min-w-0 flex-1">
                <p className="truncate font-medium text-(--text-primary)">{getDocumentLabel(doc)}</p>
                <p className="mt-1 text-xs text-(--text-secondary)">
                    Última actualización: {formatDocumentDate(doc.updated_at)}
                </p>
            </div>
            <div className="flex items-center gap-4">
                <Badge variant={getDocumentStatusVariant(doc.status)}>
                    {getDocumentStatusLabel(doc.status)}
                </Badge>
                <DocumentActionButtons
                    doc={doc}
                    onOpenDetails={onOpenDetails}
                    onOpenSettings={onOpenSettings}
                    onEditDocument={onEditDocument}
                    onExportPdf={onExportPdf}
                    exportingDocId={exportingDocId}
                />
            </div>
        </li>
    );
}

const ClientDocumentsTab = ({ clientData, isOnline = true }) => {
    const { user } = useAuth();
    const [viewMode, setViewMode] = useState('cases');
    const [personalState, setPersonalState] = useState(INITIAL_PERSONAL_STATE);
    const [casesState, setCasesState] = useState(INITIAL_CASES_STATE);
    const [expandedCaseIds, setExpandedCaseIds] = useState(() => new Set());

    const handleDocumentUpdated = useCallback((updatedDoc) => {
        if (!updatedDoc?.id) return;

        setPersonalState((current) => ({
            ...current,
            items: current.items.map((doc) => (
                String(doc.id) === String(updatedDoc.id)
                    ? { ...doc, ...updatedDoc }
                    : doc
            )),
        }));

        setCasesState((current) => ({
            ...current,
            items: current.items.map((caseItem) => ({
                ...caseItem,
                documents: caseItem.documents.map((doc) => (
                    String(doc.id) === String(updatedDoc.id)
                        ? { ...doc, ...updatedDoc }
                        : doc
                )),
            })),
        }));
    }, []);

    const {
        modalState,
        exportingDocId,
        openSettingsModal,
        openDetailsModal,
        closeSettingsModal,
        closeDetailsModal,
        openDocumentEditor,
        handleExportPdf,
        applyDocumentUpdate,
    } = useDocumentActionControls({
        onDocumentUpdated: handleDocumentUpdated,
    });

    const canDeleteDocuments = Boolean(user?.role && user.role !== 'user');

    const resetStates = useCallback(() => {
        setPersonalState(INITIAL_PERSONAL_STATE);
        setCasesState(INITIAL_CASES_STATE);
        setExpandedCaseIds(new Set());
    }, []);

    useEffect(() => {
        resetStates();
    }, [clientData?.id, resetStates]);

    const fetchDocuments = useCallback(async (paging) => {
        if (!clientData?.id) return null;
        return await getClientDocuments(clientData.id, paging);
    }, [clientData?.id]);

    const loadPersonalPage = useCallback(async (pageToLoad) => {
        if (!isOnline || !clientData?.id) return;

        setPersonalState((current) => ({ ...current, loading: true }));

        try {
            const data = await fetchDocuments({
                page_personal: pageToLoad,
                page_cases: 1,
                page_case_docs: 1,
            });
            const personales = data?.personales || {};
            const incomingDocs = Array.isArray(personales.data) ? personales.data : [];
            const pagination = normalizePaginatorMeta(personales);

            setPersonalState((current) => ({
                ...current,
                loading: false,
                page: pagination.currentPage,
                hasMore: pagination.hasMore,
                items: dedupeDocuments(current.items, incomingDocs),
            }));
        } catch (error) {
            setPersonalState((current) => ({ ...current, loading: false }));
            void logger.error('error loading personal client documents', error);
            showAppToast({
                title: 'No se pudo cargar documentación personal',
                description: 'Verificá la conexión y volvé a intentarlo.',
                variant: 'danger',
            });
        }
    }, [clientData?.id, fetchDocuments, isOnline]);

    const mergeCaseCards = useCallback((currentItems, incomingCases, currentCasesPage) => {
        const existingById = new Map(currentItems.map((item) => [String(item.id), item]));

        incomingCases.forEach((incomingCase) => {
            const key = String(incomingCase.id);
            const currentItem = existingById.get(key);
            const docsPaginator = incomingCase.documentos || {};
            const incomingDocs = Array.isArray(docsPaginator.data) ? docsPaginator.data : [];
            const docsPagination = normalizePaginatorMeta(docsPaginator);

            existingById.set(key, {
                id: incomingCase.id,
                nombre: incomingCase.nombre,
                estado: incomingCase.estado,
                fuero: incomingCase.fuero,
                casesPage: currentCasesPage,
                docsPage: docsPagination.currentPage,
                hasMoreDocs: docsPagination.hasMore,
                loadingDocs: false,
                documents: dedupeDocuments(currentItem?.documents || [], incomingDocs),
            });
        });

        const ordered = [...currentItems];
        incomingCases.forEach((incomingCase) => {
            const key = String(incomingCase.id);
            if (!ordered.some((item) => String(item.id) === key)) {
                ordered.push(existingById.get(key));
            }
        });

        return ordered.map((item) => existingById.get(String(item.id)) || item);
    }, []);

    const loadCasesPage = useCallback(async (pageToLoad) => {
        if (!isOnline || !clientData?.id) return;

        setCasesState((current) => ({ ...current, loading: true }));

        try {
            const data = await fetchDocuments({
                page_personal: 1,
                page_cases: pageToLoad,
                page_case_docs: 1,
            });
            const groupedCases = data?.por_casos || {};
            const incomingCases = Array.isArray(groupedCases.data) ? groupedCases.data : [];
            const casesPagination = normalizePaginatorMeta(groupedCases);

            setCasesState((current) => ({
                ...current,
                loading: false,
                page: casesPagination.currentPage,
                hasMore: casesPagination.hasMore,
                items: mergeCaseCards(current.items, incomingCases, pageToLoad),
            }));
        } catch (error) {
            setCasesState((current) => ({ ...current, loading: false }));
            void logger.error('error loading case-grouped client documents', error);
            showAppToast({
                title: 'No se pudieron cargar los casos con documentación',
                description: 'Verificá la conexión y volvé a intentarlo.',
                variant: 'danger',
            });
        }
    }, [clientData?.id, fetchDocuments, isOnline, mergeCaseCards]);

    const loadMoreDocsForCase = useCallback(async (caseId) => {
        if (!isOnline || !clientData?.id) return;

        const currentCase = casesState.items.find((item) => String(item.id) === String(caseId));
        if (!currentCase || currentCase.loadingDocs || !currentCase.hasMoreDocs) return;

        setCasesState((current) => ({
            ...current,
            items: current.items.map((item) => (
                String(item.id) === String(caseId)
                    ? { ...item, loadingDocs: true }
                    : item
            )),
        }));

        try {
            const nextDocPage = (currentCase.docsPage || 1) + 1;
            const data = await fetchDocuments({
                page_personal: 1,
                page_cases: currentCase.casesPage,
                page_case_docs: nextDocPage,
            });
            const groupedCases = data?.por_casos?.data;
            const updatedCase = Array.isArray(groupedCases)
                ? groupedCases.find((item) => String(item.id) === String(caseId))
                : null;

            if (!updatedCase) {
                throw new Error('No se encontró la página solicitada para este caso.');
            }

            const docsPaginator = updatedCase.documentos || {};
            const incomingDocs = Array.isArray(docsPaginator.data) ? docsPaginator.data : [];
            const docsPagination = normalizePaginatorMeta(docsPaginator);

            setCasesState((current) => ({
                ...current,
                items: current.items.map((item) => {
                    if (String(item.id) !== String(caseId)) return item;

                    return {
                        ...item,
                        loadingDocs: false,
                        docsPage: docsPagination.currentPage,
                        hasMoreDocs: docsPagination.hasMore,
                        documents: dedupeDocuments(item.documents, incomingDocs),
                    };
                }),
            }));
        } catch (error) {
            setCasesState((current) => ({
                ...current,
                items: current.items.map((item) => (
                    String(item.id) === String(caseId)
                        ? { ...item, loadingDocs: false }
                        : item
                )),
            }));
            void logger.error('error loading more documents for case', error);
            showAppToast({
                title: 'No se pudieron cargar más documentos del caso',
                description: 'Verificá la conexión y volvé a intentarlo.',
                variant: 'danger',
            });
        }
    }, [casesState.items, clientData?.id, fetchDocuments, isOnline]);

    useEffect(() => {
        if (!isOnline) return;
        if (viewMode !== 'cases') return;
        if (casesState.page > 0 || casesState.loading) return;

        void loadCasesPage(1);
    }, [casesState.loading, casesState.page, isOnline, loadCasesPage, viewMode]);

    useEffect(() => {
        if (!isOnline) return;
        if (viewMode !== 'personal') return;
        if (personalState.page > 0 || personalState.loading) return;

        void loadPersonalPage(1);
    }, [isOnline, loadPersonalPage, personalState.loading, personalState.page, viewMode]);

    const personalCount = useMemo(() => personalState.items.length, [personalState.items.length]);
    const caseDocumentsCount = useMemo(
        () => casesState.items.reduce((acc, caseItem) => acc + caseItem.documents.length, 0),
        [casesState.items],
    );

    const toggleCaseExpanded = useCallback((caseId) => {
        setExpandedCaseIds((current) => {
            const next = new Set(current);
            const normalizedId = String(caseId);
            if (next.has(normalizedId)) {
                next.delete(normalizedId);
            } else {
                next.add(normalizedId);
            }
            return next;
        });
    }, []);

    if (!isOnline) {
        return (
            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card) p-8 text-center">
                <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 text-red-500">
                    <WifiOff className="h-6 w-6" />
                </div>
                <h3 className="text-lg font-semibold text-(--text-primary)">Documentación no disponible</h3>
                <p className="mt-2 text-sm text-(--text-secondary)">
                    Esta sección se habilita cuando la app vuelve a estar conectada al servidor.
                </p>
            </div>
        );
    }

    return (
        <div className="space-y-4">
            <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-sm">
                <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                        <h3 className="text-lg font-semibold text-(--text-primary)">Documentación asociada</h3>
                        <p className="text-xs text-(--text-secondary)">
                            Cambiá la vista para explorar documentos personales o agrupados por expediente.
                        </p>
                    </div>
                    <div className="inline-flex rounded-xl border border-(--border-default) bg-(--bg-input) p-1">
                        <button
                            type="button"
                            onClick={() => setViewMode('cases')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'cases'
                                ? 'bg-blue-600 text-white'
                                : 'text-(--text-secondary) hover:text-(--text-primary)'
                                }`}
                        >
                            Por casos ({caseDocumentsCount})
                        </button>
                        <button
                            type="button"
                            onClick={() => setViewMode('personal')}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${viewMode === 'personal'
                                ? 'bg-blue-600 text-white'
                                : 'text-(--text-secondary) hover:text-(--text-primary)'
                                }`}
                        >
                            Personales ({personalCount})
                        </button>
                    </div>
                </div>
            </div>

            {viewMode === 'personal' ? (
                <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-card) shadow-sm">
                    {personalState.loading && personalState.page === 0 ? (
                        <div className="flex items-center justify-center gap-2 py-10 text-(--text-secondary)">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Cargando documentos personales...</span>
                        </div>
                    ) : personalState.items.length === 0 ? (
                        <div className="m-4">
                            <EmptyState
                                icon={FileText}
                                title="Sin documentos personales"
                                description="Este cliente todavía no tiene documentos personales vinculados."
                            />
                        </div>
                    ) : (
                        <ul className="divide-y divide-(--border-subtle)">
                            {personalState.items.map((doc) => (
                                <DocumentRow
                                    key={doc.id}
                                    doc={doc}
                                    onOpenDetails={openDetailsModal}
                                    onOpenSettings={openSettingsModal}
                                    onEditDocument={openDocumentEditor}
                                    onExportPdf={handleExportPdf}
                                    exportingDocId={exportingDocId}
                                />
                            ))}
                        </ul>
                    )}

                    {personalState.hasMore && (
                        <div className="border-t border-(--border-subtle) p-4">
                            <Button
                                variant="outline"
                                className="w-full"
                                onClick={() => loadPersonalPage((personalState.page || 0) + 1)}
                                disabled={personalState.loading}
                                icon={personalState.loading ? Loader2 : FileText}
                            >
                                {personalState.loading ? 'Cargando...' : 'Cargar más documentos'}
                            </Button>
                        </div>
                    )}
                </div>
            ) : (
                <div className="space-y-3">
                    {casesState.loading && casesState.page === 0 ? (
                        <div className="flex items-center justify-center gap-2 rounded-2xl border border-(--border-subtle) bg-(--bg-card) py-10 text-(--text-secondary)">
                            <Loader2 className="h-5 w-5 animate-spin" />
                            <span>Cargando casos vinculados...</span>
                        </div>
                    ) : casesState.items.length === 0 ? (
                        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-4">
                            <EmptyState
                                icon={FolderOpen}
                                title="Sin documentación por casos"
                                description="No hay expedientes con documentación asociada para este cliente."
                            />
                        </div>
                    ) : (
                        casesState.items.map((caseItem) => {
                            const isExpanded = expandedCaseIds.has(String(caseItem.id));
                            return (
                                <article
                                    key={caseItem.id}
                                    className="overflow-hidden rounded-2xl border border-(--border-subtle) bg-(--bg-card) shadow-sm"
                                >
                                    <button
                                        type="button"
                                        onClick={() => toggleCaseExpanded(caseItem.id)}
                                        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left transition-colors hover:bg-(--bg-card-hover)"
                                    >
                                        <div className="min-w-0">
                                            <p className="truncate font-semibold text-(--text-primary)">
                                                {caseItem.nombre || `Caso #${caseItem.id}`}
                                            </p>
                                            <p className="text-xs text-(--text-secondary)">
                                                {caseItem.fuero || 'Fuero no informado'} · {caseItem.estado || 'Estado no informado'}
                                            </p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            <span className="rounded-full bg-(--bg-input) px-2 py-1 text-xs text-(--text-secondary)">
                                                {caseItem.documents.length} docs
                                            </span>
                                            <ChevronDown className={`h-4 w-4 text-(--text-tertiary) transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                                        </div>
                                    </button>

                                    {isExpanded && (
                                        <div className="border-t border-(--border-subtle)">
                                            {caseItem.documents.length > 0 ? (
                                                <ul className="divide-y divide-(--border-subtle)">
                                                    {caseItem.documents.map((doc) => (
                                                        <DocumentRow
                                                            key={doc.id}
                                                            doc={doc}
                                                            onOpenDetails={openDetailsModal}
                                                            onOpenSettings={openSettingsModal}
                                                            onEditDocument={openDocumentEditor}
                                                            onExportPdf={handleExportPdf}
                                                            exportingDocId={exportingDocId}
                                                        />
                                                    ))}
                                                </ul>
                                            ) : (
                                                <p className="px-4 py-6 text-sm text-(--text-secondary)">
                                                    Este expediente no tiene documentos visibles en esta página.
                                                </p>
                                            )}

                                            {caseItem.hasMoreDocs && (
                                                <div className="border-t border-(--border-subtle) p-3">
                                                    <Button
                                                        variant="outline"
                                                        size="sm"
                                                        className="w-full"
                                                        onClick={() => loadMoreDocsForCase(caseItem.id)}
                                                        disabled={caseItem.loadingDocs}
                                                        icon={caseItem.loadingDocs ? Loader2 : FileText}
                                                    >
                                                        {caseItem.loadingDocs ? 'Cargando...' : 'Cargar más documentos de este caso'}
                                                    </Button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </article>
                            );
                        })
                    )}

                    {casesState.hasMore && (
                        <Button
                            variant="outline"
                            className="w-full"
                            onClick={() => loadCasesPage((casesState.page || 0) + 1)}
                            disabled={casesState.loading}
                            icon={casesState.loading ? Loader2 : FolderOpen}
                        >
                            {casesState.loading ? 'Cargando...' : 'Cargar más casos'}
                        </Button>
                    )}
                </div>
            )}

            <DocumentSettingsModal
                isOpen={modalState.settingsOpen}
                onClose={closeSettingsModal}
                documentData={modalState.selectedDoc}
                onUpdate={applyDocumentUpdate}
                allowCaseAssociationEdit={false}
                canDelete={canDeleteDocuments}
            />

            <DocumentDetailsModal
                open={modalState.detailsOpen}
                onClose={closeDetailsModal}
                documentData={modalState.selectedDoc}
            />
        </div>
    );
};

export default ClientDocumentsTab;
