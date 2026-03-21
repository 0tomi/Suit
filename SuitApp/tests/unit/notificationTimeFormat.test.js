import { describe, expect, it } from 'vitest';
import {
    clampNotificationMinutes,
    formatNotificationLeadTime,
    fromMinutes,
    toMinutes,
} from '../../src/utils/notificationTimeFormat.js';

describe('notificationTimeFormat utils', () => {
    it('convierte cantidad + unidad a minutos', () => {
        expect(toMinutes(5, 'minutes')).toBe(5);
        expect(toMinutes(2, 'hours')).toBe(120);
        expect(toMinutes(2, 'days')).toBe(2880);
    });

    it('devuelve null para valores invalidos', () => {
        expect(toMinutes(0, 'minutes')).toBeNull();
        expect(toMinutes(-1, 'hours')).toBeNull();
        expect(toMinutes('abc', 'days')).toBeNull();
    });

    it('hidrata custom usando dias/horas/minutos', () => {
        expect(fromMinutes(2880)).toEqual({ amount: '2', unit: 'days' });
        expect(fromMinutes(120)).toEqual({ amount: '2', unit: 'hours' });
        expect(fromMinutes(95)).toEqual({ amount: '95', unit: 'minutes' });
    });

    it('formatea tiempo de notificacion de forma humana', () => {
        expect(formatNotificationLeadTime(15)).toBe('15 minutos');
        expect(formatNotificationLeadTime(60)).toBe('1 hora');
        expect(formatNotificationLeadTime(1440)).toBe('1 dia');
        expect(formatNotificationLeadTime(2880)).toBe('2 dias');
    });

    it('aplica limites min/max', () => {
        expect(clampNotificationMinutes(0, { min: 1, max: 10080 })).toBe(1);
        expect(clampNotificationMinutes(10081, { min: 1, max: 10080 })).toBe(10080);
        expect(clampNotificationMinutes(30, { min: 1, max: 10080 })).toBe(30);
    });
});

