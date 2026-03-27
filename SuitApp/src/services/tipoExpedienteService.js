/**
 * tipoExpedienteService.js — CRUD de Tipos de Expediente contra la API.
 */
import { apiGet, apiRequest } from './api.js';
import { createLogger } from './logService.js';

const logger = createLogger('tipo-expediente-service');

export async function getTipoExpedientes() {
    const result = await apiGet('/tipo-expedientes');
    return result.ok ? result.data : [];
}

export async function getTipoExpedientesByCaseType(caseTypeId) {
    const result = await apiGet(`/case-types/${caseTypeId}/tipo-expedientes`);
    return result.ok ? result.data : [];
}

export async function getCaseTipoExpedientes(caseId) {
    const result = await apiGet(`/suit-cases/${caseId}/tipo-expedientes`, { dedupe: false });
    if (!result.ok) {
        void logger.warn('No se pudieron obtener tipos de expediente por caso', {
            caseId,
            endpoint: `/suit-cases/${caseId}/tipo-expedientes`,
            status: result?.status ?? null,
            error: result?.error ?? null,
            payloadKind: Array.isArray(result?.data) ? 'array' : typeof result?.data,
            payloadKeys: result?.data && typeof result.data === 'object' && !Array.isArray(result.data)
                ? Object.keys(result.data)
                : [],
        });
        return [];
    }

    const payload = result.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.tipo_expedientes)) return payload.tipo_expedientes;
    if (Array.isArray(payload?.case?.tipo_expedientes)) return payload.case.tipo_expedientes;

    void logger.warn('Respuesta sin coleccion de tipos de expediente reconocible', {
        caseId,
        endpoint: `/suit-cases/${caseId}/tipo-expedientes`,
        payloadKind: Array.isArray(payload) ? 'array' : typeof payload,
        payloadKeys: payload && typeof payload === 'object' && !Array.isArray(payload)
            ? Object.keys(payload)
            : [],
        hasCaseObject: Boolean(payload?.case && typeof payload.case === 'object'),
        caseKeys: payload?.case && typeof payload.case === 'object'
            ? Object.keys(payload.case)
            : [],
    });

    return [];
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
