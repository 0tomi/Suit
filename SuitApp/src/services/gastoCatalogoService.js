/**
 * gastoCatalogoService.js — CRUD de Tipos de Gasto (catálogo) contra la API.
 * Las operaciones de escritura son solo para administradores.
 */
import { apiGet, apiRequest } from './api.js';

export async function getGastosCatalogo() {
    const result = await apiGet('/gastos');
    return result.ok ? result.data : [];
}

export async function getGastosCatalogoLastModified() {
    const result = await apiGet('/gastos/last-modified');
    return result.ok ? result.data?.last_modified : null;
}

export async function createGastoCatalogo(data) {
    return await apiRequest('/gastos', { method: 'POST', body: data });
}

export async function updateGastoCatalogo(id, data) {
    return await apiRequest(`/gastos/${id}`, { method: 'PUT', body: data });
}

export async function deleteGastoCatalogo(id) {
    return await apiRequest(`/gastos/${id}`, { method: 'DELETE' });
}
