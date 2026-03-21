import { Extension } from '@tiptap/core';

export const INDENT_STEP_REM = 2;
export const INDENT_MIN_LEVEL = 0;
export const INDENT_MAX_LEVEL = 5;

function clampIndentLevel(level) {
    return Math.max(INDENT_MIN_LEVEL, Math.min(INDENT_MAX_LEVEL, Number(level) || 0));
}

function isIndentableNode(node) {
    return node?.type?.name === 'paragraph' || node?.type?.name === 'heading';
}

function updateSelectedIndent(tr, selection, updater) {
    const targets = new Map();

    // La selección colapsada no recorre el párrafo actual; buscamos su ancestro
    // más cercano para que Tab/Shift+Tab funcionen con el cursor dentro del bloque.
    if (selection.empty) {
        const { $from } = selection;

        for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (isIndentableNode(node)) {
                targets.set($from.before(depth), node);
                break;
            }
        }
    } else {
        tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (isIndentableNode(node)) {
                targets.set(pos, node);
            }
        });
    }

    let changed = false;

    targets.forEach((node, pos) => {
        const currentIndent = clampIndentLevel(node.attrs.indent);
        const nextIndent = clampIndentLevel(updater(currentIndent));

        if (nextIndent === currentIndent) return;

        tr.setNodeMarkup(pos, node.type, {
            ...node.attrs,
            indent: nextIndent,
        }, node.marks);
        changed = true;
    });

    return changed;
}

const Indent = Extension.create({
    name: 'indent',

    addGlobalAttributes() {
        return [
            {
                types: ['paragraph', 'heading'],
                attributes: {
                    indent: {
                        default: INDENT_MIN_LEVEL,
                        parseHTML: (element) => {
                            const explicitIndent = element.getAttribute('data-indent');
                            if (explicitIndent != null) {
                                return clampIndentLevel(explicitIndent);
                            }

                            const marginLeft = element.style.marginLeft;
                            if (!marginLeft) return INDENT_MIN_LEVEL;

                            const parsedMargin = Number.parseFloat(marginLeft);
                            if (Number.isNaN(parsedMargin)) return INDENT_MIN_LEVEL;

                            return clampIndentLevel(parsedMargin / INDENT_STEP_REM);
                        },
                        renderHTML: (attributes) => {
                            const indent = clampIndentLevel(attributes.indent);
                            if (indent <= INDENT_MIN_LEVEL) return {};

                            return {
                                'data-indent': String(indent),
                                style: `margin-left: ${indent * INDENT_STEP_REM}rem`,
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            indent: () => ({ state, dispatch }) => {
                const tr = state.tr;
                const changed = updateSelectedIndent(tr, state.selection, (indent) => indent + 1);

                if (!changed) return false;
                dispatch?.(tr);
                return true;
            },
            outdent: () => ({ state, dispatch }) => {
                const tr = state.tr;
                const changed = updateSelectedIndent(tr, state.selection, (indent) => indent - 1);

                if (!changed) return false;
                dispatch?.(tr);
                return true;
            },
        };
    },

    addKeyboardShortcuts() {
        const hasNestedBehavior = () => (
            this.editor.isActive('bulletList')
            || this.editor.isActive('orderedList')
            || this.editor.isActive('taskList')
            || this.editor.isActive('table')
        );

        return {
            Tab: () => {
                if (hasNestedBehavior()) return false;
                return this.editor.commands.indent();
            },
            'Shift-Tab': () => {
                if (hasNestedBehavior()) return false;
                return this.editor.commands.outdent();
            },
        };
    },
});

export default Indent;
