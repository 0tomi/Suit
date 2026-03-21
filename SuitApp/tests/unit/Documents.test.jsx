import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Documents from '../../src/pages/Documents.jsx';
import { DOCUMENT_FILTER_STORAGE_KEY } from '../../src/pages/documentsFilters.js';
import { HotkeysProvider } from '../../src/hotkeys/HotkeysProvider.jsx';

const getClosedCasesMock = vi.fn();
let lastDocumentSettingsModalProps = null;

let documentsState = { documents: [], refreshDocuments: vi.fn() };
let casesState = { cases: [] };
let clientsState = { clients: [] };
let authState = { user: { id: 1, role: 'lawyer' } };

vi.mock('../../src/context/DocumentsContext.jsx', () => ({
    useDocuments: () => documentsState,
}));

vi.mock('../../src/context/CasesContext.jsx', () => ({
    useCases: () => casesState,
}));

vi.mock('../../src/context/ClientsContext.jsx', () => ({
    useClients: () => clientsState,
}));

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/components/DocumentSettingsModal', () => ({
    default: (props) => {
        lastDocumentSettingsModalProps = props;
        return props.isOpen ? <div data-testid="document-settings-modal">open</div> : null;
    },
}));

vi.mock('../../src/services/caseService.js', () => ({
    getClosedCases: (...args) => getClosedCasesMock(...args),
}));

function renderDocuments() {
    return render(
        <MemoryRouter>
            <HotkeysProvider>
                <Documents />
            </HotkeysProvider>
        </MemoryRouter>
    );
}

describe('Documents', () => {
    beforeEach(() => {
        localStorage.clear();
        lastDocumentSettingsModalProps = null;

        getClosedCasesMock.mockReset();
        getClosedCasesMock.mockResolvedValue({
            ok: true,
            data: [
                {
                    id: 2,
                    title: 'Caso Cerrado',
                    status: 'closed',
                    data_json: JSON.stringify({
                        id: 2,
                        title: 'Caso Cerrado',
                        status: 'closed',
                        clients: [{ id: 20, first_name: 'Lucia', last_name: 'Gomez' }],
                    }),
                },
            ],
        });

        documentsState = {
            documents: [
                {
                    id: 1,
                    name: 'Doc Abierto',
                    suit_case_id: 1,
                    created_at: '2026-02-01T10:00:00.000Z',
                    updated_at: '2026-02-02T10:00:00.000Z',
                    latest_version: { creator: { name: 'Ana' } },
                },
                {
                    id: 2,
                    name: 'Doc Personal',
                    suit_case_id: null,
                    created_at: '2026-02-01T10:00:00.000Z',
                    updated_at: '2026-02-02T10:00:00.000Z',
                    latest_version: { creator: { name: 'Ana' } },
                },
                {
                    id: 3,
                    name: 'Doc Cerrado',
                    suit_case_id: 2,
                    created_at: '2026-02-01T10:00:00.000Z',
                    updated_at: '2026-02-02T10:00:00.000Z',
                    latest_version: { creator: { name: 'Bruno' } },
                },
            ],
            refreshDocuments: vi.fn().mockResolvedValue(undefined),
        };

        casesState = {
            cases: [
                {
                    id: 1,
                    title: 'Caso Laboral',
                    status: 'open',
                    data_json: JSON.stringify({
                        id: 1,
                        title: 'Caso Laboral',
                        status: 'open',
                        clients: [{ id: 10, first_name: 'Carlos', last_name: 'Perez' }],
                    }),
                },
            ],
        };

        clientsState = {
            clients: [
                { id: 10, first_name: 'Carlos', last_name: 'Perez' },
                { id: 20, first_name: 'Lucia', last_name: 'Gomez' },
            ],
        };

        authState = { user: { id: 1, role: 'lawyer' } };
    });

    it('muestra por defecto documentos de casos abiertos y personales, pero no finalizados', () => {
        renderDocuments();

        expect(screen.getByText('Doc Abierto')).toBeInTheDocument();
        expect(screen.getByText('Doc Personal')).toBeInTheDocument();
        expect(screen.queryByText('Doc Cerrado')).not.toBeInTheDocument();
    });

    it('incluye documentos de casos finalizados al activar el toggle del dialogo', async () => {
        renderDocuments();

        fireEvent.click(screen.getByRole('button', { name: /filtro por caso/i }));
        fireEvent.click(screen.getByLabelText(/incluir casos finalizados/i));

        await waitFor(() => {
            expect(getClosedCasesMock).toHaveBeenCalled();
        });

        fireEvent.click(screen.getByRole('button', { name: /cerrar selector de casos/i }));

        await waitFor(() => {
            expect(screen.getByText('Doc Cerrado')).toBeInTheDocument();
        });
    });

    it('filtra por cliente usando el autosuggest y soporta fallback a data_json del caso', async () => {
        renderDocuments();

        const clientInput = screen.getByLabelText('Clientes');
        fireEvent.focus(clientInput);
        fireEvent.change(clientInput, { target: { value: 'Carlos' } });

        fireEvent.click(await screen.findByRole('button', { name: 'Carlos Perez' }));

        await waitFor(() => {
            expect(screen.getByText('Doc Abierto')).toBeInTheDocument();
            expect(screen.queryByText('Doc Personal')).not.toBeInTheDocument();
            expect(screen.queryByText('Doc Cerrado')).not.toBeInTheDocument();
        });
    });

    it('restaura filtros persistidos entre montajes', async () => {
        const firstRender = renderDocuments();

        fireEvent.click(screen.getByRole('button', { name: /filtro por caso/i }));
        fireEvent.click(screen.getByRole('button', { name: /caso laboral/i }));

        await waitFor(() => {
            expect(screen.queryByText('Doc Personal')).not.toBeInTheDocument();
        });

        firstRender.unmount();
        renderDocuments();

        expect(screen.getByRole('button', { name: /filtro por caso/i })).toHaveTextContent('Caso Laboral');
        expect(screen.getByText('Doc Abierto')).toBeInTheDocument();
        expect(screen.queryByText('Doc Personal')).not.toBeInTheDocument();

        const savedRaw = localStorage.getItem(DOCUMENT_FILTER_STORAGE_KEY);
        expect(savedRaw).toContain('specific');
    });

    it('abre el modal de propiedades desde acciones del documento', async () => {
        renderDocuments();

        fireEvent.click(screen.getAllByRole('button', { name: /configuración y permisos/i })[0]);

        await waitFor(() => {
            expect(screen.getByTestId('document-settings-modal')).toHaveTextContent('open');
        });

        expect(lastDocumentSettingsModalProps?.documentData?.id).toBe(1);
    });

    it('no muestra archivos con categoría multimedia', () => {
        documentsState.documents.push({
            id: 100,
            name: 'Imagen Multimedia',
            suit_case_id: 1,
            category: 'multimedia',
            created_at: '2026-02-01T10:00:00.000Z',
            updated_at: '2026-02-02T10:00:00.000Z',
            latest_version: { creator: { name: 'Ana' } },
        });

        renderDocuments();

        expect(screen.queryByText('Imagen Multimedia')).not.toBeInTheDocument();
        expect(screen.getByText('Doc Abierto')).toBeInTheDocument();
    });
});
