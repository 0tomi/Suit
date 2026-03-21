import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';

export default Node.create({
    name: 'variable',

    group: 'inline',

    inline: true,

    atom: true,

    addAttributes() {
        return {
            label: {
                default: 'variable',
            },
            id: {
                default: null,
            }
        }
    },

    parseHTML() {
        return [
            {
                tag: 'span[data-variable]',
            },
        ]
    },

    renderHTML({ HTMLAttributes }) {
        return ['span', mergeAttributes(HTMLAttributes, { 'data-variable': '', class: 'variable-node' }), `{{${HTMLAttributes.label}}}`]
    },

    addKeyboardShortcuts() {
        return {
            Backspace: () => this.editor.commands.deleteSelection(),
        }
    }
});
