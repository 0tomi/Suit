const { performHttpRequest } = require('./httpProxy.cjs');
const {
    getConfig,
    getAll,
    getById,
    upsertMany,
    deleteWhere,
    getSyncMeta,
    setSyncMeta,
} = require('./database.cjs');
const { getLogger } = require('./logService.cjs');

const TABLE = 'document_versions';
const logger = getLogger('documents:versions');

function getMetaKey(documentId) {
    return `document_versions:${documentId}`;
}

function buildApiUrl(pathname) {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    return `http://${host}:${port}/api${pathname}`;
}

function buildAuthHeaders() {
    const token = getConfig('auth_token');
    return token ? { Authorization: `Bearer ${token}` } : {};
}

function parseJsonSafely(value) {
    if (!value || typeof value !== 'string') return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function normalizeDocumentVersion(version, fallbackDocumentId = null) {
    if (!version || typeof version !== 'object') return null;

    const id = Number(version.id);
    const documentId = Number(
        version.document_id ??
        version.documentId ??
        version.document?.id ??
        fallbackDocumentId
    );
    if (!Number.isInteger(id) || id < 1 || !Number.isInteger(documentId) || documentId < 1) {
        return null;
    }

    const creator = version.creator?.data ?? version.creator ?? version.user ?? null;

    return {
        id,
        document_id: documentId,
        version_number: version.version_number ?? version.number ?? version.version ?? null,
        mime_type: version.mime_type ?? version.mimeType ?? null,
        size: version.size ?? null,
        created_by: version.created_by ?? creator?.id ?? null,
        creator_name: version.creator_name ?? creator?.name ?? null,
        creator_tag: version.creator_tag ?? creator?.tag ?? null,
        created_at: version.created_at ?? null,
        updated_at: version.updated_at ?? version.created_at ?? null,
        content:
            typeof version.content === 'string'
                ? version.content
                : typeof version.html === 'string'
                    ? version.html
                    : null,
        data_json: JSON.stringify(version),
        synced_at: new Date().toISOString(),
    };
}

function parseVersionContentResponse(rawResponse) {
    if (typeof rawResponse !== 'string') return null;

    const trimmed = rawResponse.trim();
    if (!trimmed) return '';

    if (!trimmed.startsWith('{') && !trimmed.startsWith('[')) {
        return rawResponse;
    }

    try {
        const parsed = JSON.parse(trimmed);
        return (
            parsed?.content ??
            parsed?.html ??
            parsed?.data?.content ??
            parsed?.data?.html ??
            null
        );
    } catch {
        return rawResponse;
    }
}

function toComparableTimestamp(payload) {
    return (
        payload?.latest_version?.created_at ??
        payload?.latest_version?.updated_at ??
        payload?.updated_at ??
        payload?.last_modified ??
        null
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

async function requestJson(pathname) {
    const response = await performHttpRequest({
        url: buildApiUrl(pathname),
        method: 'GET',
        responseType: 'json',
        headers: buildAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error(response.error || `La API respondió con error ${response.status}.`);
    }

    return response.data;
}

async function requestText(pathname) {
    const response = await performHttpRequest({
        url: buildApiUrl(pathname),
        method: 'GET',
        responseType: 'text',
        headers: buildAuthHeaders(),
    });

    if (!response.ok) {
        throw new Error(response.error || `La API respondió con error ${response.status}.`);
    }

    return response.data;
}

async function readCachedVersionRows(documentId) {
    const rows = await getAll(TABLE);

    return (rows || [])
        .filter((row) => Number(row.document_id) === Number(documentId))
        .sort((left, right) => Number(right.version_number ?? 0) - Number(left.version_number ?? 0))
        .map((row) => ({
            ...row,
            ...(parseJsonSafely(row.data_json) || {}),
        }));
}

async function replaceCachedDocumentVersions(documentId, versions, serverTimestamp = null) {
    const normalizedRows = versions
        .map((version) => normalizeDocumentVersion(version, documentId))
        .filter(Boolean);

    await deleteWhere(TABLE, { document_id: Number(documentId) });

    if (normalizedRows.length > 0) {
        await upsertMany(TABLE, normalizedRows);
    }

    await setSyncMeta(
        getMetaKey(documentId),
        new Date().toISOString(),
        serverTimestamp || new Date().toISOString()
    );

    return normalizedRows
        .sort((left, right) => Number(right.version_number ?? 0) - Number(left.version_number ?? 0))
        .map((row) => ({
            ...row,
            ...(parseJsonSafely(row.data_json) || {}),
        }));
}

async function getDocumentLastModifiedFromApi(documentId) {
    return await requestJson(`/documents/${documentId}/last-modified`);
}

async function getDocumentVersionsFromApi(documentId) {
    const payload = await requestJson(`/documents/${documentId}/versions`);
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

// La API identifica versiones por version_number (1, 2, 3...), no por el id de BD.
async function getDocumentVersionContentFromApi(documentId, versionNumber) {
    const rawContent = await requestText(`/documents/${documentId}/versions/${versionNumber}`);
    return parseVersionContentResponse(rawContent);
}

/**
 * Devuelve el historial de versiones desde caché local si sigue vigente.
 * Cuando detecta una versión nueva en el servidor, refresca SQLite antes de responder.
 */
async function getDocumentVersionHistory(documentId) {
    const normalizedDocumentId = Number(documentId);
    if (!Number.isInteger(normalizedDocumentId) || normalizedDocumentId < 1) {
        throw new Error('documentId inválido para consultar historial.');
    }

    const cachedVersions = await readCachedVersionRows(normalizedDocumentId);
    const meta = await getSyncMeta(getMetaKey(normalizedDocumentId));

    if (cachedVersions.length > 0 && meta?.last_server) {
        try {
            const remoteMeta = await getDocumentLastModifiedFromApi(normalizedDocumentId);
            const remoteTimestamp = toComparableTimestamp(remoteMeta);

            if (isRemoteFreshEnough(remoteTimestamp, meta.last_server)) {
                return cachedVersions;
            }
        } catch (error) {
            logger.warn('No se pudo validar frescura del historial; usando caché local', {
                documentId: normalizedDocumentId,
                error: error?.message || String(error),
            });
            return cachedVersions;
        }
    }

    const freshVersions = await getDocumentVersionsFromApi(normalizedDocumentId);
    let serverTimestamp = null;

    try {
        const remoteMeta = await getDocumentLastModifiedFromApi(normalizedDocumentId);
        serverTimestamp = toComparableTimestamp(remoteMeta);
    } catch (error) {
        logger.warn('No se pudo obtener last-modified al refrescar historial', {
            documentId: normalizedDocumentId,
            error: error?.message || String(error),
        });
    }

    return await replaceCachedDocumentVersions(normalizedDocumentId, freshVersions, serverTimestamp);
}

/**
 * Devuelve el HTML de una versión histórica. Como las versiones son inmutables,
 * si el contenido ya está cacheado se responde directo desde SQLite.
 */
async function getDocumentVersionContent(documentId, versionId, fallbackVersion = null) {
    const normalizedDocumentId = Number(documentId);
    const normalizedVersionId = Number(versionId);
    if (!Number.isInteger(normalizedDocumentId) || normalizedDocumentId < 1) {
        throw new Error('documentId inválido para consultar una versión.');
    }
    if (!Number.isInteger(normalizedVersionId) || normalizedVersionId < 1) {
        throw new Error('versionId inválido para consultar una versión.');
    }

    const cachedRow = await getById(TABLE, normalizedVersionId);
    if (typeof cachedRow?.content === 'string' && cachedRow.content.trim().length > 0) {
        return cachedRow.content;
    }

    // El endpoint /versions/{versionNumber} usa el número secuencial, no el id de BD.
    const versionNumber =
        cachedRow?.version_number ??
        fallbackVersion?.version_number ??
        fallbackVersion?.number ??
        null;
    if (!versionNumber) {
        throw new Error('No se pudo determinar el número de versión para consultar la API.');
    }

    const freshContent = await getDocumentVersionContentFromApi(normalizedDocumentId, versionNumber);
    if (typeof freshContent !== 'string') return null;

    const normalizedFallback = normalizeDocumentVersion(fallbackVersion || {
        id: normalizedVersionId,
        document_id: normalizedDocumentId,
    }, normalizedDocumentId);

    await upsertMany(TABLE, [{
        ...(cachedRow || {}),
        ...(normalizedFallback || { id: normalizedVersionId, document_id: normalizedDocumentId }),
        content: freshContent,
        data_json: JSON.stringify({
            ...(parseJsonSafely(cachedRow?.data_json) || {}),
            ...(fallbackVersion || {}),
        }),
        synced_at: new Date().toISOString(),
    }]);

    return freshContent;
}

module.exports = {
    getDocumentVersionHistory,
    getDocumentVersionContent,
};
