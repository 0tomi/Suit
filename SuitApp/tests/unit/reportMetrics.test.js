import { describe, expect, it } from 'vitest';
import {
    buildReportsMetrics,
    readEmbeddedCaseClients,
} from '../../src/utils/reports/reportMetrics.js';

describe('reportMetrics', () => {
    it('lee clientes embebidos desde clients o data_json', () => {
        const directClients = [{ id: 1 }, { id: 2 }];
        expect(readEmbeddedCaseClients({ clients: directClients })).toEqual(directClients);

        const jsonClients = [{ id: 3 }];
        expect(readEmbeddedCaseClients({
            data_json: JSON.stringify({ clients: jsonClients }),
        })).toEqual(jsonClients);

        expect(readEmbeddedCaseClients({ data_json: '{bad json' })).toBeNull();
    });

    it('calcula conteos, proximos items y actividad combinada', () => {
        const now = new Date('2026-03-14T10:00:00');
        const metrics = buildReportsMetrics({
            now,
            cases: [
                {
                    id: 101,
                    title: 'Caso activo',
                    status: 'active',
                    created_at: '2026-03-02T09:00:00',
                    clients: [{ id: 1 }, { id: 2 }],
                },
                {
                    id: 102,
                    title: 'Caso cerrado',
                    status: 'closed',
                    created_at: '2026-02-02T09:00:00',
                    end_date: '2026-02-20',
                    clients: [{ id: 3 }],
                },
                {
                    id: 103,
                    title: 'Caso sin clientes embebidos',
                    status: 'Activo',
                    created_at: '2026-03-05T11:00:00',
                },
            ],
            clients: [
                { id: 1, created_at: '2026-03-01T08:00:00' },
                { id: 2, created_at: '2026-03-03T08:00:00' },
                { id: 4, created_at: '2026-02-15T08:00:00' },
            ],
            events: [
                { id: 201, title: 'Evento pasado', starts_at: '2026-03-10T09:00:00' },
                { id: 202, title: 'Evento proximo', starts_at: '2026-03-15T09:30:00', description: 'Audiencia' },
                { id: 203, title: 'Evento lejano', starts_at: '2026-03-20T12:00:00' },
            ],
            deadlines: [
                { id: 301, title: 'Vencimiento cumplido', due_date: '2026-03-10', status: 'Cumplido', priority: 'Normal' },
                { id: 302, title: 'Vencimiento proximo', due_date: '2026-03-16', status: 'Pendiente', priority: 'Normal' },
                { id: 303, title: 'Urgente', due_date: '2026-03-15', status: 'Prorrogado', priority: 'Urgente' },
            ],
            resolvedCaseClientsByCaseId: {
                103: [{ id: 4 }],
            },
        });

        expect(metrics.counts).toEqual({
            activeCases: 2,
            pendingEvents: 2,
            deadlines: 2,
            activeClients: 3,
        });

        expect(metrics.upcoming.nextEvent?.title).toBe('Evento proximo');
        expect(metrics.upcoming.nextDeadline?.title).toBe('Urgente');
        expect(metrics.upcoming.nextUrgentDeadline?.title).toBe('Urgente');

        expect(metrics.activity.month.total).toBe(7);
        expect(metrics.activity.month.events).toBe(3);
        expect(metrics.activity.month.cases).toBe(2);
        expect(metrics.activity.month.clients).toBe(2);
        expect(metrics.activity.year.total).toBeGreaterThanOrEqual(metrics.activity.month.total);
        expect(metrics.activity.timeline).toHaveLength(12);
        expect(metrics.activity.peakValue).toBeGreaterThanOrEqual(1);
    });
});
