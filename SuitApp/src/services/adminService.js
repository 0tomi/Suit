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
 * Normaliza una fila de configuración para que la UI reciba siempre
 * un contrato consistente (`key`, `value`, `description`).
 */
export function normalizeSystemSettingEntry(rawSetting) {
    if (!rawSetting || typeof rawSetting !== 'object') return null;

    const key = rawSetting.key ?? rawSetting.setting_key ?? rawSetting.name ?? null;
    if (!key) return null;

    return {
        key: String(key),
        value: String(rawSetting.value ?? rawSetting.setting_value ?? ''),
        description: String(rawSetting.description ?? rawSetting.label ?? ''),
    };
}

/**
 * Extrae la colección de configuraciones desde distintos envelopes válidos
 * que puede devolver el sistema.
 */
export function extractSettingsCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];

    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.settings)) return payload.settings;
    if (Array.isArray(payload.configurations)) return payload.configurations;
    if (Array.isArray(payload.items)) return payload.items;

    return [];
}

/**
 * Obtiene todas las configuraciones globales del sistema.
 */
export async function getSettings() {
    const result = await apiGet('/settings');
    if (!result.ok) {
        throw new Error(result?.data?.message || 'No se pudieron cargar las configuraciones del sistema.');
    }

    return extractSettingsCollection(result.data)
        .map(normalizeSystemSettingEntry)
        .filter(Boolean);
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
