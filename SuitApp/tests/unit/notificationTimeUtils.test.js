import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    parseNotificationDate,
    getNotificationBucket,
} = require('../../electron/notificationTimeUtils.cjs');

describe('notificationTimeUtils.cjs', () => {
    it('interpreta timestamps locales sin zona como hora local', () => {
        const parsed = parseNotificationDate('2026-03-08 21:49:00');

        expect(parsed).not.toBeNull();
        expect(parsed?.getFullYear()).toBe(2026);
        expect(parsed?.getMonth()).toBe(2);
        expect(parsed?.getDate()).toBe(8);
        expect(parsed?.getHours()).toBe(21);
        expect(parsed?.getMinutes()).toBe(49);
    });

    it('clasifica una notificacion futura del dia como today y no como past', () => {
        const nowMs = new Date('2026-03-08T21:21:00-03:00').getTime();
        const endOfTodayMs = new Date('2026-03-08T23:59:59.999-03:00').getTime();

        expect(getNotificationBucket('2026-03-08 21:49:00', { nowMs, endOfTodayMs })).toBe('today');
        expect(getNotificationBucket('2026-03-08T21:49:00.000Z', { nowMs, endOfTodayMs })).toBe('today');
    });

    it('detecta correctamente timestamps ya vencidos', () => {
        const nowMs = new Date('2026-03-08T21:21:00-03:00').getTime();
        const endOfTodayMs = new Date('2026-03-08T23:59:59.999-03:00').getTime();

        expect(getNotificationBucket('2026-03-08 20:49:00', { nowMs, endOfTodayMs })).toBe('past');
    });
});
