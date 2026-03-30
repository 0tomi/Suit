/**
 * publicFileService.js — Operaciones renderer-side para Biblioteca.
 * El renderer no habla con la API: todas las requests pasan por Electron IPC.
 */
import { createLogger } from './logService.js';

const logger = createLogger('public-file-service');

function getPublicFilesApi() {
    const api = window.electronAPI?.publicFiles;
    if (!api) {
        const error = new Error('electronAPI.publicFiles no está disponible.');
        void logger.error('publicFiles bridge unavailable');
        throw error;
    }
    return api;
}

async function serializeFormData(formData) {
    const parts = [];

    for (const [name, value] of formData.entries()) {
        if (value instanceof Blob) {
            const bytes = Array.from(new Uint8Array(await value.arrayBuffer()));
            parts.push({
                kind: 'file',
                name,
                filename: typeof value.name === 'string' && value.name ? value.name : 'upload.bin',
                mimeType: value.type || 'application/octet-stream',
                bytes,
            });
            continue;
        }

        parts.push({
            kind: 'field',
            name,
            value,
        });
    }

    return parts;
}

/**
 * Lista archivos públicos paginados desde el backend Electron.
 * @param {number} [page=1]
 */
export async function getPublicFilesPage(page = 1) {
    return await getPublicFilesApi().list({ page });
}

/**
 * Lista archivos públicos paginados filtrados por catálogo.
 * @param {number} catalogId
 * @param {number} [page=1]
 */
export async function getFilesForCatalog(catalogId, page = 1) {
    return await getPublicFilesApi().listByCatalog(catalogId, { page });
}

/**
 * Sube un archivo nuevo a la Biblioteca.
 * El FormData se arma en el renderer y se serializa para IPC.
 * @param {FormData} formData
 * @param {Array<{ user_id: number, can_update?: boolean, can_delete?: boolean }>} [permissions=[]]
 */
export async function uploadFile(formData, permissions = []) {
    const parts = await serializeFormData(formData);
    return await getPublicFilesApi().upload({ parts, permissions });
}

/**
 * Edita metadatos de un archivo público.
 * @param {number} id
 * @param {{ name?: string, public_file_catalog_id?: number|null }} data
 */
export async function updateFile(id, data) {
    return await getPublicFilesApi().update(id, data);
}

/**
 * Elimina un archivo público.
 * @param {number} id
 */
export async function deleteFile(id) {
    return await getPublicFilesApi().delete(id);
}

/**
 * Consulta los permisos del usuario autenticado sobre un archivo.
 * @param {number} fileId
 */
export async function getMyPermissions(fileId) {
    return await getPublicFilesApi().getMyPermissions(fileId);
}

/**
 * Lista permisos explícitos de un archivo.
 * @param {number} fileId
 */
export async function getPermissions(fileId) {
    return await getPublicFilesApi().getPermissions(fileId);
}

/**
 * Otorga o actualiza permisos de un usuario sobre un archivo.
 * @param {number} fileId
 * @param {{ user_id: number, can_update?: boolean, can_delete?: boolean }} data
 */
export async function setPermissions(fileId, data) {
    return await getPublicFilesApi().setPermissions(fileId, data);
}

/**
 * Revoca completamente los permisos de un usuario.
 * @param {number} fileId
 * @param {number} userId
 */
export async function revokePermission(fileId, userId) {
    return await getPublicFilesApi().revokePermission(fileId, userId);
}

/**
 * Genera un enlace temporal para carga de archivos desde un dispositivo externo.
 * @param {{ catalogId?: number, permissions?: Array }} options
 */
export async function generateUploadLink(options) {
    return await getPublicFilesApi().generateUploadLink(options);
}

/**
 * Genera un enlace firmado para descarga externa.
 * @param {number} fileId
 */
export async function generateLink(fileId) {
    return await getPublicFilesApi().generateLink(fileId);
}
