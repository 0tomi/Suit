const DEFAULT_PAGE = 1;
const DEFAULT_TOTAL_PAGES = 1;
const DEFAULT_PER_PAGE = 20;

function parseJsonSafely(value) {
    if (!value || typeof value !== 'string') return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function buildCacheKey(mode, params = {}) {
    const serializedParams = Object.entries(params)
        .filter(([, value]) => value !== undefined && value !== null && value !== '')
        .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
        .map(([key, value]) => `${key}:${String(value)}`)
        .join('|');

    return serializedParams ? `${mode}::${serializedParams}` : mode;
}

function extractCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.result?.data)) return payload.result.data;
    return [];
}

function extractPaginationMeta(payload, fallbackPerPage = DEFAULT_PER_PAGE) {
    return {
        currentPage:
            Number(payload?.meta?.current_page)
            || Number(payload?.data?.meta?.current_page)
            || Number(payload?.current_page)
            || Number(payload?.data?.current_page)
            || DEFAULT_PAGE,
        lastPage:
            Number(payload?.meta?.last_page)
            || Number(payload?.data?.meta?.last_page)
            || Number(payload?.last_page)
            || Number(payload?.data?.last_page)
            || DEFAULT_TOTAL_PAGES,
        total:
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
            || fallbackPerPage,
    };
}

function buildListingResponse({
    items,
    page = DEFAULT_PAGE,
    total = null,
    totalPages = DEFAULT_TOTAL_PAGES,
    perPage = DEFAULT_PER_PAGE,
    source = 'cache',
    appliedLocalFilters = false,
}) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedPerPage = Math.max(1, Number(perPage) || DEFAULT_PER_PAGE);
    const normalizedTotal = total ?? normalizedItems.length;

    return {
        items: normalizedItems,
        page: Math.max(1, Number(page) || DEFAULT_PAGE),
        total: Math.max(0, Number(normalizedTotal) || 0),
        totalPages: Math.max(1, Number(totalPages) || DEFAULT_TOTAL_PAGES),
        perPage: normalizedPerPage,
        source,
        appliedLocalFilters,
        // Alias temporal para compatibilidad con Documentos mientras el renderer migra.
        totalDocuments: Math.max(0, Number(normalizedTotal) || 0),
    };
}

function paginateItems(items, page = DEFAULT_PAGE, perPage = DEFAULT_PER_PAGE) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedPerPage = Math.max(1, Number(perPage) || DEFAULT_PER_PAGE);
    const normalizedPage = Math.max(1, Number(page) || DEFAULT_PAGE);
    const startIndex = (normalizedPage - 1) * normalizedPerPage;

    return normalizedItems.slice(startIndex, startIndex + normalizedPerPage);
}

function buildPaginatedResponseFromItems({
    items,
    page = DEFAULT_PAGE,
    perPage = DEFAULT_PER_PAGE,
    source = 'cache',
    appliedLocalFilters = false,
}) {
    const normalizedItems = Array.isArray(items) ? items : [];
    const normalizedPerPage = Math.max(1, Number(perPage) || DEFAULT_PER_PAGE);
    const normalizedPage = Math.max(1, Number(page) || DEFAULT_PAGE);
    const total = normalizedItems.length;
    const totalPages = Math.max(1, Math.ceil(total / normalizedPerPage));

    return buildListingResponse({
        items: paginateItems(normalizedItems, normalizedPage, normalizedPerPage),
        page: normalizedPage,
        total,
        totalPages,
        perPage: normalizedPerPage,
        source,
        appliedLocalFilters,
    });
}

function isOfflineLikeError(response) {
    return !response?.ok && Number(response?.status) === 0;
}

function canReuseListingSnapshot(snapshot, meta, serverTimestamp) {
    const hydratedSnapshot = snapshot && typeof snapshot === 'object' ? snapshot : null;
    if (!hydratedSnapshot) return false;

    const localServerTimestamp = typeof meta?.last_server === 'string' && meta.last_server.trim()
        ? meta.last_server.trim()
        : null;
    const normalizedServerTimestamp = typeof serverTimestamp === 'string' && serverTimestamp.trim()
        ? serverTimestamp.trim()
        : null;

    if (localServerTimestamp && normalizedServerTimestamp) {
        return localServerTimestamp === normalizedServerTimestamp;
    }

    if (!localServerTimestamp && !normalizedServerTimestamp) {
        const totalItems = Number(
            hydratedSnapshot.total_items
            ?? hydratedSnapshot.totalItems
            ?? hydratedSnapshot.items?.length
            ?? 0
        );

        return totalItems === 0;
    }

    return false;
}

module.exports = {
    DEFAULT_PAGE,
    DEFAULT_PER_PAGE,
    buildCacheKey,
    canReuseListingSnapshot,
    buildListingResponse,
    buildPaginatedResponseFromItems,
    extractCollection,
    extractPaginationMeta,
    isOfflineLikeError,
    paginateItems,
    parseJsonSafely,
};
