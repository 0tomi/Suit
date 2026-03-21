/**
 * publicFileSyncService.js — Sincronización de archivos públicos (Biblioteca).
 *
 * Implementa DOS rutas de sincronización según el estado del cache local:
 *
 * Ruta A — Cache vacío (primera vez):
 *   Fetch paginado catalog-por-catalog vía GET /api/public-file-catalogs/{id}/public-files.
 *   Limpia la tabla y reinserta todos los registros.
 *
 * Ruta B — Cache poblado (sesiones subsiguientes):
 *   Consulta GET /api/public-files/sync?last_sync={last_server} para obtener solo
 *   los cambios desde la última sincronización. Registros con deleted_at != null
 *   se eliminan del cache; el resto se upserta.
 *   No se borra la tabla completa — actualización incremental.
 *
 * En ambos casos, antes de proceder se verifica el endpoint last-modified para
 * saltear el fetch si el servidor no tiene novedades.
 */
import { syncResource, isServerUpToDate, getLocalLaravelTime } from './syncCore.js';
import { getCatalogs } from '../publicFileCatalogService.js';
import { getFilesForCatalog, getLastModified, syncDown } from '../publicFileService.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:public-files');

/**
 * Construye la fila de cache para un archivo público (sin bytes binarios).
 * @param {object} file
 */
export function buildPublicFileCacheRow(file) {
    return {
        id: file.id,
        uuid: file.uuid ?? null,
        user_id: file.user_id ?? null,
        public_file_catalog_id: file.public_file_catalog_id ?? null,
        name: file.name ?? null,
        path: file.path ?? null,
        mime_type: file.mime_type ?? null,
        size: file.size ?? null,
        hash: file.hash ?? null,
        created_at: file.created_at ?? null,
        updated_at: file.updated_at ?? null,
        deleted_at: file.deleted_at ?? null,
        data_json: JSON.stringify(file),
        synced_at: new Date().toISOString(),
    };
}

/**
 * Ruta A: fetch completo paginado por catálogo.
 * Se usa cuando el cache está vacío (primera sincronización).
 */
async function fullFetchPublicFiles() {
    logger.info('full fetch start — fetching all catalogs first');
    const catalogs = await getCatalogs();

    if (!Array.isArray(catalogs) || catalogs.length === 0) {
        logger.warn('no catalogs returned; skipping full fetch');
        return;
    }

    /**
     * Fetch paginado de todos los archivos de un catálogo.
     * Las páginas dentro de un catálogo son secuenciales (no se saben cuántas hay hasta
     * leer la primera), pero los catálogos entre sí son independientes y se paralelizan.
     */
    async function fetchAllPagesForCatalog(catalog) {
        const files = [];
        let page = 1;
        let hasMore = true;

        while (hasMore) {
            logger.info(`fetching catalog ${catalog.id} page ${page}`);
            const result = await getFilesForCatalog(catalog.id, page);
            const items = Array.isArray(result) ? result : (result?.data ?? []);
            files.push(...items);

            const meta = result?.meta;
            hasMore = !!(meta && meta.current_page < meta.last_page);
            if (hasMore) page++;
        }
        return files;
    }

    // async-parallel: fetch de catálogos en paralelo (son independientes entre sí)
    const perCatalogFiles = await Promise.all(catalogs.map(fetchAllPagesForCatalog));
    const allFiles = perCatalogFiles.flat();

    logger.info('full fetch complete', { total: allFiles.length });

    const rows = allFiles
        .filter((f) => !f.deleted_at) // excluir borrados en fetch inicial
        .map(buildPublicFileCacheRow);

    await window.electronAPI.db.clearTable('public_files');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('public_files', rows);
    }
}

/**
 * Ruta B: sincronización incremental.
 * Llama a /api/public-files/sync?last_sync={lastSync} y procesa los cambios:
 *  - deleted_at != null → eliminar del cache
 *  - resto → upsert
 */
async function incrementalSyncPublicFiles(lastSync) {
    logger.info('incremental sync start', { lastSync });
    const changes = await syncDown(lastSync);

    if (!Array.isArray(changes) || changes.length === 0) {
        logger.info('no changes from sync endpoint');
        return;
    }

    const toDelete = changes.filter((f) => f.deleted_at != null);
    const toUpsert = changes.filter((f) => f.deleted_at == null);

    logger.info('incremental sync changes', {
        toDelete: toDelete.length,
        toUpsert: toUpsert.length,
    });

    for (const file of toDelete) {
        await window.electronAPI.db.deleteById('public_files', file.id);
    }

    if (toUpsert.length > 0) {
        const rows = toUpsert.map(buildPublicFileCacheRow);
        await window.electronAPI.db.upsertMany('public_files', rows);
    }
}

/**
 * Función principal de fetch. Decide entre Ruta A o Ruta B según el estado del cache.
 * Es llamada por syncResource cuando detecta que el servidor tiene novedades.
 */
async function fetchAndCachePublicFiles() {
    // Leemos el meta actual para saber si es primera vez (Ruta A) o incremental (Ruta B).
    const meta = await window.electronAPI.sync.getMeta('public_files');
    const lastServer = meta?.last_server ?? null;

    if (!lastServer) {
        await fullFetchPublicFiles();
    } else {
        await incrementalSyncPublicFiles(lastServer);
    }
}

/**
 * Sincroniza los archivos públicos contra la API.
 *
 * Flujo:
 * 1. Consulta /api/public-files/last-modified
 * 2. Si null → no hay archivos en la API, no se hace nada
 * 3. Si el servidor está up-to-date → salta el fetch
 * 4. Si hay novedades → ejecuta fetchAndCachePublicFiles (Ruta A o B según cache)
 * 5. Persiste el nuevo timestamp en sync_meta
 */
export async function syncPublicFiles() {
    // Usamos syncResource con lastModifiedEndpoint para aprovechar la lógica de deduplicación
    // y manejo de errores. La lógica de Ruta A/B vive dentro del fetchFn.
    return await syncResource('public_files', '/public-files/last-modified', fetchAndCachePublicFiles);
}
