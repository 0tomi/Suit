/**
 * caseService.js — CRUD de casos contra la API SuitAPI.
 */
import { apiGet, apiRequest } from './api.js';

export async function getCases() {
    const result = await apiGet('/cases');
    return result.ok ? result.data : [];
}

export async function getOpenCases() {
    const result = await apiGet('/cases/open');
    return result.ok ? result.data : [];
}

export async function getClosedCases() {
    const result = await apiGet('/cases/closed', { dedupe: false });
    return result;
}

export async function getCase(id) {
    const result = await apiGet(`/cases/${id}`);
    return result.ok ? result.data : null;
}

export async function createCase(caseData) {
    return await apiRequest('/cases', { method: 'POST', body: caseData });
}

export async function updateCase(id, caseData) {
    return await apiRequest(`/cases/${id}`, { method: 'PUT', body: caseData });
}

export async function closeCase(id) {
    return await apiRequest(`/cases/${id}/close`, { method: 'POST' });
}

export async function reopenCase(id) {
    return await apiRequest(`/cases/${id}/reopen`, { method: 'POST' });
}

export async function addParticipant(caseId, userTag, permissionLevel = 'read') {
    return await apiRequest(`/cases/${caseId}/participants`, {
        method: 'POST',
        body: { user_tag: userTag, permission_level: permissionLevel },
    });
}

export async function getParticipants(caseId) {
    const res = await apiGet(`/cases/${caseId}/participants`);
    return res.ok ? res.data : [];
}

export async function getCaseAgenda(caseId) {
    const res = await apiGet(`/cases/${caseId}/agenda`, { dedupe: false });
    return res.ok ? res.data : null;
}

export async function getCaseClients(caseId) {
    const res = await apiGet(`/cases/${caseId}/clients`, { dedupe: false });
    if (!res.ok) return [];

    const payload = res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.clients)) return payload.clients;
    if (Array.isArray(payload?.case?.clients)) return payload.case.clients;
    return [];
}

export async function getCaseParticipants(caseId) {
    const res = await apiGet(`/cases/${caseId}/participants`, { dedupe: false });
    if (!res.ok) return [];

    const payload = res.data;
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.participants)) return payload.participants;
    if (Array.isArray(payload?.case?.participants)) return payload.case.participants;
    return [];
}

export async function removeParticipant(caseId, userId) {
    return await apiRequest(`/cases/${caseId}/participants/${userId}`, {
        method: 'DELETE'
    });
}

export async function linkClientsToCase(caseId, clientIds) {
    return await apiRequest(`/cases/${caseId}/clients`, {
        method: 'POST',
        body: { client_ids: clientIds },
    });
}

export async function unlinkClientFromCase(caseId, clientId) {
    return await apiRequest(`/cases/${caseId}/clients/${clientId}`, { method: 'DELETE' });
}

export async function getCasesLastModified() {
    const result = await apiGet('/cases/last-modified');
    return result.ok ? result.data?.last_modified : null;
}

/**
 * Obtiene timestamps per-entity del last-modified de un caso específico.
 * Retorna un objeto con keys: case, partes, gastos, honorarios, documentos, eventos, clientes, multimedia, archivos.
 * Los valores son ISO strings o null si la entidad nunca fue modificada.
 * @param {number} caseId
 * @returns {Promise<Object|null>}
 */
export async function getCaseLastModified(caseId) {
    const result = await apiGet(`/cases/${caseId}/last-modified`, { dedupe: false });
    return result.ok ? result.data : null;
}

/**
 * Obtiene todos los artefactos del caso modificados desde una fecha dada.
 * Usa el endpoint syncDown que retorna solo las entidades actualizadas desde sinceDate.
 * @param {number} caseId
 * @param {string} sinceDate - formato 'YYYY-MM-DD HH:mm:ss' o ISO string
 * @returns {Promise<Object|null>}
 */
export async function getCaseSyncDown(caseId, sinceDate) {
    const encodedDate = encodeURIComponent(sinceDate);
    const result = await apiGet(`/cases/${caseId}/syncDown/${encodedDate}`, { dedupe: false });
    return result.ok ? result.data : null;
}

/**
 * Genera un enlace temporal (QR) para carga/descarga de archivos de un caso.
 * @param {number} caseId
 * @param {{ type: 'upload'|'download', modelType: 'file'|'multimedia', modelId?: number }} options
 */
export async function generateCaseLink(caseId, options) {
    console.log('[caseService] generateCaseLink calling IPC. CaseId:', caseId, 'Options:', JSON.stringify(options));
    return await window.electronAPI.cases.generateLink({ suit_case_id: caseId, ...options });
}
