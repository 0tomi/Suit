/**
 * gastoSuitCaseService.js — CRUD de Gastos de Caso contra la API.
 * Los gastos se cargan on-demand por caso y se cachean en SQLite.
 */
import { apiGet, apiRequest } from './api.js';

export async function getGastosByCaso(caseId) {
    const result = await apiGet(`/suit-cases/${caseId}/gastos`);
    return result.ok ? result.data : [];
}

export async function getGastoCaso(id) {
    const result = await apiGet(`/gasto-suit-cases/${id}`);
    return result.ok ? result.data : null;
}

export async function createGastoCaso(caseId, data) {
    // Body: { gasto_id, monto, client_id? | client_ids? }
    return await apiRequest(`/suit-cases/${caseId}/gastos`, { method: 'POST', body: data });
}

export async function updateGastoCaso(id, data) {
    return await apiRequest(`/gasto-suit-cases/${id}`, { method: 'PUT', body: data });
}

export async function deleteGastoCaso(id) {
    return await apiRequest(`/gasto-suit-cases/${id}`, { method: 'DELETE' });
}

/**
 * Retorna todos los gastos entre dos fechas. Admins ven todos; lawyers solo ven los propios.
 * @param {string} from        - Fecha inicio YYYY-MM-DD
 * @param {string} to          - Fecha fin   YYYY-MM-DD
 * @param {number|null} userId - Filtra por usuario específico (solo admin). null = todos.
 */
export async function getGastosByDateRange(from, to, userId = null) {
    const params = new URLSearchParams({ from, to });
    if (userId) params.set('user_id', String(userId));
    const result = await apiGet(`/gasto-suit-cases/by-date-range?${params}`);
    if (!result.ok) return [];
    // La API puede devolver array directo o colección paginada { data: [...] }
    const payload = result.data;
    return Array.isArray(payload) ? payload : (Array.isArray(payload?.data) ? payload.data : []);
}
