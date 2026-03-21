import { describe, it, expect } from 'vitest';

// suggestion.js imports ReactRenderer and tippy which are not available in jsdom.
// We only need to test the `items` function, so we mock those dependencies
// before importing the module.

import { vi } from 'vitest';

vi.mock('@tiptap/react', () => ({
    ReactRenderer: vi.fn(),
}));

vi.mock('tippy.js', () => ({
    default: vi.fn(() => [{ hide: vi.fn(), destroy: vi.fn(), setProps: vi.fn() }]),
}));

vi.mock('../../src/components/Editor/extensions/MentionList', () => ({
    default: () => null,
}));

// Dynamic import after mocks are in place
const { default: suggestion } = await import('../../src/components/Editor/extensions/suggestion.js');

const EXPECTED_VARIABLE_IDS = [
    'nombre_cliente',
    'apellido_cliente',
    'dni_cliente',
    'domicilio_cliente',
    'telefono_cliente',
    'email_cliente',
    'nombre_caso',
    'numero_caso',
    'juzgado',
    'fecha_inicio_caso',
    'nombre_abogado',
    'numero_documento',
    'fecha_hoy',
    'fecha_vencimiento',
];

describe('suggestion.items — variable catalog', () => {
    it('returns all 14 variables when query is empty', () => {
        const results = suggestion.items({ query: '' });
        expect(results).toHaveLength(14);
    });

    it('contains every expected variable id', () => {
        const results = suggestion.items({ query: '' });
        const ids = results.map((item) => item.id);
        for (const expected of EXPECTED_VARIABLE_IDS) {
            expect(ids).toContain(expected);
        }
    });

    it('each item has both id and label fields', () => {
        const results = suggestion.items({ query: '' });
        for (const item of results) {
            expect(typeof item.id).toBe('string');
            expect(item.id.length).toBeGreaterThan(0);
            expect(typeof item.label).toBe('string');
            expect(item.label.length).toBeGreaterThan(0);
        }
    });
});

describe('suggestion.items — filtering', () => {
    it('filters by label substring (case-insensitive)', () => {
        const results = suggestion.items({ query: 'cliente' });
        // nombre_cliente, apellido_cliente, dni_cliente, domicilio_cliente, telefono_cliente, email_cliente
        expect(results.length).toBeGreaterThanOrEqual(6);
        for (const item of results) {
            const matches =
                item.label.toLowerCase().includes('cliente') ||
                item.id.toLowerCase().includes('cliente');
            expect(matches).toBe(true);
        }
    });

    it('filters by id substring (case-insensitive)', () => {
        const results = suggestion.items({ query: 'fecha' });
        const ids = results.map((item) => item.id);
        expect(ids).toContain('fecha_inicio_caso');
        expect(ids).toContain('fecha_hoy');
        expect(ids).toContain('fecha_vencimiento');
    });

    it('returns only the matching item for a very specific query', () => {
        const results = suggestion.items({ query: 'numero_documento' });
        expect(results).toHaveLength(1);
        expect(results[0].id).toBe('numero_documento');
    });

    it('returns an empty array when no variable matches', () => {
        const results = suggestion.items({ query: 'zzz_nonexistent_xyz' });
        expect(results).toHaveLength(0);
    });

    it('is case-insensitive for uppercase queries', () => {
        const lower = suggestion.items({ query: 'juzgado' });
        const upper = suggestion.items({ query: 'JUZGADO' });
        expect(upper).toHaveLength(lower.length);
    });

    it('matches partial label words', () => {
        const results = suggestion.items({ query: 'Nombre' });
        const ids = results.map((item) => item.id);
        expect(ids).toContain('nombre_cliente');
        expect(ids).toContain('nombre_caso');
        expect(ids).toContain('nombre_abogado');
    });

    it('matching by id prefix works', () => {
        const results = suggestion.items({ query: 'numero' });
        const ids = results.map((item) => item.id);
        expect(ids).toContain('numero_caso');
        expect(ids).toContain('numero_documento');
    });
});
