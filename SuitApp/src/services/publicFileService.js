/**
 * publicFileService.js — Operaciones sobre archivos públicos (Biblioteca).
 * Cubre: listado paginado por catálogo, subida, edición, eliminación,
 * sincronización incremental y gestión de permisos granulares.
 */
import { apiGet, apiRequest } from './api.js';

/**
 * Lista archivos de un catálogo específico (paginado, 15 por página).
 * @param {number} catalogId
 * @param {number} [page=1]
 */
export async function getFilesForCatalog(catalogId, page = 1) {
    const result = await apiGet(`/public-file-catalogs/${catalogId}/public-files`, {
        params: { page },
    });
    return result.ok ? result.data : { data: [], meta: {} };
}

/**
 * Sube un archivo nuevo a la Biblioteca.
 * @param {FormData} formData - Debe incluir `file` (obligatorio) y opcionalmente `public_file_catalog_id`.
 */
export async function uploadFile(formData) {
    return await apiRequest('/public-files', { method: 'POST', body: formData });
}

/**
 * Edita los metadatos de un archivo (nombre o catálogo al que pertenece).
 * Requiere ser dueño, admin, o tener can_update=true en la tabla de permisos.
 * @param {number} id
 * @param {{ name?: string, public_file_catalog_id?: number }} data
 */
export async function updateFile(id, data) {
    return await apiRequest(`/public-files/${id}`, { method: 'PUT', body: data });
}

/**
 * Elimina (soft delete) un archivo público.
 * Requiere ser dueño, admin, o tener can_delete=true.
 * @param {number} id
 */
export async function deleteFile(id) {
    return await apiRequest(`/public-files/${id}`, { method: 'DELETE' });
}

/**
 * Consulta el timestamp del último cambio en la tabla public_files.
 * Retorna null si no hay archivos cargados — en ese caso no hay nada que sincronizar.
 */
export async function getLastModified() {
    const result = await apiGet('/public-files/last-modified', { dedupe: false });
    return result.ok ? (result.data?.last_modified ?? null) : null;
}

/**
 * Descarga todos los registros (metadatos) modificados o creados desde `lastSync`.
 * Los registros con deleted_at != null fueron eliminados y deben borrarse del cache local.
 * @param {string} lastSync - Timestamp ISO-8601
 */
export async function syncDown(lastSync) {
    const result = await apiGet('/public-files/sync', {
        params: { last_sync: lastSync },
        dedupe: false,
    });
    if (!result.ok) return [];
    // La API devuelve { data: [...] } — extraer el array interno
    const payload = result.data;
    return Array.isArray(payload) ? payload : (payload?.data ?? []);
}

// --- Permisos (siempre on-demand, no se cachean) ---

/**
 * Consulta los permisos del usuario autenticado sobre un archivo específico.
 * Endpoint accesible por cualquier usuario — devuelve sus propios can_update/can_delete.
 * Retorna { ok, data: { can_update, can_delete }, status }.
 * @param {number} fileId
 */
export async function getMyPermissions(fileId) {
    return await apiGet(`/public-files/${fileId}/my-permissions`);
}

/**
 * Lista los permisos explícitos de un archivo.
 * Solo accesible por el dueño o un administrador.
 * Retorna el resultado completo { ok, data, status } para que el consumidor
 * pueda distinguir entre 200 (owner/admin) y 403 (sin acceso).
 * @param {number} fileId
 */
export async function getPermissions(fileId) {
    return await apiGet(`/public-files/${fileId}/permissions`);
}

/**
 * Otorga o actualiza permisos de un usuario sobre un archivo.
 * Solo el dueño o admin pueden usar este endpoint.
 * @param {number} fileId
 * @param {{ user_id: number, can_update?: boolean, can_delete?: boolean }} data
 */
export async function setPermissions(fileId, data) {
    return await apiRequest(`/public-files/${fileId}/permissions`, {
        method: 'POST',
        body: data,
    });
}

/**
 * Revoca completamente los permisos de un usuario sobre un archivo.
 * @param {number} fileId
 * @param {number} userId
 */
export async function revokePermission(fileId, userId) {
    return await apiRequest(`/public-files/${fileId}/permissions/${userId}`, {
        method: 'DELETE',
    });
}

/**
 * Genera un enlace temporal para carga de archivos desde un dispositivo externo.
 * Usa el puente de Electron para hablar con la API.
 * @param {{ catalogId?: number, permissions?: Array }} options
 */
export async function generateUploadLink(options) {
    return await window.electronAPI.publicFiles.generateUploadLink(options);
}
/**
 * Genera un enlace temporal firmado para descarga externa.
 * @param {number} fileId
 */
export async function generateLink(fileId) {
    return await window.electronAPI.publicFiles.generateLink(fileId);
}
