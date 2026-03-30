const { listClientsFromApi, getClientsLastModifiedFromApi } = require('./clientsApi.cjs');
const { upsertCachedClients } = require('./clientsRepository.cjs');
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
    buildListingResponse,
    canReuseListingSnapshot,
    extractCollection,
    extractPaginationMeta,
    isOfflineLikeError,
} = require('./listingBackendUtils.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('clients:listing:service');
const CLIENTS_LISTING_ENTITY = 'clients';
const CLIENTS_DEFAULT_PER_PAGE = 30;
const ALLOWED_SORT_FIELDS = new Set(['created_at', 'alpha']);
const ALLOWED_SORT_DIRECTIONS = new Set(['asc', 'desc']);

function normalizeFilters(rawFilters = {}) {
    return {
        search: typeof rawFilters.search === 'string'
            ? rawFilters.search.trim()
            : (typeof rawFilters.searchTerm === 'string' ? rawFilters.searchTerm.trim() : ''),
        type: ['person', 'company'].includes(rawFilters.type) ? rawFilters.type : '',
        status: typeof rawFilters.status === 'string' ? rawFilters.status.trim() : '',
        financialStatus: typeof rawFilters.financialStatus === 'string'
            ? rawFilters.financialStatus.trim()
            : (typeof rawFilters.financial_status === 'string' ? rawFilters.financial_status.trim() : ''),
        sortBy: ALLOWED_SORT_FIELDS.has(rawFilters.sortBy) ? rawFilters.sortBy : 'created_at',
        sortDirection: ALLOWED_SORT_DIRECTIONS.has(rawFilters.sortDirection ?? rawFilters.sortOrder)
            ? (rawFilters.sortDirection ?? rawFilters.sortOrder)
            : 'desc',
    };
}

function buildRemoteQuery(page, filters) {
    return {
        page,
        ...(filters.search ? { search: filters.search } : {}),
        ...(filters.type ? { type: filters.type } : {}),
        ...(filters.status ? { status: filters.status } : {}),
        ...(filters.financialStatus ? { financial_status: filters.financialStatus } : {}),
        sort_by: filters.sortBy,
        sort_direction: filters.sortDirection,
    };
}

function buildSnapshotResponse(snapshot, source = 'cache-snapshot') {
    if (!snapshot || !Array.isArray(snapshot.items)) {
        return buildListingResponse({
            items: [],
            page: 1,
            total: 0,
            totalPages: 1,
            perPage: CLIENTS_DEFAULT_PER_PAGE,
            source: 'cache-snapshot-miss',
        });
    }

    return buildListingResponse({
        items: snapshot.items,
        page: snapshot.page,
        total: snapshot.total_items ?? snapshot.items.length,
        totalPages: snapshot.total_pages ?? 1,
        perPage: snapshot.per_page ?? CLIENTS_DEFAULT_PER_PAGE,
        source,
    });
}

async function getClientListingPage(options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const filters = normalizeFilters(options.filters);
    const cacheKey = buildCacheKey('list', {
        ...buildRemoteQuery(1, filters),
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
    });
    const snapshot = getCachedListingPage(CLIENTS_LISTING_ENTITY, cacheKey, page);
    const listingMeta = getListingMeta(CLIENTS_LISTING_ENTITY);
    let lastServer = listingMeta?.last_server ?? null;

    if (snapshot) {
        try {
            const lastModifiedResponse = await getClientsLastModifiedFromApi();
            if (!lastModifiedResponse.ok) {
                if (isOfflineLikeError(lastModifiedResponse)) {
                    return buildSnapshotResponse(snapshot);
                }

                logger.warn('clients listing last-modified failed before reusing snapshot', {
                    status: lastModifiedResponse.status,
                    error: lastModifiedResponse.error || null,
                    data: lastModifiedResponse.data,
                    page,
                });
            } else {
                lastServer = lastModifiedResponse.data?.last_modified ?? null;
                if (canReuseListingSnapshot(snapshot, listingMeta, lastServer)) {
                    return buildSnapshotResponse(snapshot, 'cache-validated');
                }
            }
        } catch (error) {
            logger.warn('clients listing could not read last-modified before revalidation', {
                error: error?.message || String(error),
                page,
            });
        }
    }

    const response = await listClientsFromApi(buildRemoteQuery(page, filters));
    if (!response.ok) {
        if (isOfflineLikeError(response)) {
            return buildSnapshotResponse(getCachedListingPage(CLIENTS_LISTING_ENTITY, cacheKey, page));
        }

        throw new Error(response.error || 'No se pudo obtener el listado de clientes.');
    }

    const items = extractCollection(response.data);
    const meta = extractPaginationMeta(response.data, CLIENTS_DEFAULT_PER_PAGE);

    void Promise.resolve().then(() => {
        upsertCachedClients(items);
        upsertCachedListingPage(buildListingCacheEntry({
            entity: CLIENTS_LISTING_ENTITY,
            cacheKey,
            mode: 'list',
            page,
            params: filters,
            items,
            totalPages: meta.lastPage,
            totalItems: meta.total ?? items.length,
            perPage: meta.perPage,
        }));

        if (lastServer !== undefined) {
            setListingMeta(CLIENTS_LISTING_ENTITY, new Date().toISOString(), lastServer);
        }
    }).catch((error) => {
        logger.warn('failed to persist clients listing snapshot', {
            cacheKey,
            page,
            error: error?.message || String(error),
        });
    });

    return buildListingResponse({
        items,
        page: meta.currentPage,
        total: meta.total ?? items.length,
        totalPages: meta.lastPage,
        perPage: meta.perPage,
        source: 'api',
    });
}

async function invalidateClientListingCache() {
    clearListingQueryCache(CLIENTS_LISTING_ENTITY);
    setListingMeta(CLIENTS_LISTING_ENTITY, new Date().toISOString(), null);
    return { ok: true };
}

module.exports = {
    getClientListingPage,
    invalidateClientListingCache,
};
