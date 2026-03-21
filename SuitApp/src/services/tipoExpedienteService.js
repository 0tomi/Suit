/**
 * tipoExpedienteService.js — CRUD de Tipos de Expediente contra la API.
 */
import { apiGet, apiRequest } from './api.js';

export async function getTipoExpedientes() {
    const result = await apiGet('/tipo-expedientes');
    return result.ok ? result.data : [];
}

export async function getTipoExpedientesByCaseType(caseTypeId) {
    const result = await apiGet(`/case-types/${caseTypeId}/tipo-expedientes`);
    return result.ok ? result.data : [];
}

export async function getTipoExpedientesLastModified() {
    const result = await apiGet('/tipo-expedientes/last-modified');
    return result.ok ? result.data?.last_modified : null;
}

export async function createTipoExpediente(data) {
    return await apiRequest('/tipo-expedientes', { method: 'POST', body: data });
}

export async function updateTipoExpediente(id, data) {
    return await apiRequest(`/tipo-expedientes/${id}`, { method: 'PUT', body: data });
}

export async function deleteTipoExpediente(id) {
    return await apiRequest(`/tipo-expedientes/${id}`, { method: 'DELETE' });
}

/**
 * Sincroniza el array de tipo_expediente_ids con un caso específico.
 * Reemplaza la asociación actual del caso con los ids enviados.
 */
export async function syncTipoExpedientesToCase(caseId, ids) {
    return await apiRequest(`/suit-cases/${caseId}/tipo-expedientes`, {
        method: 'POST',
        body: { tipo_expediente_ids: ids },
    });
}
