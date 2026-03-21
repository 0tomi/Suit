/**
 * tipoPagoService.js — CRUD de Tipos de Pago (catálogo) contra la API.
 * Las operaciones de escritura son solo para administradores.
 */
import { apiGet, apiRequest } from './api.js';

export async function getTipoPagos() {
    const result = await apiGet('/tipo-pagos');
    return result.ok ? result.data : [];
}

export async function createTipoPago(data) {
    return await apiRequest('/tipo-pagos', { method: 'POST', body: data });
}

export async function updateTipoPago(id, data) {
    return await apiRequest(`/tipo-pagos/${id}`, { method: 'PUT', body: data });
}

export async function deleteTipoPago(id) {
    return await apiRequest(`/tipo-pagos/${id}`, { method: 'DELETE' });
}
