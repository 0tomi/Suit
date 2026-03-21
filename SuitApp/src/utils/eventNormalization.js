import dayjs from 'dayjs';
import { toLocalInputValues, fromApiStartsAt } from './dateTimeAdapter.js';

function pickFirstDefined(values) {
    for (const value of values) {
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }

    return null;
}

export function readCaseId(raw) {
    return pickFirstDefined([
        raw?.suit_case_id,
        raw?.case_id,
        raw?.caseId,
    ]);
}

export function readEventTypeId(raw) {
    return pickFirstDefined([
        raw?.event_type_id,
        raw?.eventTypeId,
    ]);
}

export function readAgendaId(raw) {
    return pickFirstDefined([
        raw?.agenda_id,
        raw?.agendaId,
        raw?.agenda?.id,
    ]);
}

/**
 * Extrae el starts_at naive de un evento, normalizando desde la API o desde SQLite.
 * Si el evento viene de la API (con Z) lo limpia; si ya es naive lo devuelve tal cual.
 */
export function readStartsAt(raw) {
    return fromApiStartsAt(raw?.starts_at) ?? null;
}

export function normalizeAgendaEvent(rawEvent, agendaById = new Map()) {
    const startsAt = readStartsAt(rawEvent);
    const isAllDay = rawEvent?.is_all_day ? true : !startsAt?.includes('T') || rawEvent?.is_all_day === 1;

    const { dateInput: dateStr, timeInput: timeStr } = toLocalInputValues(startsAt, isAllDay);
    const agendaId = readAgendaId(rawEvent);
    const agenda = rawEvent?.agenda || agendaById.get(String(agendaId)) || null;

    // Construir Date objects para el calendario usando dayjs (local time).
    const startDate = timeStr
        ? dayjs(`${dateStr} ${timeStr}`).toDate()
        : dayjs(dateStr).startOf('day').toDate();
    const endDate = timeStr
        ? (() => {
            const tentativeEnd = dayjs(startDate).add(1, 'hour');
            const sameDayEnd = dayjs(startDate).endOf('day');
            return (tentativeEnd.isAfter(sameDayEnd) ? sameDayEnd : tentativeEnd).toDate();
        })()
        : dayjs(dateStr).endOf('day').toDate();

    const caseId = readCaseId(rawEvent);
    const eventTypeId = Number(readEventTypeId(rawEvent));
    const resolvedEventTypeId = Number.isFinite(eventTypeId) && eventTypeId > 0 ? eventTypeId : 1;

    return {
        id: rawEvent?.id,
        title: rawEvent?.title,
        starts_at: startsAt,
        is_all_day: isAllDay,
        // Aliases para compatibilidad con formularios y calendario
        date: dateStr,
        time: timeStr,
        start: startDate,
        end: endDate,
        description: rawEvent?.description || '',
        agenda_id: agendaId,
        agendaId: agendaId,
        agendaName: agenda?.name || '',
        agendaColor: agenda?.color || null,
        suit_case_id: caseId,
        suitCaseId: caseId,
        event_type_id: resolvedEventTypeId,
        eventTypeId: resolvedEventTypeId,
        hasNotification: !!rawEvent?.notification || !!rawEvent?.notification_id,
        pending_sync: rawEvent?.pending_sync === true,
        pendingSync: rawEvent?.pending_sync === true,
        pending_sync_status: rawEvent?.pending_sync_status ?? null,
        pendingSyncStatus: rawEvent?.pending_sync_status ?? null,
        pending_sync_error: rawEvent?.pending_sync_error ?? null,
        pendingSyncError: rawEvent?.pending_sync_error ?? null,
        allDay: isAllDay,
    };
}
