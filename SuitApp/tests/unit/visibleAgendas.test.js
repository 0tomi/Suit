import { describe, expect, it } from 'vitest';
import { splitVisibleAgendas } from '../../src/utils/agenda/visibleAgendas.js';

describe('splitVisibleAgendas', () => {
    it('oculta agendas de casos cerrados y mantiene personales/abiertas', () => {
        const agendas = [
            { id: 1, name: 'Personal', suit_case_id: null },
            { id: 2, name: 'Agenda: Caso abierto', suit_case_id: 10 },
            { id: 3, name: 'Agenda: Caso cerrado', suit_case_id: 11 },
            { id: 4, name: 'Agenda: Caso finalizado', suit_case_id: 12 },
            { id: 5, name: 'Agenda: Caso con end_date', suit_case_id: 13 },
        ];

        const cases = [
            { id: 10, status: 'open' },
            { id: 11, status: ' closed ' },
            { id: 12, status: 'Finalizado' },
            { id: 13, status: 'open', end_date: '2026-03-01T00:00:00.000Z' },
        ];

        const result = splitVisibleAgendas(agendas, cases);

        expect(result.personalAgendas.map((agenda) => agenda.id)).toEqual([1]);
        expect(result.caseAgendas.map((agenda) => agenda.id)).toEqual([2]);
        expect(result.visibleAgendas.map((agenda) => agenda.id)).toEqual([1, 2]);
        expect(Array.from(result.visibleAgendaIds)).toEqual(['1', '2']);
    });

    it('oculta casos cerrados cuando el backend usa state/case_status/is_closed/closed_at', () => {
        const agendas = [
            { id: 1, suit_case_id: 100, name: 'Abierto' },
            { id: 2, suit_case_id: 101, name: 'Cerrado por state' },
            { id: 3, suit_case_id: 102, name: 'Cerrado por case_status' },
            { id: 4, suit_case_id: 103, name: 'Cerrado por flag' },
            { id: 5, suit_case_id: 104, name: 'Cerrado por fecha' },
            { id: 6, suit_case_id: null, name: 'Personal' },
        ];

        const cases = [
            { id: 100, status: 'open' },
            { id: 101, state: 'Cerrada' },
            { id: 102, case_status: ' finalized ' },
            { id: 103, status: 'open', is_closed: '1' },
            { id: 104, status: 'open', closed_at: '2026-03-01T00:00:00.000Z' },
        ];

        const result = splitVisibleAgendas(agendas, cases);

        expect(result.visibleAgendas.map((agenda) => agenda.id)).toEqual([1, 6]);
        expect(result.caseAgendas.map((agenda) => agenda.id)).toEqual([1]);
        expect(result.personalAgendas.map((agenda) => agenda.id)).toEqual([6]);
    });
});
