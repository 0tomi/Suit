import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * CONTEXTO:
 * - El modal de guardado de documentos contiene un autosuggest para asociar un caso.
 * - La regresión reportada era clipping del dropdown por contenedores con overflow oculto.
 *
 * RIESGO CUBIERTO:
 * - Que el panel del modal vuelva a encapsular el autosuggest dentro de un contenedor
 *   con overflow oculto y corte visualmente el listado de resultados.
 */

const refreshCasesMock = vi.fn().mockResolvedValue(undefined);
const getDocumentLockStatusMock = vi.fn();
const updateDocumentNameMock = vi.fn();
const updateDocumentStatusMock = vi.fn();
const showAppToastMock = vi.fn();

vi.mock('../../src/context/CasesContext', () => ({
    useCases: () => ({
        cases: [
            { id: 1, title: 'Caso Uno' },
            { id: 2, title: 'Caso Dos' },
        ],
        refreshCases: refreshCasesMock,
    }),
}));

vi.mock('../../src/services/documentService', () => ({
    getDocumentLockStatus: (...args) => getDocumentLockStatusMock(...args),
    updateDocumentName: (...args) => updateDocumentNameMock(...args),
    updateDocumentStatus: (...args) => updateDocumentStatusMock(...args),
}));

vi.mock('../../src/components/ui/show-app-toast.jsx', () => ({
    showAppToast: (...args) => showAppToastMock(...args),
}));

import DocumentSettingsModal from '../../src/components/DocumentSettingsModal.jsx';

describe('DocumentSettingsModal', () => {
    beforeEach(() => {
        refreshCasesMock.mockClear();
        getDocumentLockStatusMock.mockReset();
        updateDocumentNameMock.mockReset();
        updateDocumentStatusMock.mockReset();
        showAppToastMock.mockReset();
    });

    it('renombra documentos existentes vía PATCH /name', async () => {
        updateDocumentNameMock.mockResolvedValue({ ok: true, data: { id: 9 } });

        render(
            <DocumentSettingsModal
                isOpen
                onClose={vi.fn()}
                documentData={{ id: 9, name: 'Contrato', status: 'Borrador', suit_case_id: 1 }}
                onUpdate={vi.fn()}
                allowCaseAssociationEdit={false}
            />
        );

        const titleInput = screen.getByLabelText('Título del documento');
        fireEvent.change(titleInput, { target: { value: 'Contrato actualizado' } });
        fireEvent.blur(titleInput);

        await waitFor(() => {
            expect(updateDocumentNameMock).toHaveBeenCalledWith(9, 'Contrato actualizado');
        });
    });

    it('cambia el estado de documentos existentes vía PATCH /status', async () => {
        updateDocumentStatusMock.mockResolvedValue({ ok: true, data: { id: 9 } });

        render(
            <DocumentSettingsModal
                isOpen
                onClose={vi.fn()}
                documentData={{ id: 9, name: 'Contrato', status: 'Borrador', suit_case_id: 1 }}
                onUpdate={vi.fn()}
                allowCaseAssociationEdit={false}
            />
        );

        fireEvent.change(screen.getByTestId('modal-status-select'), {
            target: { value: 'Firmado' },
        });

        await waitFor(() => {
            expect(updateDocumentStatusMock).toHaveBeenCalledWith(9, 'Firmado');
        });
    });

    it('mantiene el caso asociado en solo lectura para documentos existentes', () => {
        render(
            <DocumentSettingsModal
                isOpen
                onClose={vi.fn()}
                documentData={{ id: 9, name: 'Contrato', status: 'Borrador', suit_case_id: 1 }}
                onUpdate={vi.fn()}
                allowCaseAssociationEdit={false}
            />
        );

        expect(screen.queryByPlaceholderText('Buscar caso para asociar...')).not.toBeInTheDocument();
        expect(screen.getByText('Caso Uno')).toBeInTheDocument();
    });

    it('refresca los casos al abrir el selector para mostrar altas recientes', async () => {
        render(
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

        await waitFor(() => {
            expect(refreshCasesMock).toHaveBeenCalledTimes(1);
        });
    });

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
