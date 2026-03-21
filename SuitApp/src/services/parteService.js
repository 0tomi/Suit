/**
 * parteService.js — CRUD de Partes legales y sus asociaciones a casos.
 * Las Partes son personas involucradas en el proceso (jueces, peritos, testigos, etc.)
 * que NO son clientes del estudio.
 */
import { apiGet, apiRequest } from './api.js';

export async function getPartes() {
    const result = await apiGet('/partes');
    return result.ok ? result.data : [];
}

export async function getParte(id) {
    const result = await apiGet(`/partes/${id}`);
    return result.ok ? result.data : null;
}

export async function createParte(data) {
    // Body: { nombre, apellido, email?, telefono?, rol_id }
    return await apiRequest('/partes', { method: 'POST', body: data });
}

export async function updateParte(id, data) {
    return await apiRequest(`/partes/${id}`, { method: 'PUT', body: data });
}

export async function deleteParte(id) {
    return await apiRequest(`/partes/${id}`, { method: 'DELETE' });
}

/** Lista partes asociadas a un caso con su rol. */
export async function getPartesByCaso(caseId) {
    const result = await apiGet(`/suit-cases/${caseId}/partes`);
    return result.ok ? result.data : [];
}

/** Asocia una parte existente al caso (idempotente). */
export async function linkParteToCaso(caseId, parteId) {
    return await apiRequest(`/suit-cases/${caseId}/partes`, {
        method: 'POST',
        body: { parte_id: parteId },
    });
}

/** Desasocia una parte del caso. */
export async function unlinkParteFromCaso(caseId, parteId) {
    return await apiRequest(`/suit-cases/${caseId}/partes/${parteId}`, { method: 'DELETE' });
}
