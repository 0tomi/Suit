import { apiGet, apiRequest } from './api.js';

/**
 * Obtiene todos los requisitos desde la API remota.
 * Solo se llama en el seed inicial; luego se sirve todo desde la caché local.
 */
export async function getAllRequisitosFromApi() {
    const result = await apiGet('/requisitos');
    return result.ok ? result.data : null;
}

/**
 * Crea un requisito nuevo en la API.
 * @param {{ type: string, title: string }} data
 */
export async function createRequisito(data) {
    return await apiRequest('/requisitos', {
        method: 'POST',
        body: data,
    });
}

/**
 * Actualiza un requisito existente en la API.
 * @param {number} id
 * @param {{ type?: string, title?: string }} data
 */
export async function updateRequisito(id, data) {
    return await apiRequest(`/requisitos/${id}`, {
        method: 'PUT',
        body: data,
    });
}

/**
 * Elimina (soft delete) un requisito en la API.
 * @param {number} id
 */
export async function deleteRequisito(id) {
    return await apiRequest(`/requisitos/${id}`, {
        method: 'DELETE',
    });
}
