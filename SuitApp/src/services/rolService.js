/**
 * rolService.js — CRUD de Roles (catálogo de tipos de parte legal) contra la API.
 */
import { apiGet, apiRequest } from './api.js';

export async function getRoles() {
    const result = await apiGet('/roles');
    return result.ok ? result.data : [];
}

export async function getRol(id) {
    const result = await apiGet(`/roles/${id}`);
    return result.ok ? result.data : null;
}

export async function createRol(data) {
    return await apiRequest('/roles', { method: 'POST', body: data });
}

export async function updateRol(id, data) {
    return await apiRequest(`/roles/${id}`, { method: 'PUT', body: data });
}

export async function deleteRol(id) {
    return await apiRequest(`/roles/${id}`, { method: 'DELETE' });
}
