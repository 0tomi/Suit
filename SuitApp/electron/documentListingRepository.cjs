const {
    clearTable,
    getAll,
    getById,
    getSyncMeta,
    setSyncMeta,
    upsertMany,
} = require('./database.cjs');
const { getLogger } = require('./logService.cjs');

const DOCUMENTS_TABLE = 'documents';
const QUERY_CACHE_TABLE = 'document_query_cache';
const LISTING_META_KEY = 'documents_listing';
const logger = getLogger('documents:listing:repository');

function parseJsonSafely(value) {
    if (!value || typeof value !== 'string') return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function hydrateDocumentRow(row) {
    if (!row || typeof row !== 'object') return null;

    const payload = parseJsonSafely(row.data_json);
    return payload ? { ...row, ...payload } : row;
}

function buildDocumentCacheRow(document, existingDocument = null) {
    const fallback = hydrateDocumentRow(existingDocument);
    const normalized = document && typeof document === 'object' ? document : {};
    const documentId = Number(normalized.id ?? fallback?.id);

    if (!Number.isInteger(documentId) || documentId < 1) {
        throw new Error('No se pudo construir la fila de caché del documento sin un id válido.');
    }

    const merged = {
        ...(fallback || {}),
        ...normalized,
        id: documentId,
    };

    return {
        id: documentId,
        name: merged.name || merged.title || 'Sin título',
        suit_case_id: merged.suit_case_id ?? null,
        user_id: merged.user_id ?? null,
        content: fallback?.content ?? null,
        is_locked: merged.is_locked ? 1 : 0,
        locked_by: merged.locked_by ?? null,
        locker_name: merged.locker_name ?? merged.locker?.name ?? null,
        status: merged.status || 'Borrador',
        latest_version_number: merged.latest_version?.version_number ?? merged.latest_version_number ?? null,
        latest_version_created_by: merged.latest_version?.created_by ?? merged.latest_version_created_by ?? null,
        latest_version_creator_name:
            merged.latest_version?.creator?.name
            ?? merged.latest_version_creator_name
            ?? null,
        latest_version_creator_tag:
            merged.latest_version?.creator?.tag
            ?? merged.latest_version_creator_tag
            ?? null,
        created_at: merged.created_at ?? null,
        updated_at: merged.updated_at ?? merged.created_at ?? null,
        data_json: JSON.stringify(merged),
        synced_at: new Date().toISOString(),
    };
}

function listCachedDocuments() {
    return getAll(DOCUMENTS_TABLE).map(hydrateDocumentRow).filter(Boolean);
}

function getCachedDocumentById(id) {
    return hydrateDocumentRow(getById(DOCUMENTS_TABLE, id));
}

function upsertCachedDocuments(documents) {
    if (!Array.isArray(documents) || documents.length === 0) return;

    const rows = documents.map((document) => {
        const existing = getCachedDocumentById(document?.id);
        return buildDocumentCacheRow(document, existing);
    });

    upsertMany(DOCUMENTS_TABLE, rows);
}

function buildQueryCacheEntry({
    cacheKey,
    mode,
    page = 1,
    params = null,
    documentIds = [],
    totalPages = null,
    totalDocuments = null,
    perPage = null,
}) {
    const normalizedPage = Number(page) || 1;
    const id = `${cacheKey}::${normalizedPage}`;

    return {
        id,
        cache_key: cacheKey,
        mode,
        page: normalizedPage,
        params_json: params ? JSON.stringify(params) : null,
        document_ids_json: JSON.stringify(documentIds.map((currentId) => Number(currentId)).filter(Number.isFinite)),
        total_pages: totalPages ?? null,
        total_documents: totalDocuments ?? null,
        per_page: perPage ?? null,
        cached_at: new Date().toISOString(),
        synced_at: new Date().toISOString(),
    };
}

function hydrateQueryCacheRow(row) {
    if (!row || typeof row !== 'object') return null;
    const parsedParams = parseJsonSafely(row.params_json);
    const parsedDocumentIds = parseJsonSafely(row.document_ids_json);

    return {
        ...row,
        params: parsedParams,
        documentIds: Array.isArray(parsedDocumentIds)
            ? parsedDocumentIds
            : [],
    };
}

function getCachedDocumentQuery(cacheKey, page = 1) {
    const cacheId = `${cacheKey}::${Number(page) || 1}`;
    const row = getById(QUERY_CACHE_TABLE, cacheId);
    return hydrateQueryCacheRow(row);
}

function upsertCachedDocumentQuery(entry) {
    if (!entry) return;
    upsertMany(QUERY_CACHE_TABLE, [entry]);
}

function clearDocumentQueryCache() {
    clearTable(QUERY_CACHE_TABLE);
}

function getDocumentsListingMeta() {
    return getSyncMeta(LISTING_META_KEY);
}

function setDocumentsListingMeta(lastSync, lastServer) {
    setSyncMeta(LISTING_META_KEY, lastSync, lastServer);
}

function readDocumentsByIds(documentIds = []) {
    const uniqueIds = Array.from(new Set(documentIds.map((id) => Number(id)).filter(Number.isFinite)));
    if (uniqueIds.length === 0) return [];

    const documentsById = new Map(listCachedDocuments().map((document) => [Number(document.id), document]));
    const hydrated = uniqueIds
        .map((documentId) => documentsById.get(documentId))
        .filter(Boolean);

    if (hydrated.length !== uniqueIds.length) {
        logger.warn('document query cache references documents missing from local cache', {
            requestedIds: uniqueIds,
            foundIds: hydrated.map((document) => document.id),
        });
    }

    return documentIds
        .map((documentId) => documentsById.get(Number(documentId)))
        .filter(Boolean);
}

module.exports = {
    LISTING_META_KEY,
    buildDocumentCacheRow,
    buildQueryCacheEntry,
    clearDocumentQueryCache,
    getCachedDocumentById,
    getCachedDocumentQuery,
    getDocumentsListingMeta,
    hydrateDocumentRow,
    listCachedDocuments,
    readDocumentsByIds,
    setDocumentsListingMeta,
    upsertCachedDocumentQuery,
    upsertCachedDocuments,
};
