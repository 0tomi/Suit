import { afterEach, describe, expect, it } from 'vitest';
import { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import Indent, { INDENT_MAX_LEVEL } from '../../src/components/Editor/extensions/Indent.js';

const editors = [];

function createEditor(content) {
    const editor = new Editor({
        extensions: [StarterKit, Indent],
        content,
    });

    editors.push(editor);
    return editor;
}

afterEach(() => {
    editors.splice(0).forEach((editor) => editor.destroy());
});

describe('Indent extension', () => {
    it('indenta y desindenta el bloque actual respetando los límites configurados', () => {
        const editor = createEditor('<p>Contrato base</p>');

        editor.commands.setTextSelection(2);

        for (let index = 0; index < INDENT_MAX_LEVEL + 3; index += 1) {
            editor.commands.indent();
        }

        expect(editor.getHTML()).toContain(`data-indent="${INDENT_MAX_LEVEL}"`);
        expect(editor.getHTML()).toContain(`margin-left: ${INDENT_MAX_LEVEL * 2}rem`);

        for (let index = 0; index < INDENT_MAX_LEVEL + 3; index += 1) {
            editor.commands.outdent();
        }

        expect(editor.getHTML()).toBe('<p>Contrato base</p>');
    });

    it('aplica la sangría a todos los párrafos seleccionados', () => {
        const editor = createEditor('<p>Primero</p><p>Segundo</p>');

        editor.commands.selectAll();
        editor.commands.indent();

        expect(editor.getHTML()).toContain('<p data-indent="1" style="margin-left: 2rem;">Primero</p>');
        expect(editor.getHTML()).toContain('<p data-indent="1" style="margin-left: 2rem;">Segundo</p>');
    });
});
