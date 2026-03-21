import { describe, expect, it } from 'vitest';

import {
    buildTriggeredNotificationDescription,
    formatEventTime,
} from '../../src/utils/notifications/buildTriggeredNotificationDescription.js';

describe('buildTriggeredNotificationDescription', () => {
    it('arma la descripcion con detalle y hora legible del evento', () => {
        expect(buildTriggeredNotificationDescription({
            description: 'Revisar expediente antes de entrar.',
            time: '22:56:31.123000',
        })).toBe('Revisar expediente antes de entrar.\nHora del evento: 22:56 hs');
    });

    it('devuelve un fallback estable si no hay detalle ni hora', () => {
        expect(buildTriggeredNotificationDescription({})).toBe('Tienes un evento proximo en SuitAPP.');
    });

    it('extrae HH:mm desde distintos formatos horarios', () => {
        expect(formatEventTime('08:05')).toBe('08:05');
        expect(formatEventTime('2026-03-10T22:56:31.123000Z')).toMatch(/^\d{2}:\d{2}$/);
    });
});
