import { describe, expect, it, vi } from 'vitest';
import {
    buildTextSelectionReplacements,
    transformSelectedText,
} from '../../src/components/Editor/selectionTextTransform.js';

describe('selectionTextTransform', () => {
    it('construye reemplazos parciales preservando el texto fuera de la selección', () => {
        const doc = {
            nodesBetween(from, to, callback) {
                callback({
                    isText: true,
                    text: 'hola mundo',
                    nodeSize: 10,
                    marks: [{ type: { name: 'bold' }, attrs: {} }],
                }, 5);
            },
        };

        const replacements = buildTextSelectionReplacements(doc, 7, 11, (text) => text.toUpperCase());

        expect(replacements).toEqual([
            {
                pos: 5,
                size: 10,
                marks: [{ type: { name: 'bold' }, attrs: {} }],
                parts: ['ho', 'LA M', 'undo'],
            },
        ]);
    });

    it('aplica la transformación en orden inverso sobre la selección actual', () => {
        const replaceWith = vi.fn(function replaceWith() {
            return this;
        });
        const scrollIntoView = vi.fn(function scrollIntoView() {
            return this;
        });
        const dispatch = vi.fn();

        const editor = {
            state: {
                selection: { from: 2, to: 12, empty: false },
                doc: {
                    nodesBetween(from, to, callback) {
                        callback({ isText: true, text: 'hola', nodeSize: 4, marks: ['bold'] }, 2);
                        callback({ isText: true, text: 'mundo', nodeSize: 5, marks: ['italic'] }, 7);
                    },
                },
                schema: {
                    text: (text, marks) => ({ text, marks }),
                },
                tr: {
                    replaceWith,
                    scrollIntoView,
                },
            },
            view: { dispatch },
        };

        const changed = transformSelectedText(editor, (text) => text.toUpperCase());

        expect(changed).toBe(true);
        expect(replaceWith).toHaveBeenNthCalledWith(
            1,
            7,
            12,
            [{ text: 'MUNDO', marks: ['italic'] }],
        );
        expect(replaceWith).toHaveBeenNthCalledWith(
            2,
            2,
            6,
            [{ text: 'HOLA', marks: ['bold'] }],
        );
        expect(scrollIntoView).toHaveBeenCalled();
        expect(dispatch).toHaveBeenCalledTimes(1);
    });
});
