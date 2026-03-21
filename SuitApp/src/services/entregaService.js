/**
 * entregaService.js — CRUD de Entregas (pagos parciales de honorarios) contra la API.
 * Cada operación de escritura recalcula automáticamente el campo `pagado` del honorario padre.
 */
import { apiGet, apiRequest } from './api.js';

export async function getEntregasByHonorario(honorarioId) {
    const result = await apiGet(`/honorarios/${honorarioId}/entregas`);
    return result.ok ? result.data : [];
}

export async function getEntrega(id) {
    const result = await apiGet(`/entregas/${id}`);
    return result.ok ? result.data : null;
}

export async function createEntrega(honorarioId, data) {
    // Body: { monto, tipo_pago_id?, nota? }
    return await apiRequest(`/honorarios/${honorarioId}/entregas`, { method: 'POST', body: data });
}

export async function updateEntrega(id, data) {
    return await apiRequest(`/entregas/${id}`, { method: 'PUT', body: data });
}

export async function deleteEntrega(id) {
    return await apiRequest(`/entregas/${id}`, { method: 'DELETE' });
}
