/**
 * publicFileCatalogService.js — CRUD de catálogos de Biblioteca via Electron IPC.
 */
import { createLogger } from './logService.js';

const logger = createLogger('public-file-catalog-service');

function getPublicFileCatalogsApi() {
    const api = window.electronAPI?.publicFileCatalogs;
    if (!api) {
        const error = new Error('electronAPI.publicFileCatalogs no está disponible.');
        void logger.error('publicFileCatalogs bridge unavailable');
        throw error;
    }
    return api;
}

/**
 * Lista todos los catálogos disponibles.
 */
export async function getCatalogs() {
    return await getPublicFileCatalogsApi().list();
}

/**
 * Crea un catálogo.
 * @param {{ name: string, description?: string }} data
 */
export async function createCatalog(data) {
    return await getPublicFileCatalogsApi().create(data);
}

/**
 * Actualiza un catálogo existente.
 * @param {number} id
 * @param {{ name?: string, description?: string }} data
 */
export async function updateCatalog(id, data) {
    return await getPublicFileCatalogsApi().update(id, data);
}

/**
 * Elimina un catálogo existente.
 * @param {number} id
 */
export async function deleteCatalog(id) {
    return await getPublicFileCatalogsApi().delete(id);
}
