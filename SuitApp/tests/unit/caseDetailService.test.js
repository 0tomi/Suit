import { beforeEach, describe, expect, it, vi } from 'vitest';
import { getCaseOverviewMetrics, loadCaseEventCount } from '../../src/services/caseDetailService.js';

describe('caseDetailService', () => {
    beforeEach(() => {
        window.electronAPI = {
            db: {
                getCaseKpis: vi.fn().mockResolvedValue({
                    deadlinesCount: 2,
                    eventsCount: 5,
                    documentsCount: 3,
                }),
            },
        };
    });

    it('lee los contadores del overview sólo desde SQLite', async () => {
        const metrics = await getCaseOverviewMetrics(42);

        expect(window.electronAPI.db.getCaseKpis).toHaveBeenCalledWith(42);
        expect(metrics).toEqual({
            deadlinesCount: 2,
            eventsCount: 5,
            documentsCount: 3,
        });
    });

    it('marca los contadores de eventos como provenientes de cache', async () => {
        const result = await loadCaseEventCount(42);

        expect(window.electronAPI.db.getCaseKpis).toHaveBeenCalledWith(42);
        expect(result).toEqual({
            deadlinesCount: 2,
            eventsCount: 5,
            documentsCount: 3,
            fromCache: true,
        });
    });
});
