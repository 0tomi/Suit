const { getAll, upsertMany } = require('./database.cjs');
const { getCasesLastModifiedFromApi, listCasesFromApi, searchCasesFromApi } = require('./casesApi.cjs');
const {
    buildListingCacheEntry,
    clearListingQueryCache,
    getCachedListingPage,
    getListingMeta,
    setListingMeta,
    upsertCachedListingPage,
} = require('./listingCacheRepository.cjs');
const {
    buildCacheKey,
    canReuseListingSnapshot,
    buildListingResponse,
    buildPaginatedResponseFromItems,
    extractCollection,
    extractPaginationMeta,
    isOfflineLikeError,
    parseJsonSafely,
} = require('./listingBackendUtils.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('cases:listing:service');
const CASES_LISTING_ENTITY = 'cases';
const CASES_DEFAULT_PER_PAGE = 40;
const ALLOWED_SORT_FIELDS = new Set(['updated_at', 'start_date']);
const ALLOWED_SORT_DIRECTIONS = new Set(['asc', 'desc']);

function hydrateCaseRow(row) {
    if (!row || typeof row !== 'object') return null;
    const payload = parseJsonSafely(row.data_json);
    return payload ? { ...row, ...payload } : row;
}

function buildCaseCacheRow(caseItem, existingCase = null) {
    const fallback = hydrateCaseRow(existingCase);
    const normalized = caseItem && typeof caseItem === 'object' ? caseItem : {};
    const caseId = Number(normalized.id ?? fallback?.id);

    if (!Number.isInteger(caseId) || caseId < 1) {
        throw new Error('No se pudo construir la fila de caché del caso sin un id válido.');
    }

    const merged = {
        ...(fallback || {}),
        ...normalized,
        id: caseId,
    };

    return {
        id: caseId,
        title: merged.title ?? null,
        case_type: merged.case_type ?? null,
        case_type_id: merged.case_type_id ?? null,
        status: merged.status ?? null,
        owner_tag: merged.owner_tag ?? null,
        start_date: merged.start_date ?? null,
        end_date: merged.end_date ?? null,
        details: merged.details ?? null,
        nro_expediente: merged.nro_expediente ?? null,
        radicacion_id: merged.radicacion_id ?? null,
        dependencia_id: merged.dependencia_id ?? null,
        updated_at: merged.updated_at ?? merged.created_at ?? null,
        data_json: JSON.stringify(merged),
        synced_at: new Date().toISOString(),
    };
}

function listCachedCases() {
    return getAll('cases').map(hydrateCaseRow).filter(Boolean);
}

function upsertCachedCases(caseItems = []) {
    if (!Array.isArray(caseItems) || caseItems.length === 0) return;

    const existingCases = new Map(getAll('cases').map((row) => [String(row.id), row]));
    const rows = caseItems.map((caseItem) =>
        buildCaseCacheRow(caseItem, existingCases.get(String(caseItem?.id)) || null)
    );

    upsertMany('cases', rows);
}

function normalizeFilters(rawFilters = {}) {
    const normalizedStatus = String(rawFilters.status ?? rawFilters.statusFilter ?? 'all').trim().toLowerCase();
    const normalizedTypeId = Number(rawFilters.caseTypeId ?? rawFilters.case_type_id ?? rawFilters.typeFilter ?? 0);

    return {
        searchTerm: typeof rawFilters.searchTerm === 'string' ? rawFilters.searchTerm.trim() : '',
        status: ['all', 'active', 'closed'].includes(normalizedStatus)
            ? normalizedStatus
            : (normalizedStatus === 'activo' ? 'active' : (normalizedStatus === 'finalizado' ? 'closed' : 'all')),
        caseTypeId: Number.isInteger(normalizedTypeId) && normalizedTypeId > 0 ? normalizedTypeId : null,
        sortBy: ALLOWED_SORT_FIELDS.has(rawFilters.sortBy) ? rawFilters.sortBy : 'updated_at',
        sortDirection: ALLOWED_SORT_DIRECTIONS.has(rawFilters.sortDirection ?? rawFilters.sortOrder)
            ? (rawFilters.sortDirection ?? rawFilters.sortOrder)
            : 'desc',
    };
}

function matchesStatusFilter(caseItem, status) {
    if (status === 'all') return true;
    if (status === 'closed') return String(caseItem?.status || '').toLowerCase() === 'closed' || Boolean(caseItem?.end_date);
    return String(caseItem?.status || '').toLowerCase() !== 'closed' && !caseItem?.end_date;
}

function matchesSearchTerm(caseItem, searchTerm) {
    if (!searchTerm) return true;
    const normalizedSearch = searchTerm.toLowerCase();

    return [
        caseItem?.title,
        caseItem?.owner_tag,
        caseItem?.nro_expediente,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
}

function matchesLocalFilters(caseItem, filters) {
    if (!caseItem || typeof caseItem !== 'object') return false;
    if (!matchesStatusFilter(caseItem, filters.status)) return false;
    if (filters.caseTypeId && Number(caseItem.case_type_id) !== Number(filters.caseTypeId)) return false;
    if (!matchesSearchTerm(caseItem, filters.searchTerm)) return false;
    return true;
}

function sortCases(caseItems, filters) {
    const sorted = [...caseItems];

    sorted.sort((left, right) => {
        const leftValue = String(left?.[filters.sortBy] || '');
        const rightValue = String(right?.[filters.sortBy] || '');
        const comparison = rightValue.localeCompare(leftValue, 'es');

        return filters.sortDirection === 'asc' ? -comparison : comparison;
    });

    return sorted;
}

function buildRemoteQuery(page, filters) {
    const query = { page };

    if (filters.status !== 'all') {
        query.status = filters.status;
    }

    if (filters.caseTypeId) {
        query.case_type_id = filters.caseTypeId;
    }

    query.sort_by = filters.sortBy;
    query.sort_direction = filters.sortDirection;

    return query;
}

function queueCaseListingPersistence({ cacheKey, page, filters, items, totalPages, total, perPage, lastServer }) {
    void Promise.resolve().then(() => {
        upsertCachedCases(items);
        upsertCachedListingPage(buildListingCacheEntry({
            entity: CASES_LISTING_ENTITY,
            cacheKey,
            mode: 'list',
            page,
            params: filters,
            itemIds: items.map((item) => Number(item.id)).filter(Number.isFinite),
            totalPages,
            totalItems: total,
            perPage,
        }));

        if (lastServer !== undefined) {
            setListingMeta(CASES_LISTING_ENTITY, new Date().toISOString(), lastServer);
        }
    }).catch((error) => {
        logger.warn('failed to persist cases listing snapshot', {
            cacheKey,
            page,
            error: error?.message || String(error),
        });
    });
}

function buildOfflineCasesResponse(page, filters, source = 'cache-reconstructed') {
    const allLocalCases = listCachedCases();
    const filteredCases = sortCases(allLocalCases.filter((caseItem) => matchesLocalFilters(caseItem, filters)), filters);

    return buildPaginatedResponseFromItems({
        items: filteredCases,
        page,
        perPage: CASES_DEFAULT_PER_PAGE,
        source,
    });
}

async function getCaseSearchResults(filters) {
    const query = { search: filters.searchTerm };
    if (filters.status !== 'all') query.status = filters.status;
    if (filters.caseTypeId) query.case_type_id = filters.caseTypeId;

    const response = await searchCasesFromApi(query);
    if (!response.ok) {
        if (isOfflineLikeError(response)) {
            return buildOfflineCasesResponse(1, filters);
        }
        throw new Error(response.error || 'No se pudo buscar los casos.');
    }

    const items = extractCollection(response.data);
    void Promise.resolve().then(() => upsertCachedCases(items)).catch(() => {});

    return buildListingResponse({
        items,
        page: 1,
        total: items.length,
        totalPages: 1,
        perPage: 20,
        source: 'api',
        appliedLocalFilters: false,
    });
}

async function getCaseListingPage(options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const filters = normalizeFilters(options.filters);

    if (filters.searchTerm) {
        return getCaseSearchResults(filters);
    }

    const cacheKey = buildCacheKey('list', buildRemoteQuery(page, filters));
    const snapshot = getCachedListingPage(CASES_LISTING_ENTITY, cacheKey, page);
    const listingMeta = getListingMeta(CASES_LISTING_ENTITY);
    let lastServer = listingMeta?.last_server ?? null;

    if (snapshot) {
        try {
            const lastModifiedResponse = await getCasesLastModifiedFromApi();
            if (!lastModifiedResponse.ok) {
                if (isOfflineLikeError(lastModifiedResponse)) {
                    return buildOfflineCasesResponse(page, filters);
                }

                logger.warn('cases listing last-modified failed before reusing snapshot', {
                    status: lastModifiedResponse.status,
                    error: lastModifiedResponse.error || null,
                    data: lastModifiedResponse.data,
                    page,
                });
            } else {
                lastServer = lastModifiedResponse.data?.last_modified ?? null;
                if (canReuseListingSnapshot(snapshot, listingMeta, lastServer)) {
                    return buildOfflineCasesResponse(page, filters, 'cache-validated');
                }
            }
        } catch (error) {
            logger.warn('cases listing could not read last-modified before revalidation', {
                error: error?.message || String(error),
                page,
            });
        }
    }

    const response = await listCasesFromApi(buildRemoteQuery(page, filters));
    if (!response.ok) {
        if (isOfflineLikeError(response)) {
            return buildOfflineCasesResponse(page, filters);
        }

        throw new Error(response.error || 'No se pudo obtener el listado de casos.');
    }

    const items = extractCollection(response.data);
    const meta = extractPaginationMeta(response.data, CASES_DEFAULT_PER_PAGE);
    const visibleItems = items.filter((caseItem) => matchesLocalFilters(caseItem, filters));
    const appliedLocalFilters = visibleItems.length !== items.length || Boolean(filters.searchTerm);

    queueCaseListingPersistence({
        cacheKey,
        page,
        filters,
        items,
        totalPages: meta.lastPage,
        total: meta.total ?? items.length,
        perPage: meta.perPage,
        lastServer,
    });

    return buildListingResponse({
        items: visibleItems,
        page: meta.currentPage,
        total: meta.total ?? items.length,
        totalPages: meta.lastPage,
        perPage: meta.perPage,
        source: 'api',
        appliedLocalFilters,
    });
}

async function invalidateCaseListingCache() {
    clearListingQueryCache(CASES_LISTING_ENTITY);
    setListingMeta(CASES_LISTING_ENTITY, new Date().toISOString(), null);
    return { ok: true };
}

module.exports = {
    getCaseListingPage,
    invalidateCaseListingCache,
};
