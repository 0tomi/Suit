/**
 * multimediaService.js — CRUD de archivos multimedia contra la API SuitAPI.
 *
 * Los archivos se almacenan cifrados en el servidor y se descargan descifrados.
 * El cache local solo guarda metadatos; el contenido binario se descarga on-demand.
 */

import { apiGet, apiRequest } from './api.js';

/**
 * Lista todos los archivos multimedia accesibles por el usuario.
 * @returns {Promise<Object>} Respuesta paginada de la API.
 */
export async function getMultimediaList(page = 1) {
    return await apiGet('/multimedia', { params: { page }, dedupe: false });
}

/**
 * Descarga el contenido binario descifrado de un archivo multimedia.
 * Retorna { bytes: Array<number>, mimeType: string, size: number } vía responseType binary.
 * @param {number} id
 * @returns {Promise<Object>} Objeto con bytes, mimeType y size.
 */
export async function downloadMultimedia(id) {
    return await apiRequest(`/multimedia/${id}`, { method: 'GET', responseType: 'binary' });
}

/**
 * Sube un archivo multimedia a la API.
 * Formatos soportados: jpg, jpeg, png, webp, gif, mp4, mov, avi, mkv.
 * @param {File} file - Objeto File del input
 * @param {number|null} suitCaseId - ID del caso al que vincular (opcional)
 * @returns {Promise<Object>} Respuesta de la API con los metadatos del archivo creado.
 */
export async function uploadMultimedia(file, suitCaseId = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (suitCaseId) {
        formData.append('suit_case_id', String(suitCaseId));
    }
    return await apiRequest('/multimedia', { method: 'POST', body: formData });
}

/**
 * Elimina lógicamente un archivo multimedia (soft delete).
 * @param {number} id
 */
export async function deleteMultimedia(id) {
    return await apiRequest(`/multimedia/${id}`, { method: 'DELETE' });
}
