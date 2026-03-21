import { beforeEach, describe, expect, it, vi } from 'vitest';

const syncAgendas = vi.fn().mockResolvedValue(undefined);
const getAgendaEventsByMonth = vi.fn().mockResolvedValue([]);
const getAgendaMonthLastModified = vi.fn().mockResolvedValue(null);
const getAllEventsByMonth = vi.fn().mockResolvedValue([]);
const getAllEventsMonthLastModified = vi.fn().mockResolvedValue(null);
const getApiBase = vi.fn(() => 'http://localhost:8000/api');

vi.mock('../../src/services/sync/agendaSyncService.js', () => ({
    syncAgendas: (...args) => syncAgendas(...args),
}));

vi.mock('../../src/services/eventService.js', () => ({
    getAgendaEventsByMonth: (...args) => getAgendaEventsByMonth(...args),
    getAgendaMonthLastModified: (...args) => getAgendaMonthLastModified(...args),
    getAllEventsByMonth: (...args) => getAllEventsByMonth(...args),
    getAllEventsMonthLastModified: (...args) => getAllEventsMonthLastModified(...args),
}));

vi.mock('../../src/services/api.js', () => ({
    getApiBase: (...args) => getApiBase(...args),
}));

import {
    buildAllAgendasMonthMetaResource,
    buildAgendaMonthMetaResource,
    resolveVisibleMonthTargets,
    syncAgendaEventsForView,
} from '../../src/services/sync/agendaMonthSyncService.js';

describe('agendaMonthSyncService', () => {
    beforeEach(() => {
        syncAgendas.mockClear();
        getAgendaEventsByMonth.mockClear();
        getAgendaMonthLastModified.mockClear();
        getAllEventsByMonth.mockClear();
        getAllEventsMonthLastModified.mockClear();
        getApiBase.mockReturnValue('http://localhost:8000/api');

        window.electronAPI = {
            db: {
                getAll: vi.fn(async (table) => {
                    if (table === 'agendas') return [{ id: 10, data_json: JSON.stringify({ id: 10 }) }];
                    return [];
                }),
                reconcileEventsForAgendaMonth: vi.fn().mockResolvedValue(undefined),
            },
            sync: {
                getMeta: vi.fn().mockResolvedValue(null),
                setMeta: vi.fn().mockResolvedValue(undefined),
            },
        };
    });

    it('resuelve 12 meses para vista year', () => {
        const months = resolveVisibleMonthTargets(new Date('2026-03-15T10:00:00Z'), 'year');
        expect(months).toHaveLength(12);
        expect(months[0]).toEqual({ year: 2026, month: 1 });
        expect(months[11]).toEqual({ year: 2026, month: 12 });
    });

    it('hace fetch mensual y cachea cuando no existe meta local', async () => {
        getAgendaEventsByMonth.mockResolvedValueOnce([
            {
                id: 501,
                agenda_id: 10,
                case_id: 77,
                title: 'Evento marzo',
                starts_at: '2026-03-10T10:00:00',
                is_all_day: 0,
            },
        ]);
        getAgendaMonthLastModified.mockResolvedValueOnce('2026-03-10 10:00:00');

        const changed = await syncAgendaEventsForView({
            date: new Date('2026-03-12T12:00:00Z'),
            view: 'month',
            agendaId: 10,
        });

        expect(changed).toBe(true);
        expect(syncAgendas).toHaveBeenCalledTimes(1);
        expect(getAgendaEventsByMonth).toHaveBeenCalledWith(10, 3, 2026);
        expect(window.electronAPI.db.reconcileEventsForAgendaMonth).toHaveBeenCalledTimes(1);
        expect(window.electronAPI.db.reconcileEventsForAgendaMonth).toHaveBeenCalledWith(
            10,
            2026,
            3,
            [
                expect.not.objectContaining({ case_id: expect.anything() }),
            ],
        );
        const rows = window.electronAPI.db.reconcileEventsForAgendaMonth.mock.calls[0][3];
        expect(rows[0]).toEqual(expect.objectContaining({
            id: 501,
            agenda_id: 10,
            suit_case_id: 77,
        }));
        expect(JSON.parse(rows[0].data_json)).toEqual(expect.objectContaining({
            id: 501,
            suit_case_id: 77,
        }));
        expect(window.electronAPI.sync.setMeta).toHaveBeenCalledWith(
            buildAgendaMonthMetaResource(10, 2026, 3),
            expect.any(String),
            '2026-03-10 10:00:00',
        );
    });

    it('usa cache local cuando last-modified indica que está vigente', async () => {
        window.electronAPI.sync.getMeta.mockResolvedValueOnce({
            resource: buildAgendaMonthMetaResource(10, 2026, 3),
            last_server: '2026-03-10 10:00:00',
        });
        getAgendaMonthLastModified.mockResolvedValueOnce('2026-03-10 10:00:00');

        const changed = await syncAgendaEventsForView({
            date: new Date('2026-03-20T09:00:00Z'),
            view: 'month',
            agendaId: 10,
        });

        expect(changed).toBe(false);
        expect(getAgendaMonthLastModified).toHaveBeenCalledWith(10, 3, 2026);
        expect(getAgendaEventsByMonth).not.toHaveBeenCalled();
        expect(window.electronAPI.db.reconcileEventsForAgendaMonth).not.toHaveBeenCalled();
    });

    it('refresca mes cuando cache está stale', async () => {
        window.electronAPI.sync.getMeta.mockResolvedValueOnce({
            resource: buildAgendaMonthMetaResource(10, 2026, 3),
            last_server: '2026-03-01 00:00:00',
        });
        getAgendaMonthLastModified.mockResolvedValueOnce('2026-03-15 08:30:00');
        getAgendaEventsByMonth.mockResolvedValueOnce([
            {
                id: 777,
                agenda_id: 10,
                title: 'Evento actualizado',
                starts_at: '2026-03-25T00:00:00',
                is_all_day: 1,
            },
        ]);

        const changed = await syncAgendaEventsForView({
            date: new Date('2026-03-25T09:00:00Z'),
            view: 'month',
            agendaId: 10,
        });

        expect(changed).toBe(true);
        expect(getAgendaEventsByMonth).toHaveBeenCalledWith(10, 3, 2026);
        expect(window.electronAPI.db.reconcileEventsForAgendaMonth).toHaveBeenCalledTimes(1);
        expect(window.electronAPI.sync.setMeta).toHaveBeenCalledWith(
            buildAgendaMonthMetaResource(10, 2026, 3),
            expect.any(String),
            '2026-03-15 08:30:00',
        );
    });

    it('usa endpoint unificado mensual cuando agendaId es ALL', async () => {
        getAllEventsByMonth.mockResolvedValueOnce([
            {
                id: 901,
                agenda_id: 10,
                title: 'Evento ALL',
                starts_at: '2026-03-11T14:00:00',
                is_all_day: 0,
            },
        ]);
        getAllEventsMonthLastModified.mockResolvedValueOnce('2026-03-11 14:00:00');

        const changed = await syncAgendaEventsForView({
            date: new Date('2026-03-11T12:00:00Z'),
            view: 'month',
            agendaId: 'ALL',
        });

        expect(changed).toBe(true);
        expect(getAllEventsByMonth).toHaveBeenCalledWith(3, 2026);
        expect(getAgendaEventsByMonth).not.toHaveBeenCalled();
        expect(window.electronAPI.db.reconcileEventsForAgendaMonth).toHaveBeenCalledWith(
            10,
            2026,
            3,
            expect.any(Array),
        );
        expect(window.electronAPI.sync.setMeta).toHaveBeenCalledWith(
            buildAllAgendasMonthMetaResource(2026, 3),
            expect.any(String),
            '2026-03-11 14:00:00',
        );
    });
});
