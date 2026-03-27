/**
 * TemplatePlaceholder.js — Extensión TipTap para los campos de plantilla.
 *
 * Representa un placeholder `#n#` como un nodo inline atómico.
 * El nodo almacena:
 *   - fieldId:       INTEGER  → el número del placeholder (#n#)
 *   - requisitoId:   INTEGER|null → id del requisito asignado
 *   - requisitoTitle: string|null → label localizado del requisito asignado
 *
 * En el HTML serializado emite: <span data-field-id="n" data-requisito-id="X" ...>
 * Este formato se usa solo internamente (pre/post-procesado); nunca se guarda así.
 */
import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer } from '@tiptap/react';
import TemplatePlaceholderView from './TemplatePlaceholderView';

const TemplatePlaceholder = Node.create({
    name: 'templatePlaceholder',

    group: 'inline',
    inline: true,
    // atom: true hace que el nodo se trate como una unidad indivisible.
    // El primer Backspace lo selecciona, el segundo lo elimina.
    atom: true,
    selectable: true,
    draggable: false,

    addAttributes() {
        return {
            fieldId: {
                default: null,
                parseHTML: (element) => {
                    const val = element.getAttribute('data-field-id');
                    return val !== null ? parseInt(val, 10) : null;
                },
                renderHTML: (attrs) => ({
                    'data-field-id': attrs.fieldId,
                }),
            },
            requisitoId: {
                default: null,
                parseHTML: (element) => {
                    const val = element.getAttribute('data-requisito-id');
                    return val ? parseInt(val, 10) : null;
                },
                renderHTML: (attrs) => ({
                    'data-requisito-id': attrs.requisitoId ?? '',
                }),
            },
            requisitoTitle: {
                default: null,
                parseHTML: (element) =>
                    element.getAttribute('data-requisito-title') || null,
                renderHTML: (attrs) => ({
                    'data-requisito-title': attrs.requisitoTitle ?? '',
                }),
            },
            // Número de entidad: distingue instancias del mismo tipo (ej: cliente 1 vs cliente 2).
            // Mínimo 1. Se usa para agrupar campos en el modal y para el color visual del chip.
            NEntidad: {
                default: 1,
                parseHTML: (element) => {
                    const val = element.getAttribute('data-nentidad');
                    return val ? parseInt(val, 10) : 1;
                },
                renderHTML: (attrs) => ({
                    'data-nentidad': attrs.NEntidad ?? 1,
                }),
            },
            // Nota opcional para orientar al usuario al completar el campo.
            // Se guarda en plantilla_requisitos.note y se incluye en el payload de guardado.
            note: {
                default: null,
                parseHTML: (element) => element.getAttribute('data-note') || null,
                renderHTML: (attrs) => ({
                    'data-note': attrs.note ?? '',
                }),
            },
        };
    },

    parseHTML() {
        return [{ tag: 'span[data-field-id]' }];
    },

    renderHTML({ HTMLAttributes }) {
        return [
            'span',
            mergeAttributes(HTMLAttributes, { class: 'template-placeholder' }),
        ];
    },

    addNodeView() {
        return ReactNodeViewRenderer(TemplatePlaceholderView);
    },
});

export default TemplatePlaceholder;
