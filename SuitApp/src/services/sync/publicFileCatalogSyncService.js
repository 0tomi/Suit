/**
 * publicFileCatalogSyncService.js — Sincronización de catálogos de archivos públicos.
 *
 * Los catálogos son un listado pequeño sin paginación. Se usa syncResource sin
 * endpoint last-modified: siempre se hace un full fetch cuando el cache local
 * no tiene timestamp (primera vez) o cuando el llamador lo fuerza.
 */
import { syncResource } from './syncCore.js';
import { getCatalogs } from '../publicFileCatalogService.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:public-file-catalogs');

/**
 * Construye la fila de cache para un catálogo.
 * @param {object} catalog
 */
function buildCatalogCacheRow(catalog) {
    return {
        id: catalog.id,
        name: catalog.name,
        description: catalog.description ?? null,
        created_at: catalog.created_at ?? null,
        updated_at: catalog.updated_at ?? null,
        data_json: JSON.stringify(catalog),
        synced_at: new Date().toISOString(),
    };
}

async function fetchAndCacheCatalogs() {
    logger.info('fetching all catalogs');
    const catalogs = await getCatalogs();

    if (!Array.isArray(catalogs)) {
        logger.warn('unexpected response from getCatalogs', { catalogs });
        return;
    }

    const rows = catalogs.map(buildCatalogCacheRow);
    logger.info('mapped catalog rows', { count: rows.length });

    await window.electronAPI.db.clearTable('public_file_catalogs');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('public_file_catalogs', rows);
    }
}

/**
 * Sincroniza los catálogos de archivos públicos contra la API.
 * Al no existir un endpoint last-modified para catálogos, siempre se hace
 * full fetch cuando el cache local está vacío o cuando clearStaleResources lo limpió.
 */
export async function syncPublicFileCatalogs() {
    return await syncResource('public_file_catalogs', null, fetchAndCacheCatalogs);
}
