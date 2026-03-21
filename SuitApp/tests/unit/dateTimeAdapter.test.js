import { createRequire } from 'node:module';
import { describe, expect, it } from 'vitest';
import {
    fromApiStartsAt as rendererFromApi,
    toApiStartsAt as rendererToApi,
    toLocalInputValues,
    fromFormValues,
    toApiEventPayload,
} from '../../src/utils/dateTimeAdapter.js';

const require = createRequire(import.meta.url);
const {
    fromApiStartsAt,
    toApiStartsAt,
    buildLocalDateFromStartsAt,
    calcNotifyAt,
    calcMinutesFromStartsAt,
} = require('../../electron/dateTimeAdapter.cjs');

// ─── electron/dateTimeAdapter.cjs ───────────────────────────────────────────

describe('electron/dateTimeAdapter — fromApiStartsAt', () => {
    it('elimina el sufijo Z y preserva la hora exacta (sin conversión UTC)', () => {
        expect(fromApiStartsAt('2026-04-15T09:30:00.000000Z')).toBe('2026-04-15T09:30:00');
    });

    it('acepta strings sin timezone (ya naive)', () => {
        expect(fromApiStartsAt('2026-04-15T09:30:00')).toBe('2026-04-15T09:30:00');
    });

    it('acepta strings sin segundos', () => {
        expect(fromApiStartsAt('2026-04-15T09:30')).toBe('2026-04-15T09:30:00');
    });

    it('maneja timezone con offset explícito sin convertir', () => {
        // Tratamos el string como naive: solo extraemos los componentes del string.
        expect(fromApiStartsAt('2026-04-15T09:30:00-03:00')).toBe('2026-04-15T09:30:00');
    });

    it('devuelve null para valores vacíos', () => {
        expect(fromApiStartsAt(null)).toBeNull();
        expect(fromApiStartsAt('')).toBeNull();
        expect(fromApiStartsAt(undefined)).toBeNull();
    });

    it('devuelve null para strings no parseables', () => {
        expect(fromApiStartsAt('no-es-una-fecha')).toBeNull();
    });
});

describe('electron/dateTimeAdapter — toApiStartsAt', () => {
    it('añade Z a un string naive', () => {
        expect(toApiStartsAt('2026-04-15T09:30:00')).toBe('2026-04-15T09:30:00Z');
    });

    it('no duplica Z si ya lo tiene', () => {
        expect(toApiStartsAt('2026-04-15T09:30:00Z')).toBe('2026-04-15T09:30:00Z');
    });

    it('no duplica Z en mayúscula', () => {
        expect(toApiStartsAt('2026-04-15T09:30:00.000000Z')).toBe('2026-04-15T09:30:00.000000Z');
    });

    it('devuelve null para valores vacíos', () => {
        expect(toApiStartsAt(null)).toBeNull();
        expect(toApiStartsAt('')).toBeNull();
    });
});

describe('electron/dateTimeAdapter — buildLocalDateFromStartsAt', () => {
    it('construye un Date local sin corrimientos de timezone', () => {
        const date = buildLocalDateFromStartsAt('2026-04-15T09:30:00');
        expect(date).not.toBeNull();
        expect(date.getFullYear()).toBe(2026);
        expect(date.getMonth()).toBe(3); // 0-indexed → abril
        expect(date.getDate()).toBe(15);
        expect(date.getHours()).toBe(9);
        expect(date.getMinutes()).toBe(30);
    });

    it('devuelve null para valores inválidos', () => {
        expect(buildLocalDateFromStartsAt(null)).toBeNull();
        expect(buildLocalDateFromStartsAt('not-a-date')).toBeNull();
    });
});

describe('electron/dateTimeAdapter — calcNotifyAt', () => {
    it('resta minutos correctamente dentro del mismo día', () => {
        expect(calcNotifyAt('2026-04-15T09:30:00', 30)).toBe('2026-04-15T09:00:00');
    });

    it('cruza la medianoche hacia el día anterior', () => {
        expect(calcNotifyAt('2026-04-15T00:10:00', 30)).toBe('2026-04-14T23:40:00');
    });

    it('resta 0 minutos devuelve el mismo instante', () => {
        expect(calcNotifyAt('2026-04-15T09:30:00', 0)).toBe('2026-04-15T09:30:00');
    });

    it('resta 1440 minutos (1 día completo)', () => {
        expect(calcNotifyAt('2026-04-15T12:00:00', 1440)).toBe('2026-04-14T12:00:00');
    });

    it('resta 60 minutos (1 hora)', () => {
        expect(calcNotifyAt('2026-04-15T10:00:00', 60)).toBe('2026-04-15T09:00:00');
    });

    it('devuelve null para starts_at inválido', () => {
        expect(calcNotifyAt(null, 30)).toBeNull();
        expect(calcNotifyAt('no-date', 30)).toBeNull();
    });

    it('devuelve null para minutos inválidos', () => {
        expect(calcNotifyAt('2026-04-15T09:30:00', -1)).toBeNull();
        expect(calcNotifyAt('2026-04-15T09:30:00', NaN)).toBeNull();
    });
});

describe('electron/dateTimeAdapter — calcMinutesFromStartsAt', () => {
    it('calcula los minutos correctamente', () => {
        expect(calcMinutesFromStartsAt('2026-04-15T09:30:00', '2026-04-15T09:00:00')).toBe(30);
    });

    it('devuelve 0 si notify_at = starts_at', () => {
        expect(calcMinutesFromStartsAt('2026-04-15T09:30:00', '2026-04-15T09:30:00')).toBe(0);
    });

    it('calcula correctamente cruzando medianoche', () => {
        expect(calcMinutesFromStartsAt('2026-04-15T00:10:00', '2026-04-14T23:40:00')).toBe(30);
    });

    it('devuelve null si notify_at > starts_at', () => {
        expect(calcMinutesFromStartsAt('2026-04-15T09:00:00', '2026-04-15T09:30:00')).toBeNull();
    });

    it('devuelve null para valores inválidos', () => {
        expect(calcMinutesFromStartsAt(null, '2026-04-15T09:00:00')).toBeNull();
        expect(calcMinutesFromStartsAt('2026-04-15T09:30:00', null)).toBeNull();
    });

    it('round-trip con calcNotifyAt', () => {
        const startsAt = '2026-04-15T14:00:00';
        const minutes = 75;
        const notifyAt = calcNotifyAt(startsAt, minutes);
        expect(calcMinutesFromStartsAt(startsAt, notifyAt)).toBe(minutes);
    });
});

// ─── src/utils/dateTimeAdapter.js ───────────────────────────────────────────

describe('renderer/dateTimeAdapter — fromApiStartsAt', () => {
    it('elimina el sufijo Z y preserva la hora exacta', () => {
        expect(rendererFromApi('2026-04-15T09:30:00.000000Z')).toBe('2026-04-15T09:30:00');
    });

    it('acepta strings naive sin cambios', () => {
        expect(rendererFromApi('2026-04-15T09:30:00')).toBe('2026-04-15T09:30:00');
    });

    it('devuelve null para valores vacíos', () => {
        expect(rendererFromApi(null)).toBeNull();
        expect(rendererFromApi('')).toBeNull();
    });
});

describe('renderer/dateTimeAdapter — toApiStartsAt', () => {
    it('añade Z a un string naive', () => {
        expect(rendererToApi('2026-04-15T09:30:00')).toBe('2026-04-15T09:30:00Z');
    });

    it('no duplica Z', () => {
        expect(rendererToApi('2026-04-15T09:30:00Z')).toBe('2026-04-15T09:30:00Z');
    });
});

describe('renderer/dateTimeAdapter — toLocalInputValues', () => {
    it('extrae dateInput y timeInput de un starts_at con hora', () => {
        const result = toLocalInputValues('2026-04-15T09:30:00', false);
        expect(result).toEqual({ dateInput: '2026-04-15', timeInput: '09:30' });
    });

    it('devuelve timeInput vacío cuando is_all_day es true', () => {
        const result = toLocalInputValues('2026-04-15T00:00:00', true);
        expect(result).toEqual({ dateInput: '2026-04-15', timeInput: '' });
    });

    it('devuelve strings vacíos para starts_at nulo', () => {
        const result = toLocalInputValues(null, false);
        expect(result).toEqual({ dateInput: '', timeInput: '' });
    });
});

describe('renderer/dateTimeAdapter — fromFormValues', () => {
    it('construye starts_at naive con hora desde inputs del formulario', () => {
        const result = fromFormValues('2026-04-15', '09:30');
        expect(result).toEqual({ starts_at: '2026-04-15T09:30:00', is_all_day: false });
    });

    it('construye starts_at all-day cuando el tiempo está vacío', () => {
        const result = fromFormValues('2026-04-15', '');
        expect(result).toEqual({ starts_at: '2026-04-15T00:00:00', is_all_day: true });
    });

    it('devuelve starts_at null si la fecha está vacía', () => {
        const result = fromFormValues('', '');
        expect(result.starts_at).toBeNull();
    });

    it('round-trip: fromFormValues → toLocalInputValues', () => {
        const { starts_at, is_all_day } = fromFormValues('2026-04-15', '14:30');
        const { dateInput, timeInput } = toLocalInputValues(starts_at, is_all_day);
        expect(dateInput).toBe('2026-04-15');
        expect(timeInput).toBe('14:30');
    });
});

describe('renderer/dateTimeAdapter — toApiEventPayload', () => {
    it('construye payload con starts_at en UTC (sufijo Z)', () => {
        const payload = toApiEventPayload({
            starts_at: '2026-04-15T09:30:00',
            is_all_day: false,
            title: 'Audiencia',
            agenda_id: 1,
        });
        expect(payload.starts_at).toBe('2026-04-15T09:30:00Z');
        expect(payload.is_all_day).toBe(false);
        expect(payload.title).toBe('Audiencia');
    });

    it('todo el día: is_all_day true', () => {
        const payload = toApiEventPayload({
            starts_at: '2026-04-15T00:00:00',
            is_all_day: true,
            title: 'Feriado',
            agenda_id: 2,
        });
        expect(payload.is_all_day).toBe(true);
        expect(payload.starts_at).toBe('2026-04-15T00:00:00Z');
    });
});
