/**
 * publicFileCatalogService.js — CRUD de catálogos de archivos públicos.
 * Solo el administrador puede crear, editar o eliminar catálogos.
 * El catálogo "General" está protegido en la API (devuelve 403 ante modificaciones).
 */
import { apiGet, apiRequest } from './api.js';

/**
 * Lista todos los catálogos disponibles en el sistema.
 */
export async function getCatalogs() {
    const result = await apiGet('/public-file-catalogs');
    return result.ok ? result.data : [];
}

/**
 * Crea un nuevo catálogo (requiere rol Admin).
 * @param {{ name: string, description?: string }} data
 */
export async function createCatalog(data) {
    return await apiRequest('/public-file-catalogs', { method: 'POST', body: data });
}

/**
 * Actualiza un catálogo existente (requiere rol Admin).
 * El catálogo General siempre devuelve 403.
 * @param {number} id
 * @param {{ name?: string, description?: string }} data
 */
export async function updateCatalog(id, data) {
    return await apiRequest(`/public-file-catalogs/${id}`, { method: 'PUT', body: data });
}

/**
 * Elimina un catálogo (requiere rol Admin).
 * Los archivos huérfanos se reasignan automáticamente al catálogo General.
 * El catálogo General siempre devuelve 403.
 * @param {number} id
 */
export async function deleteCatalog(id) {
    return await apiRequest(`/public-file-catalogs/${id}`, { method: 'DELETE' });
}
