import { fromApiStartsAt } from '../utils/dateTimeAdapter.js';

export const EVENT_OUTBOX_STATUS = Object.freeze({
    PENDING_EVENT: 'pending_event',
    PENDING_NOTIFICATION: 'pending_notification',
    FAILED: 'failed',
});

let tempEventCounter = 0;

function toFiniteNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

export function createTemporaryEventId() {
    tempEventCounter += 1;
    return -1 * (Date.now() + tempEventCounter);
}

export function isOfflineLikeResult(resultOrError) {
    const status = Number(resultOrError?.status);
    if (status === 0) return true;

    const message = String(resultOrError?.error || resultOrError?.message || '').toLowerCase();
    return (
        message.includes('network')
        || message.includes('fetch')
        || message.includes('timeout')
        || message.includes('conexion')
        || message.includes('connection')
    );
}

export function buildNotificationIntent(minutes) {
    if (minutes == null) {
        return { action: 'none', minutes: null };
    }

    return {
        action: 'upsert',
        minutes: Number(minutes),
    };
}

export function normalizeEventRecord(rawEvent, {
    pendingSync = false,
    pendingStatus = null,
    pendingError = null,
    localOrigin = null,
    forceId = undefined,
} = {}) {
    const safeEvent = rawEvent && typeof rawEvent === 'object' ? rawEvent : {};
    const rawId = forceId ?? safeEvent.id ?? safeEvent.event_id ?? safeEvent.eventId;
    const id = toFiniteNumber(rawId);
    const agendaId = toFiniteNumber(safeEvent.agenda_id ?? safeEvent.agendaId ?? safeEvent.agenda?.id);
    const suitCaseId = safeEvent.suit_case_id ?? safeEvent.case_id ?? safeEvent.caseId ?? null;
    const eventTypeId = toFiniteNumber(safeEvent.event_type_id ?? safeEvent.eventTypeId) || 1;

    const startsAt = fromApiStartsAt(safeEvent.starts_at) ?? safeEvent.starts_at ?? null;
    return {
        ...safeEvent,
        id,
        agenda_id: agendaId,
        agendaId,
        suit_case_id: suitCaseId,
        suitCaseId: suitCaseId,
        event_type_id: eventTypeId,
        eventTypeId,
        title: safeEvent.title ?? '',
        description: safeEvent.description ?? null,
        starts_at: startsAt,
        is_all_day: safeEvent.is_all_day ? 1 : 0,
        pending_sync: pendingSync,
        pending_sync_status: pendingStatus,
        pending_sync_error: pendingError,
        local_origin: localOrigin,
    };
}

export function buildEventCacheRow(rawEvent) {
    const event = normalizeEventRecord(rawEvent, {
        pendingSync: rawEvent?.pending_sync === true,
        pendingStatus: rawEvent?.pending_sync_status ?? null,
        pendingError: rawEvent?.pending_sync_error ?? null,
        localOrigin: rawEvent?.local_origin ?? null,
    });

    return {
        id: event.id,
        agenda_id: event.agenda_id,
        suit_case_id: event.suit_case_id,
        event_type_id: event.event_type_id || 1,
        title: event.title,
        description: event.description,
        starts_at: event.starts_at,
        is_all_day: event.is_all_day ? 1 : 0,
        data_json: JSON.stringify(event),
        synced_at: new Date().toISOString(),
    };
}

export function buildFallbackEventRecord(eventPayload, eventId = null) {
    return normalizeEventRecord({
        ...eventPayload,
        id: eventId ?? eventPayload?.id ?? null,
    }, {
        forceId: eventId ?? eventPayload?.id ?? null,
    });
}

function looksLikeEventRecord(candidate) {
    if (!candidate || typeof candidate !== 'object') return false;
    return (
        candidate.id != null
        || candidate.event_id != null
        || (
            candidate.agenda_id != null
            && candidate.starts_at != null
            && candidate.title != null
        )
    );
}

export function extractEventRecordFromCreateResponse(payload, fallbackPayload) {
    const candidates = [
        payload?.event,
        payload?.data?.event,
        payload?.data,
        payload,
    ];

    for (const candidate of candidates) {
        if (!looksLikeEventRecord(candidate)) continue;
        return normalizeEventRecord({
            ...fallbackPayload,
            ...candidate,
        });
    }

    return normalizeEventRecord(fallbackPayload);
}

export function buildPendingEventRecord(eventPayload, {
    localEventId,
    status = EVENT_OUTBOX_STATUS.PENDING_EVENT,
    error = null,
} = {}) {
    return normalizeEventRecord({
        ...eventPayload,
        id: localEventId,
    }, {
        forceId: localEventId,
        pendingSync: true,
        pendingStatus: status,
        pendingError: error,
        localOrigin: 'outbox',
    });
}

export function buildEventOutboxRow({
    localEventId,
    remoteEventId = null,
    eventPayload,
    notificationIntent = null,
    status = EVENT_OUTBOX_STATUS.PENDING_EVENT,
    retryCount = 0,
    lastError = null,
    createdAt = null,
    updatedAt = null,
}) {
    const nowIso = new Date().toISOString();
    return {
        local_event_id: Number(localEventId),
        remote_event_id: remoteEventId == null ? null : Number(remoteEventId),
        event_payload_json: JSON.stringify(eventPayload || {}),
        notification_payload_json: notificationIntent ? JSON.stringify(notificationIntent) : null,
        status,
        retry_count: retryCount,
        last_error: lastError,
        created_at: createdAt || nowIso,
        updated_at: updatedAt || nowIso,
    };
}

export function parseEventOutboxRow(row) {
    if (!row) return null;

    let eventPayload = {};
    let notificationIntent = null;

    try {
        eventPayload = row.event_payload_json ? JSON.parse(row.event_payload_json) : {};
    } catch {
        eventPayload = {};
    }

    try {
        notificationIntent = row.notification_payload_json ? JSON.parse(row.notification_payload_json) : null;
    } catch {
        notificationIntent = null;
    }

    return {
        ...row,
        eventPayload,
        notificationIntent,
    };
}
