import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TiptapEditor from '../../src/components/Editor/TiptapEditor.jsx';

describe('TiptapEditor', () => {
    it('abre el panel de buscar y reemplazar desde el toolbar', async () => {
        const onChange = vi.fn();

        render(
            <TiptapEditor
                content="<p>Contrato base</p>"
                onChange={onChange}
            />,
        );

        fireEvent.click(await screen.findByLabelText('Buscar y reemplazar'));

        expect(screen.getByTestId('editor-find-replace-panel')).toBeInTheDocument();
        expect(screen.getByLabelText('Buscar en el documento')).toBeInTheDocument();
    });

    it('oculta el botón de imagen en modo solo lectura', async () => {
        render(
            <TiptapEditor
                content="<p>Solo lectura</p>"
                onChange={vi.fn()}
                readOnly
            />,
        );

        expect(screen.queryByLabelText('Insertar imagen')).not.toBeInTheDocument();
    });

    it('abre el modal de atajos desde el toolbar', async () => {
        render(
            <TiptapEditor
                content="<p>Solo lectura</p>"
                onChange={vi.fn()}
            />,
        );

        fireEvent.click(await screen.findByLabelText('Atajos de teclado'));

        expect(screen.getByTestId('editor-shortcuts-modal')).toBeInTheDocument();
        expect(screen.getByText('Buscar en el documento')).toBeInTheDocument();
        expect(screen.getByText('Aumentar sangria del bloque actual')).toBeInTheDocument();
    });

    it('deshabilita controles mutantes en readOnly pero mantiene búsqueda y atajos', async () => {
        render(
            <TiptapEditor
                content="<p>Solo lectura</p>"
                onChange={vi.fn()}
                readOnly
            />,
        );

        expect(screen.getByTestId('editor-toolbar-row-primary')).toBeInTheDocument();
        expect(screen.getByTestId('editor-toolbar-row-secondary')).toBeInTheDocument();

        expect(screen.getByLabelText('Negrita')).toBeDisabled();
        expect(screen.getByLabelText('Aumentar sangría')).toBeDisabled();
        expect(screen.getByLabelText('Buscar y reemplazar')).toBeEnabled();
        expect(screen.getByLabelText('Atajos de teclado')).toBeEnabled();
    });

    it('inserta un salto de página desde el toolbar en modo edición', async () => {
        render(
            <TiptapEditor
                content="<p>Documento base</p>"
                onChange={vi.fn()}
            />,
        );

        fireEvent.click(await screen.findByLabelText('Salto de página'));

        expect(await screen.findByTestId('editor-page-break-node')).toBeInTheDocument();
        expect(screen.getByText('Salto de pagina')).toBeInTheDocument();
    });
});
