/**
 * clientService.js — CRUD de clientes contra la API SuitAPI.
 */
import { apiGet, apiRequest } from './api.js';

/**
 * Lista clientes con filtros opcionales.
 */
export async function getClients({ page = 1, search, type, status } = {}) {
    const result = await apiGet('/clients', { params: { page, search, type, status } });
    return result.ok ? result.data : { data: [] };
}

/**
 * Obtiene un cliente individual con sus asociaciones.
 */
export async function getClient(id) {
    const result = await apiGet(`/clients/${id}`);
    return result.ok ? result.data : null;
}

/**
 * Crea un cliente nuevo.
 */
export async function createClient(clientData) {
    return await apiRequest('/clients', { method: 'POST', body: clientData });
}

/**
 * Actualiza un cliente existente.
 */
export async function updateClient(id, clientData) {
    return await apiRequest(`/clients/${id}`, { method: 'PUT', body: clientData });
}

/**
 * Elimina un cliente (soft delete).
 */
export async function deleteClient(id) {
    return await apiRequest(`/clients/${id}`, { method: 'DELETE' });
}

/**
 * Obtiene la fecha de última modificación global de clientes.
 */
export async function getClientsLastModified() {
    const result = await apiGet('/clients/last-modified');
    return result.ok ? result.data?.last_modified : null;
}
