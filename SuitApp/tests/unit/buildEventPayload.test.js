import { describe, expect, it } from 'vitest';
import { buildEventPayload } from '../../src/utils/agenda/buildEventPayload.js';

describe('buildEventPayload', () => {
    it('deriva suit_case_id desde la agenda cuando formData.caseId no está', () => {
        const agendasById = new Map([
            ['10', { id: 10, suit_case_id: 23 }],
        ]);

        const payload = buildEventPayload({
            title: 'Evento',
            date: '2026-03-02',
            time: '11:00',
            agendaId: '10',
            caseId: '',
            eventTypeId: '3',
        }, agendasById);

        expect(payload).toEqual({
            title: 'Evento',
            starts_at: '2026-03-02T11:00:00Z',
            is_all_day: false,
            description: null,
            agenda_id: 10,
            suit_case_id: 23,
            event_type_id: 3,
        });
    });

    it('prioriza caseId explícito en el formulario', () => {
        const agendasById = new Map([
            ['10', { id: 10, suit_case_id: 23 }],
        ]);

        const payload = buildEventPayload({
            title: 'Evento',
            date: '2026-03-02',
            agendaId: '10',
            caseId: '99',
            eventTypeId: '',
        }, agendasById);

        expect(payload.suit_case_id).toBe(99);
        expect(payload.event_type_id).toBe(1);
    });

    it('evento todo el día cuando time está vacío', () => {
        const payload = buildEventPayload({
            title: 'Feriado',
            date: '2026-05-25',
            time: '',
            agendaId: '1',
        }, new Map([['1', { id: 1 }]]));

        expect(payload.is_all_day).toBe(true);
        expect(payload.starts_at).toBe('2026-05-25T00:00:00Z');
    });
});
