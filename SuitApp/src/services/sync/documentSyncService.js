import { syncResource } from './syncCore.js';
import { getDocuments } from '../documentService.js';
import { extractMetadataCollection, summarizePayload } from '../metadata/metadataCacheUtils.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:documents');

export async function syncDocuments() {
    return await syncResource('documents', '/documents/last-modified', fetchAndCacheDocuments);
}

async function fetchAndCacheDocuments() {
    logger.info('fetch start (paginated)');
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

    const rows = allDocuments.map(d => ({
        id: d.id,
        name: d.name,
        suit_case_id: d.suit_case_id || null,
        user_id: d.user_id || null,
        // Preserva contenido HTML ya cacheado para lectura instantánea/offline.
        content: existingById.get(Number(d.id))?.content ?? null,
        is_locked: d.is_locked ? 1 : 0,
        locked_by: d.locked_by || null,
        locker_name: d.locker?.name || null,
        created_at: d.created_at || null,
        updated_at: d.updated_at || null,
        latest_version_number: d.latest_version?.version_number || null,
        latest_version_created_by: d.latest_version?.created_by || null,
        latest_version_creator_name: d.latest_version?.creator?.name || null,
        latest_version_creator_tag: d.latest_version?.creator?.tag || null,
        data_json: JSON.stringify(d),
        synced_at: new Date().toISOString(),
    }));
    
    logger.info('mapped rows', { rowCount: rows.length });
    
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('documents', rows);
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

export default { syncDocuments };
