import { syncResource } from './syncCore.js';
import { apiGet } from '../api.js';
import { getDocuments } from '../documentService.js';
import { extractMetadataCollection, summarizePayload } from '../metadata/metadataCacheUtils.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:documents');

export async function syncDocuments() {
    return await syncResource('documents', '/documents/last-modified', fetchAndCacheDocuments);
}

/**
 * Convierte un objeto de la API a una fila de SQLite para la tabla documents.
 * Preserva el contenido HTML ya cacheado localmente.
 */
function mapDocumentToRow(d, existingById) {
    return {
        id: d.id,
        name: d.name || d.title || 'Sin título',
        suit_case_id: d.suit_case_id || null,
        user_id: d.user_id || null,
        // Preserva contenido HTML ya cacheado para lectura instantánea/offline.
        content: existingById.get(Number(d.id))?.content ?? null,
        is_locked: d.is_locked ? 1 : 0,
        locked_by: d.locked_by || null,
        locker_name: d.locker?.name || null,
        status: d.status || 'Borrador',
        created_at: d.created_at || d.timestamp || d.date || null,
        updated_at: d.updated_at || d.timestamp || d.date || null,
        latest_version_number: d.latest_version?.version_number || null,
        latest_version_created_by: d.latest_version?.created_by || null,
        latest_version_creator_name: d.latest_version?.creator?.name || null,
        latest_version_creator_tag: d.latest_version?.creator?.tag || null,
        data_json: JSON.stringify(d),
        synced_at: new Date().toISOString(),
    };
}

/**
 * Escenario B.2.a (SKILL.md): hay caché y la API tiene un endpoint de sync incremental.
 * Trae solo los documentos modificados/eliminados desde `since`, los aplica sobre la caché
 * existente sin rehacer el fetch completo.
 */
async function fetchAndCacheDelta(since) {
    logger.info('delta sync start', { since });

    const result = await apiGet('/documents/sync', { params: { since } });
    if (!result.ok) {
        logger.warn('delta sync failed, falling back to full fetch', { status: result.status });
        await fetchAndCacheFull();
        return;
    }

    const changed = Array.isArray(result.data) ? result.data
        : Array.isArray(result.data?.data) ? result.data.data
        : [];

    logger.info('delta sync received items', { count: changed.length });

    if (changed.length === 0) return;

    const existingRows = await window.electronAPI.db.getAll('documents');
    const existingById = new Map(existingRows.map((row) => [Number(row.id), row]));

    const toUpsert = [];
    const toDelete = [];

    for (const d of changed) {
        if (d.deleted_at) {
            // El documento fue eliminado en el servidor → borrar de caché local.
            toDelete.push(Number(d.id));
        } else {
            toUpsert.push(mapDocumentToRow(d, existingById));
        }
    }

    if (toUpsert.length > 0) {
        logger.info('delta: upserting changed documents', { count: toUpsert.length });
        await window.electronAPI.db.upsertMany('documents', toUpsert);
    }

    if (toDelete.length > 0) {
        logger.info('delta: removing deleted documents', { count: toDelete.length });
        await Promise.all(toDelete.map((id) => window.electronAPI.db.deleteById('documents', id)));
    }
}

/**
 * Escenario A / B.2.b (SKILL.md): no hay caché o no se dispone de sync incremental.
 * Trae todos los documentos paginados y reemplaza la caché completa.
 */
async function fetchAndCacheFull() {
    logger.info('full fetch start (paginated)');
    let allDocuments = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        logger.info(`fetching page ${page}`);
        const result = await getDocuments(page);
        logger.info(`page ${page} response`, { payload: summarizePayload(result) });

        const currentData = extractMetadataCollection(result?.data, 'documents') || [];
        logger.info(`page ${page} extracted items`, { count: currentData.length });

        if (currentData.length === 0) {
            logger.warn(`page ${page} extracted 0 items, breaking`);
            break;
        }

        allDocuments = allDocuments.concat(currentData);

        const meta = result?.meta || result?.data?.meta;
        if (meta && meta.current_page < meta.last_page) {
            page += 1;
        } else {
            hasMore = false;
        }
    }

    logger.info('fetching existing rows to preserve HTML content');
    const existingRows = await window.electronAPI.db.getAll('documents');
    const existingById = new Map(existingRows.map((row) => [Number(row.id), row]));

    const rows = allDocuments.map((d) => mapDocumentToRow(d, existingById));

    logger.info('mapped rows', { rowCount: rows.length });

    if (rows.length > 0) {
        try {
            await window.electronAPI.db.upsertMany('documents', rows);
        } catch (err) {
            logger.error('upsertMany documents failed', { error: err.message, firstRow: rows[0] });
            throw err;
        }
    } else {
        logger.warn('API returned 0 rows across all pages');
    }

    // Limpiar documentos eliminados del servidor sin resetear toda la tabla.
    const serverIds = new Set(rows.map((row) => Number(row.id)));
    const removedLocalIds = existingRows
        .map((row) => Number(row.id))
        .filter((localId) => !serverIds.has(localId));

    if (removedLocalIds.length > 0) {
        logger.info('removing deleted documents from cache', { count: removedLocalIds.length });
        await Promise.all(removedLocalIds.map((docId) => window.electronAPI.db.deleteById('documents', docId)));
    }
}

/**
 * Punto de entrada del fetch. Usa sync incremental si hay timestamp guardado (Escenario B.2.a),
 * o full fetch si es la primera carga (Escenario A).
 */
async function fetchAndCacheDocuments() {
    const meta = await window.electronAPI.sync.getMeta('documents');
    const since = meta?.last_server || null;

    if (since) {
        await fetchAndCacheDelta(since);
    } else {
        await fetchAndCacheFull();
    }
}

export default { syncDocuments };
