/**
 * multimediaSyncService.js — Sincronización global de metadatos de multimedia.
 *
 * El sync global carga los metadatos de todos los archivos multimedia accesibles.
 * No descarga contenido binario; eso es on-demand via downloadMultimedia().
 *
 * La API no tiene un endpoint /multimedia/last-modified global, por lo que
 * el sync per-caso (caseSyncDownService) es la fuente más granular de cambios.
 * Este sync global sirve como base de cache para la vista de galería/listado.
 */

import { syncResource } from './syncCore.js';
import { getMultimediaList } from '../multimediaService.js';
import { buildMultimediaCacheRow } from '../cache/multimediaCacheRow.js';
import { extractMetadataCollection, summarizePayload } from '../metadata/metadataCacheUtils.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:multimedia');

export async function syncMultimedia() {
    // Sin endpoint last-modified global para multimedia — el cache per-caso lo maneja caseSyncDownService.
    // Se pasa null para que syncResource haga full fetch cuando la tabla esté vacía o stale.
    return await syncResource('multimedia', null, fetchAndCacheMultimedia);
}

async function fetchAndCacheMultimedia() {
    logger.info('fetch start (paginated)');
    let allItems = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        logger.info(`fetching page ${page}`);
        const result = await getMultimediaList(page);
        logger.info(`page ${page} response`, { payload: summarizePayload(result) });

        const currentData = extractMetadataCollection(result?.data, 'multimedia') || [];
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

    const rows = allItems.map(buildMultimediaCacheRow).filter(Boolean);
    logger.info('mapped rows', { rowCount: rows.length });

    await window.electronAPI.db.clearTable('multimedia');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('multimedia', rows);
    } else {
        logger.warn('API returned 0 multimedia rows; cache cleared');
    }
}

export default { syncMultimedia };
