import { describe, expect, it } from 'vitest';
import { buildAgendaRenderEvents } from '../../src/utils/agendaColor/buildAgendaRenderEvents.js';

describe('buildAgendaRenderEvents', () => {
    it('filtra por caso y agenda, normaliza y agrega trazabilidad de color', () => {
        const rawEvents = [
            { id: 1, title: 'Caso 10', date: '2026-03-02', time: '09:00', agenda_id: 1, suit_case_id: 10, event_type_id: 1 },
            { id: 2, title: 'Caso 11', date: '2026-03-02', time: '10:00', agenda_id: 2, suit_case_id: 11, event_type_id: 1 },
            { id: 3, title: 'Personal', date: '2026-03-03', time: null, agenda_id: 1, suit_case_id: null, event_type_id: 1 },
        ];

        const events = buildAgendaRenderEvents({
            rawEvents,
            agendas: [{ id: 1, name: 'Personal' }, { id: 2, name: 'Caso 11' }],
            caseId: 10,
            selectedFilterAgenda: '1',
            resolveColorDetails: (event) => ({
                color: event.suit_case_id ? '#ef4444' : '#3b82f6',
                source: event.suit_case_id ? 'eventType' : 'personalColor',
                reason: event.suit_case_id ? 'resolved_event_type' : 'personal_event',
                mode: 'eventType',
            }),
        });

        expect(events).toHaveLength(1);
        expect(events[0]).toEqual(expect.objectContaining({
            id: 1,
            title: 'Caso 10',
            suit_case_id: 10,
            event_type_id: 1,
            resolvedColor: '#ef4444',
            colorSource: 'eventType',
            colorReason: 'resolved_event_type',
            colorMode: 'eventType',
        }));
        expect(events[0].start).toBeInstanceOf(Date);
        expect(events[0].end).toBeInstanceOf(Date);
    });
});
