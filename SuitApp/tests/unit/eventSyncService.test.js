import { beforeEach, describe, expect, it, vi } from 'vitest';

const getLatestEventTimestamp = vi.fn().mockResolvedValue(null);
const getAllEvents = vi.fn().mockResolvedValue([]);
const syncDown = vi.fn().mockResolvedValue([]);
const deleteEventMock = vi.fn();

vi.mock('../../src/services/api.js', () => ({
    apiGet: vi.fn(),
    getApiBase: () => 'http://localhost:8000',
}));

vi.mock('../../src/services/eventService.js', () => ({
    deleteEvent: (...args) => deleteEventMock(...args),
    getAllEvents: (...args) => getAllEvents(...args),
    getLatestEventTimestamp: (...args) => getLatestEventTimestamp(...args),
    syncDown: (...args) => syncDown(...args),
}));

import { syncEvents } from '../../src/services/sync/eventSyncService.js';

describe('eventSyncService', () => {
    beforeEach(() => {
        getLatestEventTimestamp.mockReset();
        getAllEvents.mockReset();
        syncDown.mockReset();
        deleteEventMock.mockReset();

        getLatestEventTimestamp.mockResolvedValue('2026-03-06 17:00:00');
        getAllEvents.mockResolvedValue([]);
        syncDown.mockResolvedValue([]);

        window.electronAPI = {
            db: {
                getAll: vi.fn().mockResolvedValue([]),
                clearTable: vi.fn().mockResolvedValue(undefined),
                upsertMany: vi.fn().mockResolvedValue(undefined),
                deleteById: vi.fn().mockResolvedValue(undefined),
            },
            sync: {
                getMeta: vi.fn().mockResolvedValue(null),
                setMeta: vi.fn().mockResolvedValue(undefined),
            },
        };
    });

    it('cachea eventos usando suit_case_id sin duplicar case_id', async () => {
        getAllEvents.mockResolvedValueOnce([
            {
                id: 501,
                agenda_id: 10,
                case_id: 77,
                title: 'Evento legacy',
                description: 'Compat',
                date: '2026-03-10',
                time: '10:00',
            },
        ]);

        const changed = await syncEvents();

        expect(changed).toBe(true);
        expect(window.electronAPI.db.clearTable).toHaveBeenCalledWith('events');
        expect(window.electronAPI.db.upsertMany).toHaveBeenCalledWith('events', [
            expect.not.objectContaining({ case_id: expect.anything() }),
        ]);

        const [rows] = window.electronAPI.db.upsertMany.mock.calls[0].slice(1);
        expect(rows[0]).toEqual(expect.objectContaining({
            id: 501,
            agenda_id: 10,
            suit_case_id: 77,
            event_type_id: 1,
        }));
        expect(JSON.parse(rows[0].data_json)).toEqual(expect.objectContaining({
            id: 501,
            suit_case_id: 77,
        }));
        expect(window.electronAPI.sync.setMeta).toHaveBeenCalledWith(
            'events',
            expect.any(String),
            '2026-03-06 17:00:00',
        );
    });
});
