/**
 * Construye los reemplazos necesarios para transformar solo el texto seleccionado
 * sin perder los marks ya presentes en cada nodo de texto.
 */
export function buildTextSelectionReplacements(doc, from, to, transformText) {
    const replacements = [];

    doc.nodesBetween(from, to, (node, pos) => {
        if (!node?.isText || typeof node.text !== 'string') return;

        const startOffset = Math.max(from - pos, 0);
        const endOffset = Math.min(to - pos, node.text.length);

        if (startOffset >= endOffset) return;

        const before = node.text.slice(0, startOffset);
        const selected = node.text.slice(startOffset, endOffset);
        const after = node.text.slice(endOffset);
        const transformed = transformText(selected);

        if (transformed === selected) return;

        replacements.push({
            pos,
            size: node.nodeSize,
            marks: node.marks || [],
            parts: [before, transformed, after].filter(Boolean),
        });
    });

    return replacements;
}

/**
 * Aplica una transformación de texto sobre la selección actual del editor
 * preservando la estructura de bloques y los marks de cada nodo afectado.
 */
export function transformSelectedText(editor, transformText) {
    if (!editor || typeof transformText !== 'function') return false;

    const { state, view } = editor;
    const { from, to, empty } = state.selection;

    if (empty || from >= to) return false;

    const replacements = buildTextSelectionReplacements(state.doc, from, to, transformText);
    if (replacements.length === 0) return false;

    let tr = state.tr;

    for (const replacement of [...replacements].reverse()) {
        const nextNodes = replacement.parts.map((text) => state.schema.text(text, replacement.marks));
        tr = tr.replaceWith(replacement.pos, replacement.pos + replacement.size, nextNodes);
    }

    view.dispatch(tr.scrollIntoView());
    return true;
}
