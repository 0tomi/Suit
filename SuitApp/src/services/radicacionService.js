/**
 * radicacionService.js — CRUD de Radicaciones (tribunales/juzgados) contra la API.
 */
import { apiGet, apiRequest } from './api.js';

export async function getRadicaciones() {
    const result = await apiGet('/radicaciones');
    return result.ok ? result.data : [];
}

export async function createRadicacion(data) {
    return await apiRequest('/radicaciones', { method: 'POST', body: data });
}

export async function updateRadicacion(id, data) {
    return await apiRequest(`/radicaciones/${id}`, { method: 'PUT', body: data });
}

export async function deleteRadicacion(id) {
    return await apiRequest(`/radicaciones/${id}`, { method: 'DELETE' });
}
