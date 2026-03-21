import { apiGet, apiRequest } from './api.js';
import { extractMetadataCollection } from './metadata/metadataCacheUtils.js';

// --- Event Types ---

export async function getEventTypes() {
    const result = await apiGet('/event-types');
    return result.ok ? (extractMetadataCollection(result.data, 'event_types') || []) : [];
}

export async function createEventType(data) {
    return await apiRequest('/event-types', { method: 'POST', body: data });
}

export async function updateEventType(id, data) {
    return await apiRequest(`/event-types/${id}`, { method: 'PUT', body: data });
}

export async function deleteEventType(id) {
    return await apiRequest(`/event-types/${id}`, { method: 'DELETE' });
}

// --- Case Types ---

export async function getCaseTypes() {
    const result = await apiGet('/case-types');
    return result.ok ? (extractMetadataCollection(result.data, 'case_types') || []) : [];
}

export async function createCaseType(data) {
    return await apiRequest('/case-types', { method: 'POST', body: data });
}

export async function updateCaseType(id, data) {
    return await apiRequest(`/case-types/${id}`, { method: 'PUT', body: data });
}

export async function deleteCaseType(id) {
    return await apiRequest(`/case-types/${id}`, { method: 'DELETE' });
}

// --- System Settings ---

/**
 * Obtiene todas las configuraciones del sistema desde la API.
 */
export async function getSettings() {
    const result = await apiGet('/settings');
    return result.ok ? (result.data?.data || result.data || []) : [];
}

/**
 * Actualiza una configuración específica por su clave.
 */
export async function updateSetting(key, value) {
    return await apiRequest(`/settings/${key}`, {
        method: 'PUT',
        body: { value },
    });
}
