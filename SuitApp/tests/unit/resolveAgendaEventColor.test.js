import { describe, expect, it, vi } from 'vitest';
import { resolveAgendaEventColor } from '../../src/utils/agendaColor/resolveAgendaEventColor.js';

function buildMaps(eventTypes = [], caseTypes = [], cases = []) {
    return {
        eventTypesById: new Map(eventTypes.map((item) => [String(item.id), item])),
        caseTypesById: new Map(caseTypes.map((item) => [String(item.id), item])),
        casesById: new Map(cases.map((item) => [String(item.id), item])),
    };
}

describe('resolveAgendaEventColor', () => {
    it('eventType: resuelve color del tipo de evento', () => {
        const maps = buildMaps([{ id: 1, color: '#ef4444' }], [], [{ id: 77, case_type_id: 5 }]);

        const resolution = resolveAgendaEventColor({
            event: { id: 7, suit_case_id: 77, event_type_id: 1 },
            mode: 'eventType',
            personalColor: '#3b82f6',
            ...maps,
        });

        expect(resolution).toEqual({
            color: '#ef4444',
            source: 'eventType',
            reason: 'resolved_event_type',
            mode: 'eventType',
        });
    });

    it('caseType: resuelve color del tipo de caso', () => {
        const maps = buildMaps([], [{ id: 5, eventColor: '#bc1010' }], [{ id: 77, case_type_id: 5 }]);

        const resolution = resolveAgendaEventColor({
            event: { id: 7, suit_case_id: 77, event_type_id: 1 },
            mode: 'caseType',
            personalColor: '#3b82f6',
            ...maps,
        });

        expect(resolution).toEqual({
            color: '#bc1010',
            source: 'caseType',
            reason: 'resolved_case_type',
            mode: 'caseType',
        });
    });

    it('evento personal usa siempre personalColor', () => {
        const maps = buildMaps([{ id: 1, color: '#ef4444' }], [{ id: 5, eventColor: '#bc1010' }], [{ id: 77, case_type_id: 5 }]);

        const resolution = resolveAgendaEventColor({
            event: { id: 8, suit_case_id: null, event_type_id: 1 },
            mode: 'caseType',
            personalColor: '#123456',
            ...maps,
        });

        expect(resolution.color).toBe('#123456');
        expect(resolution.source).toBe('personalColor');
        expect(resolution.reason).toBe('personal_event');
    });

    it('fallback de evento de caso usa personalColor y emite onFallback', () => {
        const maps = buildMaps([], [{ id: 5, eventColor: null }], [{ id: 77, case_type_id: 5 }]);
        const onFallback = vi.fn();

        const resolution = resolveAgendaEventColor({
            event: { id: 9, suit_case_id: 77, event_type_id: 1 },
            mode: 'caseType',
            personalColor: '#3b82f6',
            onFallback,
            ...maps,
        });

        expect(resolution.color).toBe('#3b82f6');
        expect(resolution.source).toBe('fallback');
        expect(resolution.reason).toBe('case_type_without_color');
        expect(onFallback).toHaveBeenCalledWith(expect.objectContaining({
            eventId: 9,
            reason: 'case_type_without_color',
        }));
    });

    it('eventType: cuando el tipo es "Otro", usa personalColor', () => {
        const maps = buildMaps([{ id: 1, name: 'Otro', color: '#ef4444' }], [], [{ id: 77, case_type_id: 5 }]);

        const resolution = resolveAgendaEventColor({
            event: { id: 15, suit_case_id: 77, event_type_id: 1 },
            mode: 'eventType',
            personalColor: '#3b82f6',
            ...maps,
        });

        expect(resolution).toEqual({
            color: '#3b82f6',
            source: 'personalColor',
            reason: 'event_type_other_personal',
            mode: 'eventType',
        });
    });
});
