import { getAllRequisitosFromApi } from '../requisitosService.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:requisitos');

/**
 * Verifica si la tabla de requisitos está vacía y, de ser así, la siembra
 * con todos los requisitos de la API. Estrategia "seed-once":
 * el cargado ocurre una sola vez por perfil; lecturas posteriores van
 * exclusivamente a la caché local sin tocar la API.
 *
 * También guarda sync_meta para evitar que clearStaleResources limpie la tabla
 * innecesariamente.
 *
 * @returns {Promise<boolean>} true si se sembró, false si ya estaba poblada.
 */
export async function ensureRequisitosSeeded() {
    const existing = await window.electronAPI.db.getAll('requisitos');
    if (existing && existing.length > 0) {
        return false;
    }

    logger.info('cache vacía, sembrando desde API');

    const response = await getAllRequisitosFromApi();
    if (!response) {
        logger.warn('no se pudo obtener requisitos de la API, cache queda vacía');
        return false;
    }

    // La API puede devolver { data: [...] } o directamente un array.
    const items = Array.isArray(response) ? response : (response.data ?? []);

    if (items.length === 0) {
        logger.info('API devolvió lista vacía de requisitos');
        return false;
    }

    const rows = items.map((r) => ({
        id: r.id,
        type: r.type ?? null,
        title: r.title ?? null,
        deleted_at: r.deleted_at ?? null,
        updated_at: r.updated_at ?? null,
        synced_at: new Date().toISOString(),
    }));

    await window.electronAPI.db.upsertMany('requisitos', rows);

    // Guardar sync_meta para que clearStaleResources no limpie la tabla en cada arranque.
    const now = new Date().toISOString().replace('T', ' ').substring(0, 19);
    await window.electronAPI.sync.setMeta('requisitos', now, now);

    logger.info('requisitos sembrados', { count: rows.length });
    return true;
}

/**
 * Devuelve todos los requisitos desde la caché local.
 * No realiza ninguna llamada a la API.
 */
export async function getRequisitosFromCache() {
    return await window.electronAPI.db.getAll('requisitos');
}

/**
 * Devuelve un requisito por ID desde la caché local.
 * No realiza ninguna llamada a la API.
 * @param {number} id
 */
export async function getRequisitoFromCacheById(id) {
    return await window.electronAPI.db.getById('requisitos', id);
}
