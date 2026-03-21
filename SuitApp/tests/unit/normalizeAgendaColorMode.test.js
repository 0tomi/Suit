import { describe, expect, it } from 'vitest';
import { normalizeAgendaColorMode } from '../../src/utils/agendaColor/normalizeAgendaColorMode.js';

describe('normalizeAgendaColorMode', () => {
    it('normaliza aliases legacy a camelCase', () => {
        expect(normalizeAgendaColorMode('event_type')).toBe('eventType');
        expect(normalizeAgendaColorMode('case_type')).toBe('caseType');
    });

    it('mantiene valores canónicos', () => {
        expect(normalizeAgendaColorMode('eventType')).toBe('eventType');
        expect(normalizeAgendaColorMode('caseType')).toBe('caseType');
    });

    it('cae por defecto en eventType para valores inválidos', () => {
        expect(normalizeAgendaColorMode('foo')).toBe('eventType');
        expect(normalizeAgendaColorMode(null)).toBe('eventType');
    });
});
