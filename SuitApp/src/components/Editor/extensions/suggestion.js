import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import MentionList from './MentionList';

const suggestion = {
    items: ({ query }) => {
        const variables = [
            // Cliente
            { id: 'nombre_cliente', label: 'Nombre del Cliente' },
            { id: 'apellido_cliente', label: 'Apellido del Cliente' },
            { id: 'dni_cliente', label: 'DNI del Cliente' },
            { id: 'domicilio_cliente', label: 'Domicilio del Cliente' },
            { id: 'telefono_cliente', label: 'Teléfono del Cliente' },
            { id: 'email_cliente', label: 'Email del Cliente' },
            // Caso
            { id: 'nombre_caso', label: 'Nombre del Caso (Carátula)' },
            { id: 'numero_caso', label: 'Número de Expediente' },
            { id: 'juzgado', label: 'Juzgado' },
            { id: 'fecha_inicio_caso', label: 'Fecha de Inicio del Caso' },
            // Abogado / Documento
            { id: 'nombre_abogado', label: 'Nombre del Abogado' },
            { id: 'numero_documento', label: 'Número de Documento' },
            // Fechas
            { id: 'fecha_hoy', label: 'Fecha de Hoy' },
            { id: 'fecha_vencimiento', label: 'Fecha de Vencimiento' },
        ];

        return variables.filter(item =>
            item.label.toLowerCase().includes(query.toLowerCase()) ||
            item.id.toLowerCase().includes(query.toLowerCase())
        );
    },
    render: () => {
        let component;
        let popup;

        return {
            onStart: props => {
                component = new ReactRenderer(MentionList, {
                    props,
                    editor: props.editor,
                });

                if (!props.clientRect) {
                    return;
                }

                popup = tippy('body', {
                    getReferenceClientRect: props.clientRect,
                    appendTo: () => document.body,
                    content: component.element,
                    showOnCreate: true,
                    interactive: true,
                    trigger: 'manual',
                    placement: 'bottom-start',
                });
            },

            onUpdate(props) {
                component.updateProps(props);

                if (!props.clientRect) {
                    return;
                }

                popup[0].setProps({
                    getReferenceClientRect: props.clientRect,
                });
            },

            onKeyDown(props) {
                if (props.event.key === 'Escape') {
                    popup[0].hide();
                    return true;
                }

                return component.ref?.onKeyDown(props);
            },

            onExit() {
                if (popup && popup[0]) {
                    popup[0].destroy();
                }
                if (component) {
                    component.destroy();
                }
            },
        };
    },
};

export default suggestion;
