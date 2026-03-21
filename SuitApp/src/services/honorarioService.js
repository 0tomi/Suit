/**
 * honorarioService.js — CRUD de Honorarios (fees por caso/cliente) contra la API.
 * Los honorarios se cargan on-demand por caso y se cachean en SQLite.
 */
import { apiGet, apiRequest } from './api.js';

export async function getHonorariosByCaso(caseId) {
    const result = await apiGet(`/suit-cases/${caseId}/honorarios`);
    return result.ok ? result.data : [];
}

export async function getHonorariosByClient(clientId) {
    const result = await apiGet(`/clients/${clientId}/honorarios`);
    return result.ok ? result.data : [];
}

export async function getHonorario(id) {
    const result = await apiGet(`/honorarios/${id}`);
    return result.ok ? result.data : null;
}

export async function createHonorario(caseId, data) {
    // Body: { monto, client_id, detalles? }
    return await apiRequest(`/suit-cases/${caseId}/honorarios`, { method: 'POST', body: data });
}

export async function updateHonorario(id, data) {
    return await apiRequest(`/honorarios/${id}`, { method: 'PUT', body: data });
}

export async function deleteHonorario(id) {
    return await apiRequest(`/honorarios/${id}`, { method: 'DELETE' });
}

/**
 * Retorna todos los honorarios creados entre dos fechas (solo admin).
 * @param {string} from        - Fecha inicio YYYY-MM-DD
 * @param {string} to          - Fecha fin   YYYY-MM-DD
 * @param {number|null} userId - Filtra por usuario específico (solo admin). null = todos.
 */
export async function getHonorariosByDateRange(from, to, userId = null) {
    const params = new URLSearchParams({ from, to });
    if (userId) params.set('user_id', String(userId));
    const result = await apiGet(`/honorarios/by-date-range?${params}`);
    if (!result.ok) return [];
    // La API puede devolver array directo o colección paginada { data: [...] }
    const payload = result.data;
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
}
