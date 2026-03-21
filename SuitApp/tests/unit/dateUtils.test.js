import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const {
    buildLocalDateTime,
    normalizeDatePart,
    normalizeTimePart,
} = require('../../electron/dateUtils.cjs');

describe('dateUtils.cjs', () => {
    it('preserva fechas ISO sin zona horaria para evitar corrimientos por UTC', () => {
        expect(normalizeDatePart('2026-03-09')).toBe('2026-03-09');
    });

    it('extrae fecha y hora correctas desde un datetime ISO con zona', () => {
        expect(normalizeDatePart('2026-03-09T22:39:00.000Z')).toBe('2026-03-09');
        expect(normalizeTimePart('2026-03-09T22:39:00.000Z')).toBe('22:39');
    });

    it('construye la fecha local del evento sin corrimientos al calcular notificaciones', () => {
        const built = buildLocalDateTime('2026-03-09', '22:45');

        expect(built).not.toBeNull();
        expect(built?.getFullYear()).toBe(2026);
        expect(built?.getMonth()).toBe(2);
        expect(built?.getDate()).toBe(9);
        expect(built?.getHours()).toBe(22);
        expect(built?.getMinutes()).toBe(45);
    });
});
