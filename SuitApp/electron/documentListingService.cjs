const { getAll, getConfig } = require('./database.cjs');
const {
    getDocumentsLastModifiedFromApi,
    getDocumentsPageFromApi,
    getDocumentsTotalPagesFromApi,
    getFilteredDocumentsPageFromApi,
    getFilteredDocumentsTotalPagesFromApi,
    searchDocumentsFromApi,
} = require('./documentListingApi.cjs');
const {
    buildQueryCacheEntry,
    clearDocumentQueryCache,
    getCachedDocumentQuery,
    getDocumentsListingMeta,
    listCachedDocuments,
    readDocumentsByIds,
    setDocumentsListingMeta,
    upsertCachedDocumentQuery,
    upsertCachedDocuments,
} = require('./documentListingRepository.cjs');
const { getLogger } = require('./logService.cjs');

const DEFAULT_PER_PAGE = 15;
const logger = getLogger('documents:listing:service');
const ALLOWED_SORT_FIELDS = new Set(['updated_at', 'created_at', 'name']);
const ALLOWED_SORT_DIRECTIONS = new Set(['asc', 'desc']);
const DOCUMENT_NAME_COLLATOR = new Intl.Collator('es', {
    sensitivity: 'base',
    numeric: true,
});

function parseJsonSafely(value) {
    if (!value || typeof value !== 'string') return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function normalizeFilters(rawFilters = {}) {
    return {
        searchQuery: typeof rawFilters.searchQuery === 'string' ? rawFilters.searchQuery.trim() : '',
        caseMode: ['all', 'personal', 'specific'].includes(rawFilters.caseMode) ? rawFilters.caseMode : 'all',
        selectedCaseId: rawFilters.selectedCaseId ? String(rawFilters.selectedCaseId) : '',
        includeClosedCases: Boolean(rawFilters.includeClosedCases),
        selectedCreator: rawFilters.selectedCreator ? String(rawFilters.selectedCreator) : '',
        selectedClientId: rawFilters.selectedClientId ? String(rawFilters.selectedClientId) : '',
        selectedStatus: typeof rawFilters.selectedStatus === 'string' ? rawFilters.selectedStatus.trim() : '',
        sortBy: ALLOWED_SORT_FIELDS.has(rawFilters.sortBy) ? rawFilters.sortBy : 'updated_at',
        sortDirection: ALLOWED_SORT_DIRECTIONS.has(rawFilters.sortDirection) ? rawFilters.sortDirection : 'desc',
    };
}

function getCurrentUser() {
    const payload = parseJsonSafely(getConfig('auth_user'));
    return payload && typeof payload === 'object' ? payload : null;
}

function isAdminUser() {
    return getCurrentUser()?.role === 'admin';
}

function toComparableTimestamp(payload) {
    return (
        payload?.last_modified
        ?? payload?.updated_at
        ?? payload?.data?.last_modified
        ?? null
    );
}

function isRemoteFreshEnough(serverTimestamp, localTimestamp) {
    if (!serverTimestamp) return true;
    if (!localTimestamp) return false;

    const serverTime = new Date(serverTimestamp).getTime();
    const localTime = new Date(localTimestamp).getTime();

    if (Number.isNaN(serverTime) || Number.isNaN(localTime)) {
        return String(serverTimestamp) === String(localTimestamp);
    }

    return serverTime <= localTime;
}

function extractDocumentsCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    if (Array.isArray(payload?.documents)) return payload.documents;
    return [];
}

function extractPaginationMeta(payload) {
    return {
        currentPage:
            Number(payload?.meta?.current_page)
            || Number(payload?.data?.meta?.current_page)
            || Number(payload?.current_page)
            || Number(payload?.data?.current_page)
            || 1,
        lastPage:
            Number(payload?.meta?.last_page)
            || Number(payload?.data?.meta?.last_page)
            || Number(payload?.last_page)
            || Number(payload?.data?.last_page)
            || 1,
        totalDocuments:
            Number(payload?.meta?.total)
            || Number(payload?.data?.meta?.total)
            || Number(payload?.total)
            || Number(payload?.data?.total)
            || null,
        perPage:
            Number(payload?.meta?.per_page)
            || Number(payload?.data?.meta?.per_page)
            || Number(payload?.per_page)
            || Number(payload?.data?.per_page)
            || DEFAULT_PER_PAGE,
    };
}

function extractTotalsPayload(payload, fallbackPerPage = DEFAULT_PER_PAGE) {
    if (!payload || typeof payload !== 'object') {
        return {
            totalDocuments: null,
            totalPages: null,
            perPage: fallbackPerPage,
        };
    }

    return {
        totalDocuments:
            Number(payload.total_documents)
            || Number(payload.total)
            || Number(payload?.meta?.total)
            || null,
        totalPages:
            Number(payload.total_pages)
            || Number(payload.last_page)
            || Number(payload?.meta?.last_page)
            || null,
        perPage:
            Number(payload.per_page)
            || Number(payload?.meta?.per_page)
            || fallbackPerPage,
    };
}

function buildRemoteFilterQuery(filters, { includeSort = true } = {}) {
    const query = {};

    if (filters.selectedStatus) {
        query.state = filters.selectedStatus;
    }

    if (filters.selectedClientId) {
        const clientId = Number(filters.selectedClientId);
        if (Number.isInteger(clientId) && clientId > 0) {
            query.client = clientId;
        }
    }

    if (filters.caseMode === 'specific' && filters.selectedCaseId) {
        const caseId = Number(filters.selectedCaseId);
        if (Number.isInteger(caseId) && caseId > 0) {
            query.suit_case_id = caseId;
        }
    }

    if (isAdminUser() && filters.selectedCreator) {
        const userId = Number(filters.selectedCreator);
        if (Number.isInteger(userId) && userId > 0) {
            query.byUser = userId;
        }
    }

    if (includeSort) {
        query.sort_by = filters.sortBy;
        query.sort_direction = filters.sortDirection;
    }

    return query;
}

function buildRemotePageQuery(filters) {
    return {
        ...buildRemoteFilterQuery(filters, { includeSort: false }),
        sort_by: filters.sortBy,
        sort_direction: filters.sortDirection,
    };
}

function buildCacheKey(mode, params = {}) {
    const serializedParams = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => `${key}:${String(value)}`)
        .join('|');

    return serializedParams ? `${mode}::${serializedParams}` : mode;
}

function getCaseLifecycle(caseItem) {
    if (!caseItem || typeof caseItem !== 'object') return 'unknown';
    if (caseItem.end_date) return 'closed';
    if (String(caseItem.status || '').toLowerCase() === 'closed') return 'closed';

    const payload = parseJsonSafely(caseItem.data_json);
    if (payload?.end_date) return 'closed';
    if (String(payload?.status || '').toLowerCase() === 'closed') return 'closed';
    return 'open';
}

function buildLocalFilterContext() {
    const casesById = new Map();
    const caseClientMap = new Map();

    for (const caseRow of getAll('cases')) {
        const hydrated = caseRow?.data_json
            ? { ...caseRow, ...(parseJsonSafely(caseRow.data_json) || {}) }
            : caseRow;
        casesById.set(String(caseRow.id), hydrated);
    }

    for (const row of getAll('case_client')) {
        const caseId = String(row.suit_case_id);
        const currentClientIds = caseClientMap.get(caseId) || new Set();
        currentClientIds.add(String(row.client_id));
        caseClientMap.set(caseId, currentClientIds);
    }

    return { casesById, caseClientMap };
}

function caseHasClient(caseId, selectedClientId, context) {
    const normalizedCaseId = String(caseId);
    const normalizedClientId = String(selectedClientId);
    const linkedClients = context.caseClientMap.get(normalizedCaseId);

    if (linkedClients?.has(normalizedClientId)) {
        return true;
    }

    const caseItem = context.casesById.get(normalizedCaseId);
    const embeddedClients = Array.isArray(caseItem?.clients)
        ? caseItem.clients
        : Array.isArray(parseJsonSafely(caseItem?.data_json)?.clients)
            ? parseJsonSafely(caseItem?.data_json).clients
            : [];

    return embeddedClients.some((client) => String(client.id) === normalizedClientId);
}

function matchesLocalFilters(document, filters, context) {
    if (!document || typeof document !== 'object') return false;
    if (document.category === 'multimedia') return false;

    const name = String(document.name || document.title || '').toLowerCase();
    if (filters.searchQuery && !name.includes(filters.searchQuery.toLowerCase())) {
        return false;
    }

    if (filters.caseMode === 'personal') {
        if (document.suit_case_id) return false;
    } else if (filters.caseMode === 'specific' && filters.selectedCaseId) {
        if (String(document.suit_case_id) !== filters.selectedCaseId) return false;
    } else if (!filters.includeClosedCases && document.suit_case_id) {
        const caseItem = context.casesById.get(String(document.suit_case_id));
        if (caseItem && getCaseLifecycle(caseItem) === 'closed') {
            return false;
        }
    }

    if (filters.selectedCreator) {
        const creatorId = Number(
            document.latest_version?.creator?.id
            ?? document.latest_version_created_by
            ?? document.user_id
            ?? null
        );
        if (!Number.isInteger(creatorId) || String(creatorId) !== filters.selectedCreator) {
            return false;
        }
    }

    if (filters.selectedClientId) {
        if (!document.suit_case_id) return false;
        if (!caseHasClient(document.suit_case_id, filters.selectedClientId, context)) {
            return false;
        }
    }

    if (filters.selectedStatus && document.status !== filters.selectedStatus) {
        return false;
    }

    return true;
}

function applyLocalFilters(items, filters) {
    const context = buildLocalFilterContext();
    return items.filter((document) => matchesLocalFilters(document, filters, context));
}

function getDocumentComparableTimestamp(document, field) {
    if (field === 'created_at') {
        return new Date(document.created_at || 0).getTime();
    }

    return new Date(document.updated_at || document.created_at || 0).getTime();
}

function sortDocuments(items, filters) {
    return [...items].sort((left, right) => {
        if (filters.sortBy === 'name') {
            const comparison = DOCUMENT_NAME_COLLATOR.compare(
                String(left.name || left.title || ''),
                String(right.name || right.title || ''),
            );
            return filters.sortDirection === 'asc' ? comparison : comparison * -1;
        }

        const comparison = getDocumentComparableTimestamp(left, filters.sortBy)
            - getDocumentComparableTimestamp(right, filters.sortBy);
        return filters.sortDirection === 'asc' ? comparison : comparison * -1;
    });
}

function buildListingResponse({
    items,
    page = 1,
    totalPages = 1,
    totalDocuments = null,
    perPage = DEFAULT_PER_PAGE,
    source = 'cache',
    appliedLocalFilters = false,
}) {
    return {
        items,
        page,
        totalPages: Math.max(1, Number(totalPages) || 1),
        totalDocuments: totalDocuments ?? items.length,
        perPage: Math.max(1, Number(perPage) || DEFAULT_PER_PAGE),
        source,
        appliedLocalFilters,
    };
}

function queueCachePersistence({ cacheKey, mode, page, params, items, totalPages, totalDocuments, perPage, serverTimestamp }) {
    void Promise.resolve().then(() => {
        upsertCachedDocuments(items);
        upsertCachedDocumentQuery(buildQueryCacheEntry({
            cacheKey,
            mode,
            page,
            params,
            documentIds: items.map((item) => item.id),
            totalPages,
            totalDocuments,
            perPage,
        }));
        if (serverTimestamp) {
            setDocumentsListingMeta(new Date().toISOString(), serverTimestamp);
        }
    }).catch((error) => {
        logger.warn('failed to persist document listing cache entry', {
            cacheKey,
            page,
            error: error?.message || String(error),
        });
    });
}

async function ensureListingCacheFresh(forceRefresh = false) {
    try {
        const response = await getDocumentsLastModifiedFromApi();
        if (!response.ok) return null;

        const remoteTimestamp = toComparableTimestamp(response.data);
        const localMeta = getDocumentsListingMeta();

        if (forceRefresh || !isRemoteFreshEnough(remoteTimestamp, localMeta?.last_server)) {
            clearDocumentQueryCache();
        }

        if (remoteTimestamp) {
            setDocumentsListingMeta(new Date().toISOString(), remoteTimestamp);
        }

        return remoteTimestamp;
    } catch (error) {
        logger.warn('could not validate freshness for documents listing cache', {
            error: error?.message || String(error),
        });
        return null;
    }
}

function getCachedListingPage(cacheKey, page, filters) {
    const cachedPage = getCachedDocumentQuery(cacheKey, page);
    if (!cachedPage) return null;

    const cachedItems = readDocumentsByIds(cachedPage.documentIds);
    if (cachedItems.length !== cachedPage.documentIds.length) {
        return null;
    }

    const visibleItems = applyLocalFilters(cachedItems, filters);
    const appliedLocalFilters = visibleItems.length !== cachedItems.length;

    return buildListingResponse({
        items: visibleItems,
        page: cachedPage.page,
        totalPages: cachedPage.total_pages,
        totalDocuments: cachedPage.total_documents,
        perPage: cachedPage.per_page,
        source: 'cache',
        appliedLocalFilters,
    });
}

async function fetchListingPageFromApi(page, filters, remotePageQuery, remoteFilterQuery, serverTimestamp = null) {
    const hasRemoteFilters = Object.keys(remoteFilterQuery).length > 0;
    const cacheKey = buildCacheKey(hasRemoteFilters ? 'filtered' : 'list', remotePageQuery);

    const [pageResponse, totalsResponse] = await Promise.all([
        hasRemoteFilters
            ? getFilteredDocumentsPageFromApi({ ...remotePageQuery, page })
            : getDocumentsPageFromApi({ ...remotePageQuery, page }),
        hasRemoteFilters
            ? getFilteredDocumentsTotalPagesFromApi(remoteFilterQuery)
            : getDocumentsTotalPagesFromApi(),
    ]);

    if (!pageResponse.ok) {
        throw new Error(pageResponse.error || `No se pudo obtener la página ${page} de documentos.`);
    }

    const rawItems = extractDocumentsCollection(pageResponse.data);
    const pageMeta = extractPaginationMeta(pageResponse.data);
    const totalsMeta = totalsResponse.ok
        ? extractTotalsPayload(totalsResponse.data, pageMeta.perPage)
        : extractTotalsPayload(pageResponse.data, pageMeta.perPage);
    const visibleItems = applyLocalFilters(rawItems, filters);
    const appliedLocalFilters = visibleItems.length !== rawItems.length;

    queueCachePersistence({
        cacheKey,
        mode: hasRemoteFilters ? 'filtered' : 'list',
        page,
        params: remotePageQuery,
        items: rawItems,
        totalPages: totalsMeta.totalPages ?? pageMeta.lastPage,
        totalDocuments: totalsMeta.totalDocuments ?? pageMeta.totalDocuments ?? rawItems.length,
        perPage: totalsMeta.perPage ?? pageMeta.perPage,
        serverTimestamp,
    });

    return buildListingResponse({
        items: visibleItems,
        page: pageMeta.currentPage || page,
        totalPages: totalsMeta.totalPages ?? pageMeta.lastPage,
        totalDocuments: totalsMeta.totalDocuments ?? pageMeta.totalDocuments ?? rawItems.length,
        perPage: totalsMeta.perPage ?? pageMeta.perPage,
        source: 'api',
        appliedLocalFilters,
    });
}

async function searchDocuments(filters, forceRefresh = false) {
    const remoteQuery = buildRemotePageQuery(filters);
    const cacheKey = buildCacheKey('search', {
        ...remoteQuery,
        search: filters.searchQuery.toLowerCase(),
    });
    const serverTimestamp = await ensureListingCacheFresh(forceRefresh);

    if (!forceRefresh) {
        const cached = getCachedListingPage(cacheKey, 1, filters);
        if (cached) {
            return { ...cached, source: 'cache-search' };
        }
    }

    if (!forceRefresh) {
        const allLocalMatches = sortDocuments(applyLocalFilters(listCachedDocuments(), filters), filters);
        const localMatches = allLocalMatches.slice(0, 10);
        if (localMatches.length > 0) {
            queueCachePersistence({
                cacheKey,
                mode: 'search',
                page: 1,
                params: {
                    ...remoteQuery,
                    search: filters.searchQuery,
                },
                items: localMatches,
                totalPages: 1,
                totalDocuments: allLocalMatches.length,
                perPage: localMatches.length,
                serverTimestamp,
            });

            return buildListingResponse({
                items: localMatches,
                page: 1,
                totalPages: 1,
                totalDocuments: allLocalMatches.length,
                perPage: localMatches.length,
                source: 'cache-search-local',
                appliedLocalFilters: false,
            });
        }
    }

    const response = await searchDocumentsFromApi({
        ...remoteQuery,
        search: filters.searchQuery,
    });

    if (!response.ok) {
        throw new Error(response.error || 'No se pudo buscar documentos.');
    }

    const rawItems = extractDocumentsCollection(response.data);
    const visibleItems = applyLocalFilters(rawItems, filters);
    const appliedLocalFilters = visibleItems.length !== rawItems.length;

    queueCachePersistence({
        cacheKey,
        mode: 'search',
        page: 1,
        params: {
            ...remoteQuery,
            search: filters.searchQuery,
        },
        items: rawItems,
        totalPages: 1,
        totalDocuments: rawItems.length,
        perPage: rawItems.length || DEFAULT_PER_PAGE,
        serverTimestamp,
    });

    return buildListingResponse({
        items: visibleItems,
        page: 1,
        totalPages: 1,
        totalDocuments: rawItems.length,
        perPage: rawItems.length || DEFAULT_PER_PAGE,
        source: 'api-search',
        appliedLocalFilters,
    });
}

async function getDocumentListingPage(options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const forceRefresh = Boolean(options.forceRefresh);
    const filters = normalizeFilters(options.filters);

    if (filters.searchQuery) {
        return await searchDocuments(filters, forceRefresh);
    }

    const remoteFilterQuery = buildRemoteFilterQuery(filters, { includeSort: false });
    const remotePageQuery = buildRemotePageQuery(filters);
    const cacheKey = buildCacheKey(Object.keys(remoteFilterQuery).length > 0 ? 'filtered' : 'list', remotePageQuery);
    const serverTimestamp = await ensureListingCacheFresh(forceRefresh);

    if (!forceRefresh) {
        const cached = getCachedListingPage(cacheKey, page, filters);
        if (cached) {
            return cached;
        }
    }

    return await fetchListingPageFromApi(page, filters, remotePageQuery, remoteFilterQuery, serverTimestamp);
}

async function invalidateDocumentListingCache() {
    clearDocumentQueryCache();
    setDocumentsListingMeta(new Date().toISOString(), null);
    return { ok: true };
}

module.exports = {
    getDocumentListingPage,
    invalidateDocumentListingCache,
};
