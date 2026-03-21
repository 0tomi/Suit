import dayjs from 'dayjs';
import { normalizeEventRecord } from '../eventMutationUtils.js';

export const initialEventsState = {
    events: [],
    agendas: [],
    syncing: false,
    initialized: false,
};

export function toPositiveInt(value) {
    const parsed = Number(value);
    if (!Number.isFinite(parsed) || parsed < 1 || !Number.isInteger(parsed)) return null;
    return parsed;
}

export function normalizeStoredEvent(rawEvent) {
    return normalizeEventRecord(rawEvent, {
        pendingSync: rawEvent?.pending_sync === true,
        pendingStatus: rawEvent?.pending_sync_status ?? null,
        pendingError: rawEvent?.pending_sync_error ?? null,
        localOrigin: rawEvent?.local_origin ?? null,
    });
}

export function mergePendingSyncState(existingEvent, incomingEvent) {
    const nextEvent = normalizeStoredEvent(incomingEvent);
    const previousEvent = existingEvent ? normalizeStoredEvent(existingEvent) : null;

    if (!previousEvent?.pending_sync || nextEvent.pending_sync === true) {
        return nextEvent;
    }

    return normalizeEventRecord({
        ...nextEvent,
        pending_sync: true,
        pending_sync_status: previousEvent.pending_sync_status ?? null,
        pending_sync_error: previousEvent.pending_sync_error ?? null,
        local_origin: previousEvent.local_origin ?? nextEvent.local_origin ?? null,
    }, {
        pendingSync: true,
        pendingStatus: previousEvent.pending_sync_status ?? null,
        pendingError: previousEvent.pending_sync_error ?? null,
        localOrigin: previousEvent.local_origin ?? nextEvent.local_origin ?? null,
    });
}

/**
 * Unifica la fecha de referencia para comparar un evento cacheado contra un refresh mensual.
 * Algunos registros llegan desde SQLite con `starts_at` y otros desde el calendario con `date/start`.
 */
function resolveEventReferenceDate(event) {
    const candidates = [
        event?.date,
        event?.start_date,
        event?.starts_at,
        event?.start,
    ];

    for (const candidate of candidates) {
        if (!candidate) continue;
        const parsed = dayjs(candidate);
        if (parsed.isValid()) {
            return parsed;
        }
    }

    return null;
}

export function eventMatchesAgendaMonth(event, agendaId, year, month) {
    const eventAgendaId = toPositiveInt(event?.agenda_id ?? event?.agendaId ?? event?.agenda?.id);
    if (!eventAgendaId || eventAgendaId !== agendaId) return false;

    const parsedDate = resolveEventReferenceDate(event);
    if (!parsedDate?.isValid()) return false;

    return parsedDate.year() === year && (parsedDate.month() + 1) === month;
}

export function replaceAgendaMonthEventsInMemory(existingEvents, payload) {
    const normalizedAgendaId = toPositiveInt(payload?.agendaId);
    const normalizedYear = toPositiveInt(payload?.year);
    const normalizedMonth = toPositiveInt(payload?.month);
    const nextEvents = Array.isArray(payload?.events) ? payload.events : [];

    if (!normalizedAgendaId || !normalizedYear || !normalizedMonth) {
        return Array.isArray(existingEvents) ? existingEvents : [];
    }

    const safeExisting = Array.isArray(existingEvents) ? existingEvents : [];
    const retained = [];
    const matchingPendingById = new Map();

    for (const event of safeExisting) {
        if (!eventMatchesAgendaMonth(event, normalizedAgendaId, normalizedYear, normalizedMonth)) {
            retained.push(event);
            continue;
        }

        if (event?.pending_sync === true) {
            matchingPendingById.set(String(event.id), normalizeStoredEvent(event));
        }
    }

    const merged = nextEvents.map((event) =>
        mergePendingSyncState(matchingPendingById.get(String(event?.id)), event)
    );

    for (const [eventId, event] of matchingPendingById.entries()) {
        if (merged.some((candidate) => String(candidate?.id) === eventId)) continue;
        merged.push(event);
    }

    return [...retained, ...merged];
}

export function upsertEventInMemory(existingEvents, rawEvent) {
    const nextEvent = normalizeStoredEvent(rawEvent);
    const safeExisting = Array.isArray(existingEvents) ? existingEvents : [];
    const next = safeExisting.filter((event) => String(event?.id) !== String(nextEvent.id));
    next.push(nextEvent);
    return next;
}

export function replaceEventIdInMemory(existingEvents, tempId, rawEvent) {
    const withoutTemp = (Array.isArray(existingEvents) ? existingEvents : [])
        .filter((event) => String(event?.id) !== String(tempId));
    return upsertEventInMemory(withoutTemp, rawEvent);
}

export function removeEventInMemory(existingEvents, eventId) {
    return (Array.isArray(existingEvents) ? existingEvents : [])
        .filter((event) => String(event?.id) !== String(eventId));
}

export function eventsReducer(state, action) {
    switch (action.type) {
        case 'SET_DATA':
            return {
                ...state,
                events: action.payload.events,
                agendas: action.payload.agendas,
            };
        case 'SET_SYNCING':
            return {
                ...state,
                syncing: action.payload,
            };
        case 'RESET_DATA':
            return {
                ...initialEventsState,
            };
        case 'SET_INITIALIZED':
            return {
                ...state,
                initialized: action.payload,
            };
        case 'REPLACE_AGENDA_MONTH_EVENTS':
            return {
                ...state,
                events: replaceAgendaMonthEventsInMemory(state.events, action.payload),
            };
        case 'UPSERT_EVENT':
            return {
                ...state,
                events: upsertEventInMemory(state.events, action.payload),
            };
        case 'REPLACE_EVENT_ID':
            return {
                ...state,
                events: replaceEventIdInMemory(state.events, action.payload.tempId, action.payload.event),
            };
        case 'REMOVE_EVENT':
            return {
                ...state,
                events: removeEventInMemory(state.events, action.payload),
            };
        default:
            return state;
    }
}
