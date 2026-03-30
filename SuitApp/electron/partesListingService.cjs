const { getAll } = require('./database.cjs');
const { listPartesFromApi, getPartesLastModifiedFromApi } = require('./partesApi.cjs');
const { upsertCachedPartes } = require('./partesRepository.cjs');
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
    isOfflineLikeError,
    paginateItems,
    parseJsonSafely,
} = require('./listingBackendUtils.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('partes:listing:service');
const PARTES_LISTING_ENTITY = 'partes';
const PARTES_DEFAULT_PER_PAGE = 30;
const ALLOWED_SORT_FIELDS = new Set(['created_at', 'alpha']);
const ALLOWED_SORT_DIRECTIONS = new Set(['asc', 'desc']);
const PARTES_NAME_COLLATOR = new Intl.Collator('es', {
    sensitivity: 'base',
    numeric: true,
});

function normalizeFilters(rawFilters = {}) {
    return {
        searchTerm: typeof rawFilters.searchTerm === 'string' ? rawFilters.searchTerm.trim() : '',
        sortBy: ALLOWED_SORT_FIELDS.has(rawFilters.sortBy) ? rawFilters.sortBy : 'created_at',
        sortDirection: ALLOWED_SORT_DIRECTIONS.has(rawFilters.sortDirection ?? rawFilters.sortOrder)
            ? (rawFilters.sortDirection ?? rawFilters.sortOrder)
            : 'desc',
    };
}

function buildRolesMap() {
    return new Map(
        getAll('roles').map((row) => {
            const payload = parseJsonSafely(row.data_json);
            const role = payload ? { ...row, ...payload } : row;
            return [String(role.id), role.titulo || ''];
        }),
    );
}

function getParteFullName(parte) {
    return `${parte?.nombre || ''} ${parte?.apellido || ''}`.trim();
}

function matchesParteSearch(parte, searchTerm, rolesMap) {
    if (!searchTerm) return true;
    const normalizedSearch = searchTerm.toLowerCase();
    const roleName = rolesMap.get(String(parte?.rol_id)) || '';

    return [
        getParteFullName(parte),
        roleName,
        parte?.identificacion,
        parte?.email,
        parte?.telefono,
        parte?.direccion,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
}

function sortPartes(partes, filters) {
    const sorted = [...partes];

    sorted.sort((left, right) => {
        if (filters.sortBy === 'alpha') {
            const comparison = PARTES_NAME_COLLATOR.compare(
                getParteFullName(left),
                getParteFullName(right),
            );
            return filters.sortDirection === 'asc' ? comparison : -comparison;
        }

        const leftTimestamp = new Date(left?.created_at || 0).getTime();
        const rightTimestamp = new Date(right?.created_at || 0).getTime();
        const delta = rightTimestamp - leftTimestamp;
        return filters.sortDirection === 'asc' ? -delta : delta;
    });

    return sorted;
}

function buildSnapshotResponse(snapshot, source = 'cache-snapshot') {
    if (!snapshot || !Array.isArray(snapshot.items)) {
        return buildListingResponse({
            items: [],
            page: 1,
            total: 0,
            totalPages: 1,
            perPage: PARTES_DEFAULT_PER_PAGE,
            source: 'cache-snapshot-miss',
        });
    }

    return buildListingResponse({
        items: snapshot.items,
        page: snapshot.page,
        total: snapshot.total_items ?? snapshot.items.length,
        totalPages: snapshot.total_pages ?? 1,
        perPage: snapshot.per_page ?? PARTES_DEFAULT_PER_PAGE,
        source,
    });
}

async function getParteListingPage(options = {}) {
    const page = Math.max(1, Number(options.page) || 1);
    const filters = normalizeFilters(options.filters);
    const rolesMap = buildRolesMap();
    const cacheKey = buildCacheKey('list', filters);
    const snapshot = getCachedListingPage(PARTES_LISTING_ENTITY, cacheKey, page);
    const listingMeta = getListingMeta(PARTES_LISTING_ENTITY);
    let lastServer = listingMeta?.last_server ?? null;

    if (snapshot) {
        try {
            const lastModifiedResponse = await getPartesLastModifiedFromApi();
            if (!lastModifiedResponse.ok) {
                if (isOfflineLikeError(lastModifiedResponse)) {
                    return buildSnapshotResponse(snapshot);
                }

                logger.warn('partes listing last-modified failed before reusing snapshot', {
                    status: lastModifiedResponse.status,
                    error: lastModifiedResponse.error || null,
                    data: lastModifiedResponse.data,
                    page,
                });
            } else {
                lastServer = lastModifiedResponse.data?.last_modified ?? lastModifiedResponse.data?.lastModified ?? null;
                if (canReuseListingSnapshot(snapshot, listingMeta, lastServer)) {
                    return buildSnapshotResponse(snapshot, 'cache-validated');
                }
            }
        } catch (error) {
            logger.warn('partes listing could not read last-modified before revalidation', {
                error: error?.message || String(error),
                page,
            });
        }
    }

    const response = await listPartesFromApi();

    if (!response.ok) {
        if (isOfflineLikeError(response)) {
            return buildSnapshotResponse(getCachedListingPage(PARTES_LISTING_ENTITY, cacheKey, page));
        }

        throw new Error(response.error || 'No se pudo obtener el listado de partes.');
    }

    const remoteItems = extractCollection(response.data);
    const filteredItems = sortPartes(
        remoteItems.filter((parte) => matchesParteSearch(parte, filters.searchTerm, rolesMap)),
        filters,
    );
    const total = filteredItems.length;
    const totalPages = Math.max(1, Math.ceil(total / PARTES_DEFAULT_PER_PAGE));
    const pageItems = paginateItems(filteredItems, page, PARTES_DEFAULT_PER_PAGE);

    void Promise.resolve().then(() => {
        upsertCachedPartes(remoteItems);
        upsertCachedListingPage(buildListingCacheEntry({
            entity: PARTES_LISTING_ENTITY,
            cacheKey,
            mode: 'list',
            page,
            params: filters,
            items: pageItems,
            totalPages,
            totalItems: total,
            perPage: PARTES_DEFAULT_PER_PAGE,
        }));

        if (lastServer !== undefined) {
            setListingMeta(PARTES_LISTING_ENTITY, new Date().toISOString(), lastServer);
        }
    }).catch((error) => {
        logger.warn('failed to persist partes listing snapshot', {
            cacheKey,
            page,
            error: error?.message || String(error),
        });
    });

    return buildListingResponse({
        items: pageItems,
        page,
        total,
        totalPages,
        perPage: PARTES_DEFAULT_PER_PAGE,
        source: 'api',
        appliedLocalFilters: Boolean(filters.searchTerm),
    });
}

async function invalidateParteListingCache() {
    clearListingQueryCache(PARTES_LISTING_ENTITY);
    setListingMeta(PARTES_LISTING_ENTITY, new Date().toISOString(), null);
    return { ok: true };
}

module.exports = {
    getParteListingPage,
    invalidateParteListingCache,
};
