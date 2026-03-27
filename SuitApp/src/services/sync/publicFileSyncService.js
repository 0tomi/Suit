/**
 * publicFileSyncService.js — Sincronización de archivos públicos (Biblioteca).
 *
 * Implementa DOS rutas de sincronización según el estado del cache local:
 *
 * Ruta A — Cache vacío (primera vez):
 *   Llama a GET /api/public-files/sync?last_sync=1970-01-01 para obtener TODOS los archivos.
 *   Limpia la tabla y reinserta todos los registros activos.
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
import { syncResource } from './syncCore.js';
import { syncDown } from '../publicFileService.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:public-files');

let latestSyncedIds = new Set();

/**
 * Retorna los IDs de los archivos que fueron procesados en la última sincronización.
 * @returns {Set<number>} 
 */
export const getLatestSyncedIds = () => latestSyncedIds;

/**
 * Limpia la lista de IDs sincronizados recientemente.
 */
export const clearLatestSyncedIds = () => latestSyncedIds.clear();

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
        synced_at: new Date().toISOString(),
    };
}

/**
 * Ruta A: fetch completo vía endpoint de sync con fecha epoch.
 * Se usa cuando el cache está vacío (primera sincronización).
 * Usamos la fecha epoch para obtener TODOS los archivos existentes, independientemente
 * de si hay catálogos o no, ya que la API puede tener archivos sin catálogo asignado.
 */
async function fullFetchPublicFiles() {
    logger.warn('full fetch start — calling syncDown with epoch date');
    const allFiles = await syncDown('1970-01-01T00:00:00Z');
    
    // Track current sync results
    latestSyncedIds = new Set(allFiles.map(f => f.id));
    
    logger.warn('syncDown result', { isArray: Array.isArray(allFiles), length: Array.isArray(allFiles) ? allFiles.length : typeof allFiles });

    if (!Array.isArray(allFiles) || allFiles.length === 0) {
        logger.warn('full fetch: no files returned from API');
        return [];
    }

    logger.warn('full fetch complete', { total: allFiles.length });

    const rows = allFiles
        .filter((f) => !f.deleted_at) // excluir borrados en fetch inicial
        .map(buildPublicFileCacheRow);

    logger.warn('writing to SQLite', { rows: rows.length });
    await window.electronAPI.db.clearTable('public_files');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('public_files', rows);
        logger.warn('SQLite write complete');
    }

    return allFiles;
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

    // Track current sync results
    latestSyncedIds = new Set(changes.map(f => f.id));

    if (!Array.isArray(changes) || changes.length === 0) {
        logger.info('no changes from sync endpoint');
        return [];
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

    return changes;
}

/**
 * Función principal de fetch. Decide entre Ruta A o Ruta B según el estado del cache.
 * Es llamada por syncResource cuando detecta que el servidor tiene novedades.
 */
async function fetchAndCachePublicFiles() {
    // Leemos el meta actual para saber si es primera vez (Ruta A) o incremental (Ruta B).
    const meta = await window.electronAPI.sync.getMeta('public_files');
    const lastServer = meta?.last_server ?? null;

    // Si la tabla está vacía, siempre full fetch aunque tengamos meta.
    // Caso típico: corrida anterior grabó el meta pero falló al poblar el cache.
    const existingRows = await window.electronAPI.db.getAll('public_files');
    const tableEmpty = !existingRows || existingRows.length === 0;

    logger.warn('fetchAndCachePublicFiles', { lastServer, tableEmpty });

    if (!lastServer || tableEmpty) {
        if (tableEmpty && lastServer) {
            logger.warn('cache vacío con meta existente — forzando full fetch');
        }
        return await fullFetchPublicFiles();
    } else {
        return await incrementalSyncPublicFiles(lastServer);
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
