/**
 * eventService.js — CRUD de eventos/agenda contra la API SuitAPI.
 */
import { apiGet, apiRequest } from './api.js';

/**
 * Obtiene todos los eventos unificados del usuario (personal + casos).
 */
export async function getAllEvents() {
    const result = await apiGet('/agendas/all-events', { dedupe: false });
    return result.ok ? result.data : [];
}

/**
 * Obtiene todos los eventos unificados para un mes/año específicos.
 */
export async function getAllEventsByMonth(month, year) {
    const result = await apiGet(`/agendas/all-events/${month}/${year}`, { dedupe: false });
    if (!result.ok) {
        throw new Error(result.error || `Error al obtener eventos unificados para ${year}-${month}`);
    }
    return Array.isArray(result.data) ? result.data : [];
}

/**
 * Obtiene los eventos de una agenda para un mes/año específicos.
 */
export async function getAgendaEventsByMonth(agendaId, month, year) {
    const result = await apiGet(`/agenda/${agendaId}/${month}/${year}`, { dedupe: false });
    if (!result.ok) {
        throw new Error(result.error || `Error al obtener eventos de agenda ${agendaId} para ${year}-${month}`);
    }
    return Array.isArray(result.data) ? result.data : [];
}

/**
 * Obtiene la última modificación de eventos de una agenda en un mes/año específicos.
 */
export async function getAgendaMonthLastModified(agendaId, month, year) {
    const result = await apiGet(`/agenda/${agendaId}/last-modified/${month}/${year}`, { dedupe: false });
    if (!result.ok) {
        throw new Error(result.error || `Error al obtener last-modified de agenda ${agendaId} para ${year}-${month}`);
    }
    return result.data?.last_modified ?? null;
}

/**
 * Obtiene la última modificación global para todos los eventos accesibles en un mes/año específicos.
 */
export async function getAllEventsMonthLastModified(month, year) {
    const result = await apiGet(`/agendas/all-events/last-modified/${month}/${year}`, { dedupe: false });
    if (!result.ok) {
        throw new Error(result.error || `Error al obtener last-modified global para ${year}-${month}`);
    }
    return result.data?.last_modified ?? null;
}

/**
 * Obtiene el timestamp de la última modificación global de agendas.
 */
export async function getLatestEventTimestamp() {
    const result = await apiGet('/agendas/latest-event', { dedupe: false });
    return result.ok ? result.data?.last_event_update : null;
}

/**
 * Sync down — obtiene eventos modificados después de la fecha indicada.
 */
export async function syncDown(since) {
    const result = await apiGet('/agendas/sync', {
        params: { since },
        dedupe: false,
    });
    return result.ok ? result.data : [];
}

/**
 * Sync up — envía eventos locales al servidor.
 */
export async function syncUp(events) {
    return await apiRequest('/agendas/sync', {
        method: 'POST',
        body: { events },
    });
}

/**
 * Crea un nuevo evento.
 */
export async function createEvent(eventData) {
    return await apiRequest('/events', { method: 'POST', body: eventData });
}

/**
 * Actualiza un evento existente.
 */
export async function updateEvent(eventId, eventData) {
    return await apiRequest(`/events/${eventId}`, { method: 'PUT', body: eventData });
}

/**
 * Elimina un evento.
 */
export async function deleteEvent(eventId) {
    return await apiRequest(`/events/${eventId}`, { method: 'DELETE' });
}
