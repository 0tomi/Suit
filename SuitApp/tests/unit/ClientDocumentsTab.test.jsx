import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const getClientDocumentsMock = vi.fn();

vi.mock('../../src/services/clientService.js', () => ({
    getClientDocuments: (...args) => getClientDocumentsMock(...args),
}));

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => ({ user: { id: 1, role: 'lawyer' } }),
}));

vi.mock('../../src/hooks/useDocumentActionControls.js', () => ({
    useDocumentActionControls: () => ({
        modalState: { settingsOpen: false, detailsOpen: false, selectedDoc: null },
        exportingDocId: null,
        openSettingsModal: vi.fn(),
        openDetailsModal: vi.fn(),
        closeSettingsModal: vi.fn(),
        closeDetailsModal: vi.fn(),
        openDocumentEditor: vi.fn(),
        handleExportPdf: vi.fn(),
        applyDocumentUpdate: vi.fn(),
    }),
}));

vi.mock('../../src/components/DocumentSettingsModal.jsx', () => ({
    default: () => null,
}));

vi.mock('../../src/components/documents/DocumentDetailsModal.jsx', () => ({
    default: () => null,
}));

import ClientDocumentsTab from '../../src/components/clients/ClientDocumentsTab.jsx';

describe('ClientDocumentsTab', () => {
    beforeEach(() => {
        getClientDocumentsMock.mockReset();
    });

    it('bloquea la sección cuando está offline y no hace requests', () => {
        render(<ClientDocumentsTab clientData={{ id: 9 }} isOnline={false} />);

        expect(screen.getByText('Documentación no disponible')).toBeInTheDocument();
        expect(getClientDocumentsMock).not.toHaveBeenCalled();
    });

    it('arranca en vista por casos y consulta la primera página', async () => {
        getClientDocumentsMock.mockResolvedValue({
            personales: { data: [], meta: { current_page: 1, last_page: 1 } },
            por_casos: {
                data: [
                    {
                        id: 120,
                        nombre: 'Expediente Pérez',
                        estado: 'active',
                        fuero: 'Civil',
                        documentos: {
                            data: [{ id: 77, name: 'Escrito Inicial', status: 'Borrador', updated_at: '2026-03-20' }],
                            meta: { current_page: 1, last_page: 1 },
                        },
                    },
                ],
                meta: { current_page: 1, last_page: 1 },
            },
        });

        render(<ClientDocumentsTab clientData={{ id: 9 }} isOnline />);

        await waitFor(() => {
            expect(getClientDocumentsMock).toHaveBeenCalledWith(9, {
                page_personal: 1,
                page_cases: 1,
                page_case_docs: 1,
            });
        });

        expect(screen.getByText('Por casos (1)')).toBeInTheDocument();
    });

    it('permite cambiar a personales y cargar más documentos', async () => {
        getClientDocumentsMock
            .mockResolvedValueOnce({
                personales: { data: [], meta: { current_page: 1, last_page: 1 } },
                por_casos: { data: [], meta: { current_page: 1, last_page: 1 } },
            })
            .mockResolvedValueOnce({
                personales: {
                    data: [{ id: 1, name: 'Documento A', status: 'Borrador', updated_at: '2026-03-25' }],
                    meta: { current_page: 1, last_page: 2 },
                },
                por_casos: { data: [], meta: { current_page: 1, last_page: 1 } },
            })
            .mockResolvedValueOnce({
                personales: {
                    data: [{ id: 2, name: 'Documento B', status: 'Borrador', updated_at: '2026-03-26' }],
                    meta: { current_page: 2, last_page: 2 },
                },
                por_casos: { data: [], meta: { current_page: 1, last_page: 1 } },
            });

        render(<ClientDocumentsTab clientData={{ id: 9 }} isOnline />);

        await waitFor(() => {
            expect(getClientDocumentsMock).toHaveBeenCalledTimes(1);
        });

        fireEvent.click(screen.getByText('Personales (0)'));

        await waitFor(() => {
            expect(getClientDocumentsMock).toHaveBeenCalledWith(9, {
                page_personal: 1,
                page_cases: 1,
                page_case_docs: 1,
            });
        });

        fireEvent.click(screen.getByText('Cargar más documentos'));

        await waitFor(() => {
            expect(getClientDocumentsMock).toHaveBeenCalledWith(9, {
                page_personal: 2,
                page_cases: 1,
                page_case_docs: 1,
            });
        });
    });
});
