import { describe, expect, it } from 'vitest';
import {
    collectSearchMatches,
    normalizeActiveMatchIndex,
    normalizeSearchTerm,
} from '../../src/components/Editor/extensions/searchAndReplaceUtils.js';

function makeDoc(nodes) {
    return {
        descendants(callback) {
            nodes.forEach(({ text, pos }) => {
                callback({ isText: true, text }, pos);
            });
        },
    };
}

describe('searchAndReplaceUtils', () => {
    it('normaliza el termino de búsqueda recortando espacios y pasando a minúsculas', () => {
        expect(normalizeSearchTerm('  Contrato  ')).toBe('contrato');
    });

    it('encuentra coincidencias case-insensitive sin cruzar nodos', () => {
        const doc = makeDoc([
            { text: 'Contrato laboral', pos: 1 },
            { text: 'Otro CONTRATO civil', pos: 30 },
        ]);

        expect(collectSearchMatches(doc, 'contrato')).toEqual([
            { from: 1, to: 9, text: 'Contrato' },
            { from: 35, to: 43, text: 'CONTRATO' },
        ]);
    });

    it('ajusta el índice activo al rango disponible', () => {
        expect(normalizeActiveMatchIndex(0, 4)).toBe(-1);
        expect(normalizeActiveMatchIndex(3, -4)).toBe(0);
        expect(normalizeActiveMatchIndex(3, 7)).toBe(2);
    });
});
