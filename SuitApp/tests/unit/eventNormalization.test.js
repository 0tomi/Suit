import { describe, expect, it } from 'vitest';
import { normalizeAgendaEvent, readCaseId, readEventTypeId } from '../../src/utils/eventNormalization.js';

describe('eventNormalization', () => {
    it('readCaseId prioriza suit_case_id sobre case_id y caseId', () => {
        expect(readCaseId({ case_id: 10, suit_case_id: 20, caseId: 30 })).toBe(20);
        expect(readCaseId({ suit_case_id: 20, caseId: 30 })).toBe(20);
        expect(readCaseId({ caseId: 30 })).toBe(30);
    });

    it('readEventTypeId soporta event_type_id y eventTypeId', () => {
        expect(readEventTypeId({ event_type_id: 5, eventTypeId: 6 })).toBe(5);
        expect(readEventTypeId({ eventTypeId: 6 })).toBe(6);
    });

    it('normalizeAgendaEvent adapta payload con starts_at al contrato de calendario', () => {
        const agendaById = new Map([['1', { id: 1, name: 'Agenda Personal', color: '#2563eb' }]]);

        const normalized = normalizeAgendaEvent({
            id: 99,
            title: 'Audiencia',
            starts_at: '2026-03-02T10:00:00',
            is_all_day: 0,
            agenda_id: 1,
            case_id: 77,
            event_type_id: 3,
        }, agendaById);

        expect(normalized.suit_case_id).toBe(77);
        expect(normalized.suitCaseId).toBe(77);
        expect(normalized.event_type_id).toBe(3);
        expect(normalized.eventTypeId).toBe(3);
        expect(normalized.agenda_id).toBe(1);
        expect(normalized.agendaColor).toBe('#2563eb');
        expect(normalized.start instanceof Date).toBe(true);
        expect(normalized.end instanceof Date).toBe(true);
        expect(normalized.date).toBe('2026-03-02');
        expect(normalized.time).toBe('10:00');
        expect(normalized.allDay).toBe(false);
    });

    it('normalizeAgendaEvent evento all-day: is_all_day = true', () => {
        const normalized = normalizeAgendaEvent({
            id: 100,
            title: 'Feriado',
            starts_at: '2026-03-02T00:00:00',
            is_all_day: 1,
            agenda_id: 1,
            suit_case_id: 88,
            eventTypeId: 4,
        });

        expect(normalized.suit_case_id).toBe(88);
        expect(normalized.suitCaseId).toBe(88);
        expect(normalized.event_type_id).toBe(4);
        expect(normalized.allDay).toBe(true);
        expect(normalized.time).toBe('');
    });

    it('normalizeAgendaEvent no extiende eventos nocturnos al dia siguiente en vista mes', () => {
        const normalized = normalizeAgendaEvent({
            id: 101,
            title: 'Cierre tardio',
            starts_at: '2026-03-09T23:09:00',
            is_all_day: 0,
            agenda_id: 1,
        });

        expect(normalized.start.getDate()).toBe(9);
        expect(normalized.end.getDate()).toBe(9);
        expect(normalized.end.getHours()).toBe(23);
        expect(normalized.end.getMinutes()).toBe(59);
    });

    it('normalizeAgendaEvent acepta starts_at con Z (API) y lo limpia correctamente', () => {
        const normalized = normalizeAgendaEvent({
            id: 102,
            title: 'API Event',
            starts_at: '2026-04-15T09:30:00.000000Z',
            is_all_day: false,
            agenda_id: 2,
        });

        expect(normalized.date).toBe('2026-04-15');
        expect(normalized.time).toBe('09:30');
        expect(normalized.starts_at).toBe('2026-04-15T09:30:00');
    });
});
