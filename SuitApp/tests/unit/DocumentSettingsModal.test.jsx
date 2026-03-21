import React from 'react';
import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

/**
 * CONTEXTO:
 * - El modal de guardado de documentos contiene un autosuggest para asociar un caso.
 * - La regresión reportada era clipping del dropdown por contenedores con overflow oculto.
 *
 * RIESGO CUBIERTO:
 * - Que el panel del modal vuelva a encapsular el autosuggest dentro de un contenedor
 *   con overflow oculto y corte visualmente el listado de resultados.
 */

vi.mock('../../src/context/CasesContext', () => ({
    useCases: () => ({
        cases: [
            { id: 1, title: 'Caso Uno' },
            { id: 2, title: 'Caso Dos' },
        ],
    }),
}));

vi.mock('../../src/services/documentService', () => ({
    getDocumentLockStatus: vi.fn(),
}));

import DocumentSettingsModal from '../../src/components/DocumentSettingsModal.jsx';

describe('DocumentSettingsModal', () => {
    it('mantiene overflow visible en el panel y el cuerpo cuando se habilita el autosuggest de casos', () => {
        const { container } = render(
            <DocumentSettingsModal
                isOpen
                onClose={vi.fn()}
                documentData={{ name: 'Borrador', suit_case_id: null }}
                onUpdate={vi.fn()}
                onTitleChange={vi.fn()}
                onConfirmCreate={vi.fn()}
                allowCaseAssociationEdit
            />
        );

        expect(screen.getByLabelText('Caso asociado')).toBeInTheDocument();

        const modalPanel = container.querySelector('.max-w-lg.overflow-visible');
        const modalBody = container.querySelector('.flex-1.overflow-visible');

        expect(modalPanel).toBeTruthy();
        expect(modalBody).toBeTruthy();
        expect(modalPanel).toHaveClass('relative');
        expect(modalBody).toHaveClass('relative');
    });
});
