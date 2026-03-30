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
const openModalMock = vi.fn();
const getDocumentLockStatusMock = vi.fn();
const updateDocumentNameMock = vi.fn();
const updateDocumentStatusMock = vi.fn();
const getDocumentClientsMock = vi.fn();
const linkClientsToDocumentMock = vi.fn();
const unlinkClientFromDocumentMock = vi.fn();

vi.mock('../../src/context/CasesContext', () => ({
    useCases: () => ({
        cases: [
            { id: 1, title: 'Caso Uno' },
            { id: 2, title: 'Caso Dos' },
        ],
        refreshCases: refreshCasesMock,
    }),
}));

vi.mock('../../src/context/ClientsContext.jsx', () => ({
    useClients: () => ({
        clients: [
            { id: 10, first_name: 'Ana', last_name: 'Paz', identification_number: '30111222' },
            { id: 11, first_name: 'Luis', last_name: 'Suarez', identification_number: '32999888' },
            { id: 12, first_name: 'Marta', last_name: 'Diaz', identification_number: '35123456' },
        ],
    }),
}));

vi.mock('../../src/context/ModalContext.jsx', () => ({
    useModal: () => ({
        openModal: (...args) => openModalMock(...args),
    }),
}));

vi.mock('../../src/components/ui/Modal.jsx', () => ({
    Modal: ({ open, maxWidth = 'max-w-lg', bodyClassName = '', children, footer }) => {
        if (!open) return null;
        return (
            <div className={`${maxWidth} overflow-visible relative`}>
                <div className={`flex-1 overflow-visible relative ${bodyClassName}`}>{children}</div>
                {footer ? <div>{footer}</div> : null}
            </div>
        );
    },
}));

vi.mock('../../src/components/cases/AddCasePersonModal.jsx', () => ({
    default: (props) => (
        props.open ? (
            <div data-testid="add-case-person-modal">
                <button
                    type="button"
                    onClick={() => props.onConfirmSelection?.([{ id: 12, first_name: 'Marta', last_name: 'Diaz' }])}
                >
                    confirmar-vinculacion
                </button>
            </div>
        ) : null
    ),
}));

vi.mock('../../src/services/documentService', () => ({
    getDocumentLockStatus: (...args) => getDocumentLockStatusMock(...args),
    updateDocumentName: (...args) => updateDocumentNameMock(...args),
    updateDocumentStatus: (...args) => updateDocumentStatusMock(...args),
    getDocumentClients: (...args) => getDocumentClientsMock(...args),
    linkClientsToDocument: (...args) => linkClientsToDocumentMock(...args),
    unlinkClientFromDocument: (...args) => unlinkClientFromDocumentMock(...args),
}));

import DocumentSettingsModal from '../../src/components/DocumentSettingsModal.jsx';

describe('DocumentSettingsModal', () => {
    beforeEach(() => {
        refreshCasesMock.mockClear();
        getDocumentLockStatusMock.mockReset();
        updateDocumentNameMock.mockReset();
        updateDocumentStatusMock.mockReset();
        getDocumentClientsMock.mockReset();
        linkClientsToDocumentMock.mockReset();
        unlinkClientFromDocumentMock.mockReset();
        openModalMock.mockReset();
        getDocumentClientsMock.mockResolvedValue({ ok: true, data: [] });
        linkClientsToDocumentMock.mockResolvedValue({ ok: true, data: {} });
        unlinkClientFromDocumentMock.mockResolvedValue({ ok: true, data: {} });
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

    it('carga los clientes vinculados al abrir para documentos existentes', async () => {
        getDocumentClientsMock.mockResolvedValueOnce({
            ok: true,
            data: [{ id: 10, first_name: 'Ana', last_name: 'Paz' }],
        });

        render(
            <DocumentSettingsModal
                isOpen
                onClose={vi.fn()}
                documentData={{ id: 9, name: 'Contrato', status: 'Borrador', suit_case_id: 1 }}
                onUpdate={vi.fn()}
                allowCaseAssociationEdit={false}
            />
        );

        await waitFor(() => {
            expect(getDocumentClientsMock).toHaveBeenCalledWith(9);
        });
        expect(screen.getByText('Ana Paz')).toBeInTheDocument();
    });

    it('desvincula un cliente y refresca la lista desde el endpoint', async () => {
        getDocumentClientsMock
            .mockResolvedValueOnce({
                ok: true,
                data: [{ id: 10, first_name: 'Ana', last_name: 'Paz' }],
            })
            .mockResolvedValueOnce({
                ok: true,
                data: [],
            });

        render(
            <DocumentSettingsModal
                isOpen
                onClose={vi.fn()}
                documentData={{ id: 9, name: 'Contrato', status: 'Borrador', suit_case_id: 1 }}
                onUpdate={vi.fn()}
                allowCaseAssociationEdit={false}
            />
        );

        await waitFor(() => {
            expect(screen.getByText('Ana Paz')).toBeInTheDocument();
        });

        fireEvent.click(screen.getByTitle('Desvincular cliente'));

        await waitFor(() => {
            expect(unlinkClientFromDocumentMock).toHaveBeenCalledWith(9, 10);
            expect(getDocumentClientsMock).toHaveBeenCalledTimes(2);
        });
    });

    it('vincula clientes en lote y refresca la lista', async () => {
        getDocumentClientsMock
            .mockResolvedValueOnce({
                ok: true,
                data: [],
            })
            .mockResolvedValueOnce({
                ok: true,
                data: [{ id: 12, first_name: 'Marta', last_name: 'Diaz' }],
            });

        render(
            <DocumentSettingsModal
                isOpen
                onClose={vi.fn()}
                documentData={{ id: 9, name: 'Contrato', status: 'Borrador', suit_case_id: 1 }}
                onUpdate={vi.fn()}
                allowCaseAssociationEdit={false}
            />
        );

        await waitFor(() => {
            expect(getDocumentClientsMock).toHaveBeenCalledWith(9);
        });

        fireEvent.click(screen.getByText('Vincular'));
        fireEvent.click(screen.getByText('confirmar-vinculacion'));

        await waitFor(() => {
            expect(linkClientsToDocumentMock).toHaveBeenCalledWith(9, [12]);
            expect(getDocumentClientsMock).toHaveBeenCalledTimes(2);
        });
    });
});
