import { Extension } from '@tiptap/core';

export const SPACING_STEP_REM = 1; // 1rem cada nivel de espaciado
export const SPACING_MIN_LEVEL = 0;
export const SPACING_MAX_LEVEL = 10;

function clampSpacingLevel(level) {
    return Math.max(SPACING_MIN_LEVEL, Math.min(SPACING_MAX_LEVEL, Number(level) || 0));
}

function isSpacingNode(node) {
    return node?.type?.name === 'paragraph' || node?.type?.name === 'heading';
}

function updateSelectedSpacing(tr, selection, updater) {
    const targets = new Map();

    if (selection.empty) {
        const { $from } = selection;
        for (let depth = $from.depth; depth > 0; depth -= 1) {
            const node = $from.node(depth);
            if (isSpacingNode(node)) {
                targets.set($from.before(depth), node);
                break;
            }
        }
    } else {
        tr.doc.nodesBetween(selection.from, selection.to, (node, pos) => {
            if (isSpacingNode(node)) {
                targets.set(pos, node);
            }
        });
    }

    let changed = false;
    targets.forEach((node, pos) => {
        const currentSpacing = clampSpacingLevel(node.attrs.spacingTop);
        const nextSpacing = clampSpacingLevel(updater(currentSpacing));

        if (nextSpacing === currentSpacing) return;

        tr.setNodeMarkup(pos, node.type, {
            ...node.attrs,
            spacingTop: nextSpacing,
        }, node.marks);
        changed = true;
    });

    return changed;
}

const VerticalSpacing = Extension.create({
    name: 'verticalSpacing',

    addGlobalAttributes() {
        return [
            {
                types: ['paragraph', 'heading'],
                attributes: {
                    spacingTop: {
                        default: SPACING_MIN_LEVEL,
                        parseHTML: (element) => {
                            const val = element.getAttribute('data-spacing-top');
                            return clampSpacingLevel(val);
                        },
                        renderHTML: (attributes) => {
                            const spacing = clampSpacingLevel(attributes.spacingTop);
                            if (spacing <= SPACING_MIN_LEVEL) return {};

                            return {
                                'data-spacing-top': String(spacing),
                                style: `margin-top: ${spacing * SPACING_STEP_REM}rem`,
                            };
                        },
                    },
                },
            },
        ];
    },

    addCommands() {
        return {
            setVerticalSpacing: (level) => ({ state, dispatch }) => {
                const tr = state.tr;
                const changed = updateSelectedSpacing(tr, state.selection, () => clampSpacingLevel(level));

                if (!changed) return false;
                dispatch?.(tr);
                return true;
            },
        };
    },
});

export default VerticalSpacing;
