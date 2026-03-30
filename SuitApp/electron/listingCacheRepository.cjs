const {
    clearTable,
    deleteWhere,
    getById,
    getSyncMeta,
    setSyncMeta,
    upsertMany,
} = require('./database.cjs');

const LISTING_QUERY_CACHE_TABLE = 'listing_query_cache';

function parseJsonSafely(value) {
    if (!value || typeof value !== 'string') return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function buildListingCacheEntry({
    entity,
    cacheKey,
    mode,
    page = 1,
    params = null,
    itemIds = null,
    items = null,
    totalPages = null,
    totalItems = null,
    perPage = null,
}) {
    const normalizedEntity = String(entity || '').trim();
    const normalizedPage = Math.max(1, Number(page) || 1);

    if (!normalizedEntity) {
        throw new Error('No se puede persistir un snapshot de listado sin entity.');
    }

    return {
        id: `${normalizedEntity}::${cacheKey}::${normalizedPage}`,
        entity: normalizedEntity,
        cache_key: cacheKey,
        mode,
        page: normalizedPage,
        params_json: params ? JSON.stringify(params) : null,
        item_ids_json: Array.isArray(itemIds) ? JSON.stringify(itemIds) : null,
        items_json: Array.isArray(items) ? JSON.stringify(items) : null,
        total_pages: totalPages ?? null,
        total_items: totalItems ?? null,
        per_page: perPage ?? null,
        cached_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
    };
}

function hydrateListingCacheRow(row) {
    if (!row || typeof row !== 'object') return null;

    return {
        ...row,
        params: parseJsonSafely(row.params_json),
        itemIds: parseJsonSafely(row.item_ids_json),
        items: parseJsonSafely(row.items_json),
    };
}

function getCachedListingPage(entity, cacheKey, page = 1) {
    const cacheId = `${String(entity).trim()}::${cacheKey}::${Math.max(1, Number(page) || 1)}`;
    return hydrateListingCacheRow(getById(LISTING_QUERY_CACHE_TABLE, cacheId));
}

function upsertCachedListingPage(entry) {
    if (!entry) return;
    upsertMany(LISTING_QUERY_CACHE_TABLE, [entry]);
}

function clearListingQueryCache(entity = null) {
    if (!entity) {
        clearTable(LISTING_QUERY_CACHE_TABLE);
        return;
    }

    deleteWhere(LISTING_QUERY_CACHE_TABLE, { entity: String(entity).trim() });
}

function getListingMeta(entity) {
    const normalizedEntity = String(entity).trim();
    return getSyncMeta(`${normalizedEntity}_listing`) || getSyncMeta(normalizedEntity);
}

function setListingMeta(entity, lastSync, lastServer) {
    setSyncMeta(`${String(entity).trim()}_listing`, lastSync, lastServer);
}

module.exports = {
    LISTING_QUERY_CACHE_TABLE,
    buildListingCacheEntry,
    clearListingQueryCache,
    getCachedListingPage,
    getListingMeta,
    hydrateListingCacheRow,
    setListingMeta,
    upsertCachedListingPage,
};
