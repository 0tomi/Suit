import { Node } from '@tiptap/core';

/**
 * Nodo atómico para marcar saltos de página en el HTML del documento.
 * Se serializa con un atributo estable para que el exportador PDF aplique
 * la regla de impresión sin depender de heurísticas.
 */
const PageBreak = Node.create({
    name: 'pageBreak',
    group: 'block',
    atom: true,
    selectable: true,
    draggable: false,
    isolating: true,

    parseHTML() {
        return [
            {
                tag: 'div[data-page-break="true"]',
            },
        ];
    },

    renderHTML() {
        return [
            'div',
            {
                'data-page-break': 'true',
                'data-testid': 'editor-page-break-node',
                style: 'break-before: page; page-break-before: always; margin: 2rem 0; border-top: 2px dashed #94a3b8; text-align: center;',
            },
            [
                'span',
                {
                    contenteditable: 'false',
                    style: 'display: inline-block; margin-top: -0.8rem; padding: 0 0.75rem; background: #ffffff; color: #64748b; font-size: 0.75rem; letter-spacing: 0.08em; text-transform: uppercase;',
                },
                'Salto de pagina',
            ],
        ];
    },

    addCommands() {
        return {
            setPageBreak: () => ({ commands }) => commands.insertContent({ type: this.name }),
        };
    },
});

export default PageBreak;
