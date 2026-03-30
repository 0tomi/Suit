const {
    getGastosStatsFromApi,
    getHonorariosStatsFromApi,
    listGastosByDateRangeFromApi,
    listHonorariosByDateRangeFromApi,
} = require('./economiaApi.cjs');
const {
    buildListingCacheEntry,
    clearListingQueryCache,
    getCachedListingPage,
    setListingMeta,
    upsertCachedListingPage,
} = require('./listingCacheRepository.cjs');
const {
    buildCacheKey,
    buildListingResponse,
    extractCollection,
    extractPaginationMeta,
    isOfflineLikeError,
} = require('./listingBackendUtils.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('economia:listing:service');
const HONORARIOS_LISTING_ENTITY = 'economia_honorarios';
const GASTOS_LISTING_ENTITY = 'economia_gastos';
const ECONOMIA_DEFAULT_PER_PAGE = 30;
const ALLOWED_SORT_FIELDS = new Set(['created_at', 'monto']);
const ALLOWED_SORT_DIRECTIONS = new Set(['asc', 'desc']);

function normalizeListingFilters(rawFilters = {}) {
    return {
        from: typeof rawFilters.from === 'string' ? rawFilters.from.trim() : '',
        to: typeof rawFilters.to === 'string' ? rawFilters.to.trim() : '',
        userId: Number(rawFilters.userId ?? rawFilters.user_id) > 0
            ? Number(rawFilters.userId ?? rawFilters.user_id)
            : null,
        searchTerm: typeof rawFilters.searchTerm === 'string' ? rawFilters.searchTerm.trim() : '',
        status: typeof rawFilters.status === 'string' ? rawFilters.status.trim() : 'all',
        sortBy: ALLOWED_SORT_FIELDS.has(rawFilters.sortBy) ? rawFilters.sortBy : 'created_at',
        sortDirection: ALLOWED_SORT_DIRECTIONS.has(rawFilters.sortDirection ?? rawFilters.sortOrder)
            ? (rawFilters.sortDirection ?? rawFilters.sortOrder)
            : 'desc',
    };
}

function buildEconomiaRemoteQuery(page, filters) {
    if (!filters.from || !filters.to) {
        throw new Error('La consulta de economía requiere fechas desde y hasta.');
    }

    const query = {
        from: filters.from,
        to: filters.to,
        ...(filters.userId ? { user_id: filters.userId } : {}),
    };

    if (page) {
        query.page = page;
    }

    return query;
}

async function fetchAllEconomiaItems(listFromApi, filters) {
    const baseQuery = buildEconomiaRemoteQuery(1, filters);
    const allItems = [];
    let page = 1;
    let totalPages = 1;
    let perPage = ECONOMIA_DEFAULT_PER_PAGE;

    while (page <= totalPages) {
        const response = await listFromApi({ ...baseQuery, page });
        if (!response.ok) {
            return { ok: false, response };
        }

        const items = extractCollection(response.data);
        const meta = extractPaginationMeta(response.data, ECONOMIA_DEFAULT_PER_PAGE);
        allItems.push(...items);
        totalPages = meta.lastPage;
        perPage = meta.perPage;
        page += 1;
    }

    return { ok: true, items: allItems, perPage };
}

function matchesHonorarioFilters(honorario, filters) {
    if (!honorario || typeof honorario !== 'object') return false;

    if (filters.status !== 'all') {
        const shouldBePaid = filters.status === 'paid';
        if (Boolean(honorario.pagado) !== shouldBePaid) return false;
    }

    if (!filters.searchTerm) return true;
    const normalizedSearch = filters.searchTerm.toLowerCase();

    return [
        honorario?.suit_case?.title,
        honorario?.client?.first_name,
        honorario?.client?.last_name,
        honorario?.client_name,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
}

function matchesGastoFilters(gasto, filters) {
    if (!gasto || typeof gasto !== 'object') return false;
    if (!filters.searchTerm) return true;
    const normalizedSearch = filters.searchTerm.toLowerCase();

    return [
        gasto?.suit_case?.title,
        gasto?.gasto?.titulo,
        gasto?.gasto?.name,
    ].some((value) => String(value || '').toLowerCase().includes(normalizedSearch));
}

function sortEconomiaItems(items, filters) {
    const sorted = [...items];

    sorted.sort((left, right) => {
        if (filters.sortBy === 'monto') {
            const delta = (Number(right?.monto) || 0) - (Number(left?.monto) || 0);
            return filters.sortDirection === 'asc' ? -delta : delta;
        }

        const leftValue = String(left?.created_at || '');
        const rightValue = String(right?.created_at || '');
        const comparison = rightValue.localeCompare(leftValue, 'es');
        return filters.sortDirection === 'asc' ? -comparison : comparison;
    });

    return sorted;
}

function buildSnapshotResponse(snapshot, fallbackEntity) {
    if (!snapshot || !Array.isArray(snapshot.items)) {
        return buildListingResponse({
            items: [],
            page: 1,
            total: 0,
            totalPages: 1,
            perPage: ECONOMIA_DEFAULT_PER_PAGE,
            source: `${fallbackEntity}-cache-snapshot-miss`,
        });
    }

    return buildListingResponse({
        items: snapshot.items,
        page: snapshot.page,
        total: snapshot.total_items ?? snapshot.items.length,
        totalPages: snapshot.total_pages ?? 1,
        perPage: snapshot.per_page ?? ECONOMIA_DEFAULT_PER_PAGE,
        source: `${fallbackEntity}-cache-snapshot`,
    });
}

async function getEconomiaListingPage({
    entity,
    listFromApi,
    options = {},
    matcher,
}) {
    const page = Math.max(1, Number(options.page) || 1);
    const filters = normalizeListingFilters(options.filters);
    const cacheKey = buildCacheKey('list', {
        ...buildEconomiaRemoteQuery(1, filters),
        searchTerm: filters.searchTerm,
        status: filters.status,
        sortBy: filters.sortBy,
        sortDirection: filters.sortDirection,
    });

    const fetched = await fetchAllEconomiaItems(listFromApi, filters);
    if (!fetched.ok) {
        if (isOfflineLikeError(fetched.response)) {
            return buildSnapshotResponse(getCachedListingPage(entity, cacheKey, page), entity);
        }

        throw new Error(fetched.response.error || 'No se pudo obtener el listado de economía.');
    }

    const items = fetched.items;
    const visibleItems = sortEconomiaItems(items.filter((item) => matcher(item, filters)), filters);
    const total = visibleItems.length;
    const totalPages = Math.max(1, Math.ceil(total / fetched.perPage));
    const pageItems = visibleItems.slice((page - 1) * fetched.perPage, page * fetched.perPage);

    void Promise.resolve().then(() => {
        upsertCachedListingPage(buildListingCacheEntry({
            entity,
            cacheKey,
            mode: 'list',
            page,
            params: filters,
            items: pageItems,
            totalPages,
            totalItems: total,
            perPage: fetched.perPage,
        }));
        setListingMeta(entity, new Date().toISOString(), `${filters.from}:${filters.to}`);
    }).catch((error) => {
        logger.warn('failed to persist economia listing snapshot', {
            entity,
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
        perPage: fetched.perPage,
        source: 'api',
        appliedLocalFilters: visibleItems.length !== items.length,
    });
}

async function getHonorariosListingPage(options = {}) {
    return await getEconomiaListingPage({
        entity: HONORARIOS_LISTING_ENTITY,
        listFromApi: listHonorariosByDateRangeFromApi,
        options,
        matcher: matchesHonorarioFilters,
    });
}

async function getGastosListingPage(options = {}) {
    return await getEconomiaListingPage({
        entity: GASTOS_LISTING_ENTITY,
        listFromApi: listGastosByDateRangeFromApi,
        options,
        matcher: matchesGastoFilters,
    });
}

async function getHonorariosStats(options = {}) {
    const filters = normalizeListingFilters(options.filters);
    const response = await getHonorariosStatsFromApi(buildEconomiaRemoteQuery(null, filters));
    if (!response.ok) {
        throw new Error(response.error || 'No se pudieron obtener las estadísticas de honorarios.');
    }

    return Array.isArray(response.data) ? response.data : [];
}

async function getGastosStats(options = {}) {
    const filters = normalizeListingFilters(options.filters);
    const response = await getGastosStatsFromApi(buildEconomiaRemoteQuery(null, filters));
    if (!response.ok) {
        throw new Error(response.error || 'No se pudieron obtener las estadísticas de gastos.');
    }

    return Array.isArray(response.data) ? response.data : [];
}

async function invalidateEconomiaListingCache() {
    clearListingQueryCache(HONORARIOS_LISTING_ENTITY);
    clearListingQueryCache(GASTOS_LISTING_ENTITY);
    setListingMeta(HONORARIOS_LISTING_ENTITY, new Date().toISOString(), null);
    setListingMeta(GASTOS_LISTING_ENTITY, new Date().toISOString(), null);
    return { ok: true };
}

module.exports = {
    getGastosListingPage,
    getGastosStats,
    getHonorariosListingPage,
    getHonorariosStats,
    invalidateEconomiaListingCache,
};
