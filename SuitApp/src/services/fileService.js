/**
 * fileService.js — CRUD de archivos generales (PDF, Excel, Word, CSV) contra la API SuitAPI.
 *
 * Los archivos se almacenan cifrados en el servidor y se descargan descifrados.
 * El cache local solo guarda metadatos; el contenido binario se descarga on-demand.
 */

import { apiGet, apiRequest } from './api.js';

/**
 * Lista todos los archivos generales accesibles por el usuario.
 * @returns {Promise<Object>} Respuesta paginada de la API.
 */
export async function getFilesList(page = 1) {
    return await apiGet('/files', { params: { page }, dedupe: false });
}

/**
 * Descarga el contenido binario descifrado de un archivo general.
 * Retorna { bytes: Array<number>, mimeType: string, size: number } vía responseType binary.
 * @param {number} id
 * @returns {Promise<Object>} Objeto con bytes, mimeType y size.
 */
export async function downloadFile(id) {
    return await apiRequest(`/files/${id}`, { method: 'GET', responseType: 'binary' });
}

/**
 * Sube un archivo general a la API.
 * Formatos soportados: pdf, doc, docx, xls, xlsx, csv.
 * @param {File} file - Objeto File del input
 * @param {number|null} suitCaseId - ID del caso al que vincular (opcional)
 * @returns {Promise<Object>} Respuesta de la API con los metadatos del archivo creado.
 */
export async function uploadFile(file, suitCaseId = null) {
    const formData = new FormData();
    formData.append('file', file);
    if (suitCaseId) {
        formData.append('suit_case_id', String(suitCaseId));
    }
    return await apiRequest('/files', { method: 'POST', body: formData });
}

/**
 * Elimina lógicamente un archivo general (soft delete).
 * @param {number} id
 */
export async function deleteFile(id) {
    return await apiRequest(`/files/${id}`, { method: 'DELETE' });
}
