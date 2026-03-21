import { describe, expect, it } from 'vitest';
import { replaceAgendaMonthEventsInMemory } from '../../src/services/events/eventStateUtils.js';

describe('eventStateUtils', () => {
    it('preserva flags pending locales cuando llega el mismo evento desde el refresh mensual', () => {
        const result = replaceAgendaMonthEventsInMemory([
            {
                id: 10,
                agenda_id: 3,
                title: 'Local',
                date: '2026-03-12',
                pending_sync: true,
                pending_sync_status: 'pending_notification',
                pending_sync_error: 'Sincronizando',
                local_origin: 'outbox',
            },
        ], {
            agendaId: 3,
            year: 2026,
            month: 3,
            events: [
                {
                    id: 10,
                    agenda_id: 3,
                    title: 'Remoto',
                    date: '2026-03-12',
                },
            ],
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(expect.objectContaining({
            id: 10,
            title: 'Remoto',
            pending_sync: true,
            pending_sync_status: 'pending_notification',
            pending_sync_error: 'Sincronizando',
            local_origin: 'outbox',
        }));
    });

    it('elimina eventos normales ausentes y preserva pendientes del mes actual', () => {
        const result = replaceAgendaMonthEventsInMemory([
            {
                id: 20,
                agenda_id: 5,
                title: 'Pendiente',
                date: '2026-03-10',
                pending_sync: true,
                pending_sync_status: 'failed',
                local_origin: 'outbox',
            },
            {
                id: 21,
                agenda_id: 5,
                title: 'Normal',
                date: '2026-03-15',
            },
            {
                id: 22,
                agenda_id: 5,
                title: 'Otro mes',
                date: '2026-04-01',
            },
        ], {
            agendaId: 5,
            year: 2026,
            month: 3,
            events: [],
        });

        expect(result.map((event) => event.id).sort((a, b) => a - b)).toEqual([20, 22]);
        expect(result.find((event) => event.id === 20)).toEqual(expect.objectContaining({
            pending_sync: true,
            pending_sync_status: 'failed',
        }));
    });

    it('reemplaza eventos del mes aunque la caché local solo tenga starts_at', () => {
        const result = replaceAgendaMonthEventsInMemory([
            {
                id: 55,
                agenda_id: 26,
                title: 'Evento verde',
                starts_at: '2026-03-06T00:00:00',
            },
        ], {
            agendaId: 26,
            year: 2026,
            month: 3,
            events: [
                {
                    id: 55,
                    agenda_id: 26,
                    title: 'Evento verde',
                    starts_at: '2026-03-06T00:00:00',
                },
            ],
        });

        expect(result).toHaveLength(1);
        expect(result[0]).toEqual(expect.objectContaining({
            id: 55,
            agenda_id: 26,
            title: 'Evento verde',
        }));
    });
});
