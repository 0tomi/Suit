import { beforeEach, describe, expect, it, vi } from 'vitest';

const getDeadlinesMock = vi.fn();
const getDeadlinesLastModifiedMock = vi.fn();
const getApiBase = vi.fn(() => 'http://localhost:8000/api');

vi.mock('../../src/services/deadlineService.js', () => ({
    getDeadlines: (...args) => getDeadlinesMock(...args),
    getDeadlinesLastModified: (...args) => getDeadlinesLastModifiedMock(...args),
}));

vi.mock('../../src/services/api.js', () => ({
    getApiBase: (...args) => getApiBase(...args),
}));

import {
    buildDeadlineMonthMetaResource,
    syncDeadlinesMonth,
} from '../../src/services/sync/deadlineSyncService.js';

describe('deadlineSyncService', () => {
    beforeEach(() => {
        getDeadlinesMock.mockReset();
        getDeadlinesLastModifiedMock.mockReset();
        getApiBase.mockReturnValue('http://localhost:8000/api');

        getDeadlinesLastModifiedMock.mockResolvedValue('2026-03-11 14:00:00');
        getDeadlinesMock.mockResolvedValue([
            {
                id: 101,
                event_id: 500,
                suit_case_id: 2,
                title: 'Presentar escrito',
                description: null,
                due_date: '2026-03-20',
                priority: 'Normal',
                status: 'Pendiente',
                notify_at: null,
            },
        ]);

        window.electronAPI = {
            db: {
                getAll: vi.fn().mockResolvedValue([
                    { id: 101, due_date: '2026-03-20' },
                    { id: 202, due_date: '2026-03-05' },
                    { id: 303, due_date: '2026-04-02' },
                ]),
                upsertMany: vi.fn().mockResolvedValue(undefined),
                deleteById: vi.fn().mockResolvedValue(undefined),
            },
            sync: {
                getMeta: vi.fn().mockResolvedValue(null),
                setMeta: vi.fn().mockResolvedValue(undefined),
            },
        };
    });

    it('elimina de SQLite los vencimientos removidos del mes sincronizado', async () => {
        const changed = await syncDeadlinesMonth(3, 2026);

        expect(changed).toBe(true);
        expect(getDeadlinesMock).toHaveBeenCalledWith(3, 2026);
        expect(window.electronAPI.db.upsertMany).toHaveBeenCalledWith('deadlines', [
            expect.objectContaining({
                id: 101,
                due_date: '2026-03-20',
                event_id: 500,
            }),
        ]);
        expect(window.electronAPI.db.deleteById).toHaveBeenCalledWith('deadlines', 202);
        expect(window.electronAPI.db.deleteById).not.toHaveBeenCalledWith('deadlines', 303);
        expect(window.electronAPI.sync.setMeta).toHaveBeenCalledWith(
            buildDeadlineMonthMetaResource(2026, 3),
            expect.any(String),
            '2026-03-11 14:00:00',
        );
    });

    it('reutiliza cache vigente aunque last_server local esté en formato ISO legacy', async () => {
        window.electronAPI.sync.getMeta.mockResolvedValueOnce({
            resource: buildDeadlineMonthMetaResource(2026, 3),
            last_server: '2026-03-11T14:00:00.000Z',
        });

        const changed = await syncDeadlinesMonth(3, 2026);

        expect(changed).toBe(false);
        expect(getDeadlinesLastModifiedMock).toHaveBeenCalledWith(3, 2026);
        expect(getDeadlinesMock).not.toHaveBeenCalled();
        expect(window.electronAPI.db.upsertMany).not.toHaveBeenCalled();
    });

    it('rehidrata la cache cuando sync_meta existe pero la tabla local quedó vacía', async () => {
        window.electronAPI.sync.getMeta.mockResolvedValueOnce({
            resource: buildDeadlineMonthMetaResource(2026, 3),
            last_server: '2026-03-11 14:00:00',
        });
        window.electronAPI.db.getAll = vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce([]);

        const changed = await syncDeadlinesMonth(3, 2026);

        expect(changed).toBe(true);
        expect(getDeadlinesMock).toHaveBeenCalledWith(3, 2026);
        expect(getDeadlinesLastModifiedMock).toHaveBeenCalledTimes(1);
        expect(window.electronAPI.sync.setMeta).toHaveBeenCalledWith(
            buildDeadlineMonthMetaResource(2026, 3),
            expect.any(String),
            '2026-03-11 14:00:00',
        );
    });
});
