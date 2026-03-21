/**
 * fileSyncService.js — Sincronización global de metadatos de archivos generales.
 *
 * El sync global carga los metadatos de todos los archivos (PDF, Excel, Word, CSV) accesibles.
 * No descarga contenido binario; eso es on-demand via downloadFile().
 *
 * La API no tiene un endpoint /files/last-modified global, por lo que
 * el sync per-caso (caseSyncDownService) es la fuente más granular de cambios.
 * Este sync global sirve como base de cache para la vista de listado de archivos.
 */

import { syncResource } from './syncCore.js';
import { getFilesList } from '../fileService.js';
import { buildFileCacheRow } from '../cache/fileCacheRow.js';
import { extractMetadataCollection, summarizePayload } from '../metadata/metadataCacheUtils.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:files');

export async function syncFiles() {
    // Sin endpoint last-modified global para files — el cache per-caso lo maneja caseSyncDownService.
    // Se pasa null para que syncResource haga full fetch cuando la tabla esté vacía o stale.
    return await syncResource('files', null, fetchAndCacheFiles);
}

async function fetchAndCacheFiles() {
    logger.info('fetch start (paginated)');
    let allItems = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        logger.info(`fetching page ${page}`);
        const result = await getFilesList(page);
        logger.info(`page ${page} response`, { payload: summarizePayload(result) });

        const currentData = extractMetadataCollection(result?.data, 'files') || [];
        logger.info(`page ${page} extracted items`, { count: currentData.length });

        if (currentData.length === 0) {
            logger.warn(`page ${page} extracted 0 items, breaking`);
            break;
        }

        allItems = allItems.concat(currentData);

        const meta = result?.meta || result?.data?.meta;
        if (meta && meta.current_page < meta.last_page) {
            page += 1;
        } else {
            hasMore = false;
        }
    }

    const rows = allItems.map(buildFileCacheRow).filter(Boolean);
    logger.info('mapped rows', { rowCount: rows.length });

    await window.electronAPI.db.clearTable('files');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('files', rows);
    } else {
        logger.warn('API returned 0 files rows; cache cleared');
    }
}

export default { syncFiles };
