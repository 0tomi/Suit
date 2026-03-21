import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    mergeScheduledNotificationRows,
} = require('../../electron/notificationSyncUtils.cjs');

describe('notificationSyncUtils.cjs', () => {
    it('preserva notificaciones locales de hoy consumidas por until-today cuando /notifications viene vacio', () => {
        const localToday = {
            event_id: 137,
            user_id: 1,
            notify_at: '2026-03-10T01:54:00.000Z',
            status: 'scheduled',
        };

        const merged = mergeScheduledNotificationRows([], [], [localToday]);

        expect(merged).toEqual([localToday]);
    });

    it('prioriza filas remotas antes que fallback local para la misma notificacion', () => {
        const remote = {
            event_id: 137,
            user_id: 1,
            notify_at: '2026-03-10T01:54:00.000Z',
            status: 'scheduled',
            title: 'remota',
        };
        const local = {
            event_id: 137,
            user_id: 1,
            notify_at: '2026-03-10T01:54:00.000Z',
            status: 'scheduled',
            title: 'local',
        };

        const merged = mergeScheduledNotificationRows([remote], [], [local]);

        expect(merged).toEqual([remote]);
    });
});
