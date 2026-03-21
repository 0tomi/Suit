import { syncResource, isServerUpToDate } from './syncCore.js';
import { deleteEvent as deleteEventRequest, getAllEvents, getLatestEventTimestamp, syncDown } from '../eventService.js';
import { fromApiStartsAt } from '../../utils/dateTimeAdapter.js';
import { createLogger } from '../logService.js';
const logger = createLogger('sync:event');


export function normalizeEventsPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.events)) return payload.events;

    const merged = [
        ...(Array.isArray(payload?.created) ? payload.created : []),
        ...(Array.isArray(payload?.updated) ? payload.updated : []),
    ];
    return merged;
}

function normalizeEventForCache(event) {
    const suitCaseId = event?.suit_case_id ?? event?.case_id ?? null;
    return {
        ...event,
        suit_case_id: suitCaseId,
    };
}

export function extractDeletedEventIds(payload) {
    const candidates = [
        payload?.deleted_ids,
        payload?.deletedIds,
        payload?.deleted_event_ids,
        payload?.deleted,
    ];

    for (const list of candidates) {
        if (Array.isArray(list)) {
            return list
                .map((id) => Number(id))
                .filter((id) => Number.isFinite(id));
        }
    }

    return [];
}

export async function syncEvents() {
    return await syncResource('events', null, fetchAndCacheEvents);
}

/**
 * Elimina un evento remoto y refleja el cambio en caché local.
 */
export async function deleteEventAndSync(eventId) {
    const result = await deleteEventRequest(eventId);
    if (!result.ok) return result;

    if (window.electronAPI) {
        try {
            await window.electronAPI.db.deleteById('events', eventId);
        } catch (err) {
            // Fallo en cache local tras éxito en servidor: no crítico, se autocorrige en el próximo sync
            void logger.warn('error deleting event locally', err);
        }
    }

    return result;
}

async function fetchAndCacheEvents(localTimestamp) {
    // Usar flujo de sync de agendas
    const serverTimestamp = await getLatestEventTimestamp();

    if (isServerUpToDate(serverTimestamp, localTimestamp)) {
        void logger.info('events up-to-date');
        return false;
    }

    let rawEventsPayload;
    if (localTimestamp) {
        // Sync incremental
        rawEventsPayload = await syncDown(localTimestamp);
    } else {
        // Full sync
        rawEventsPayload = await getAllEvents();
    }

    const events = normalizeEventsPayload(rawEventsPayload);
    const deletedIds = extractDeletedEventIds(rawEventsPayload);

    const rows = events.map((rawEvent) => {
        const event = normalizeEventForCache(rawEvent);
        return {
            id: event.id,
            agenda_id: event.agenda_id,
            suit_case_id: event.suit_case_id,
            event_type_id: event.event_type_id || 1,
            title: event.title,
            description: event.description,
            starts_at: fromApiStartsAt(event.starts_at) ?? null,
            is_all_day: event.is_all_day ? 1 : 0,
            data_json: JSON.stringify(event),
            synced_at: new Date().toISOString(),
        };
    });
    if (!localTimestamp) {
        await window.electronAPI.db.clearTable('events');
    }
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('events', rows);
    }
    if (deletedIds.length > 0) {
        await Promise.all(deletedIds.map((eventId) => window.electronAPI.db.deleteById('events', eventId)));
    }

    await window.electronAPI.sync.setMeta(
        'events',
        new Date().toISOString(),
        serverTimestamp || null
    );
    return true;
}

export default { syncEvents, deleteEventAndSync };
