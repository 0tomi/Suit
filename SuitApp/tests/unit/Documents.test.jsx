import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import Documents from '../../src/pages/Documents.jsx';
import { DOCUMENT_FILTER_STORAGE_KEY } from '../../src/pages/documentsFilters.js';
import { HotkeysProvider } from '../../src/hotkeys/HotkeysProvider.jsx';

const getClosedCasesMock = vi.fn();
const getDocumentListingPageMock = vi.fn();
const invalidateDocumentListingCacheMock = vi.fn();
const deleteDocumentMock = vi.fn();
const getDocumentLockStatusMock = vi.fn();

let lastDocumentSettingsModalProps = null;
let lastDocumentDetailsModalProps = null;

let documentsState = { documents: [] };
let casesState = { cases: [] };
let clientsState = { clients: [] };
let usersState = { users: [] };
let authState = { user: { id: 1, role: 'lawyer' } };
let closedCasesData = [];

vi.mock('../../src/context/CasesContext.jsx', () => ({
    useCases: () => casesState,
}));

vi.mock('../../src/context/ClientsContext.jsx', () => ({
    useClients: () => clientsState,
}));

vi.mock('../../src/context/UsersContext.jsx', () => ({
    useUsers: () => usersState,
}));

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/components/DocumentSettingsModal', () => ({
    default: (props) => {
        lastDocumentSettingsModalProps = props;
        if (!props.isOpen) return null;

        return (
            <div data-testid="document-settings-modal">
                <button type="button" onClick={props.onDelete}>delete-document</button>
                open
            </div>
        );
    },
}));

vi.mock('../../src/components/documents/DocumentDetailsModal.jsx', () => ({
    default: (props) => {
        lastDocumentDetailsModalProps = props;
        return props.open ? <div data-testid="document-details-modal">open</div> : null;
    },
}));

vi.mock('../../src/components/ui/SectionTutorialTrigger.jsx', () => ({
    SectionTutorialTrigger: () => null,
}));

vi.mock('../../src/components/ui/Table', () => ({
    Table: ({ children, isEmpty, emptyMessage }) => (
        <table>
            <tbody>{children}</tbody>
            {isEmpty ? <caption>{emptyMessage}</caption> : null}
        </table>
    ),
}));

vi.mock('../../src/services/caseService.js', () => ({
    getClosedCases: (...args) => getClosedCasesMock(...args),
}));

vi.mock('../../src/services/documentListingBackendService.js', () => ({
    getDocumentListingPage: (...args) => getDocumentListingPageMock(...args),
    invalidateDocumentListingCache: (...args) => invalidateDocumentListingCacheMock(...args),
}));

vi.mock('../../src/services/documentService.js', async () => {
    const actual = await vi.importActual('../../src/services/documentService.js');
    return {
        ...actual,
        deleteDocument: (...args) => deleteDocumentMock(...args),
        getDocumentLockStatus: (...args) => getDocumentLockStatusMock(...args),
    };
});

function getCaseClients(caseItem) {
    if (Array.isArray(caseItem?.clients)) {
        return caseItem.clients;
    }

    if (caseItem?.data_json) {
        try {
            const parsed = JSON.parse(caseItem.data_json);
            if (Array.isArray(parsed?.clients)) {
                return parsed.clients;
            }
        } catch {
            return [];
        }
    }

    return [];
}

function getCaseLifecycle(caseItem) {
    if (!caseItem) return 'unknown';
    if (caseItem.end_date) return 'closed';
    if (caseItem.status === 'closed') return 'closed';
    return 'open';
}

function buildCasesMap() {
    const merged = new Map();
    [...casesState.cases, ...closedCasesData].forEach((caseItem) => {
        merged.set(String(caseItem.id), caseItem);
    });
    return merged;
}

function filterDocumentsForMock(documents, filters) {
    const casesMap = buildCasesMap();

    return documents.filter((doc) => {
        if (doc.category === 'multimedia') return false;

        const name = String(doc.name || doc.title || '').toLowerCase();
        if (filters.searchQuery && !name.includes(filters.searchQuery.toLowerCase())) return false;

        if (filters.caseMode === 'personal') {
            if (doc.suit_case_id) return false;
        } else if (filters.caseMode === 'specific' && filters.selectedCaseId) {
            if (String(doc.suit_case_id) !== filters.selectedCaseId) return false;
        } else if (!filters.includeClosedCases && doc.suit_case_id) {
            const caseItem = casesMap.get(String(doc.suit_case_id));
            if (caseItem && getCaseLifecycle(caseItem) === 'closed') {
                return false;
            }
        }

        if (filters.selectedClientId) {
            if (!doc.suit_case_id) return false;
            const caseItem = casesMap.get(String(doc.suit_case_id));
            if (!caseItem) return false;
            const hasClient = getCaseClients(caseItem).some((client) => String(client.id) === filters.selectedClientId);
            if (!hasClient) return false;
        }

        if (filters.selectedStatus && doc.status !== filters.selectedStatus) {
            return false;
        }

        if (filters.selectedCreator) {
            const creatorId = String(doc.latest_version?.creator?.id ?? doc.user_id ?? '');
            if (creatorId !== filters.selectedCreator) return false;
        }

        return true;
    });
}

function sortDocumentsForMock(documents, filters) {
    const direction = filters.sortDirection === 'asc' ? 1 : -1;

    return [...documents].sort((left, right) => {
        if (filters.sortBy === 'name') {
            const comparison = String(left.name || left.title || '').localeCompare(
                String(right.name || right.title || ''),
                'es',
                { sensitivity: 'base' },
            );
            return comparison * direction;
        }

        const leftValue = new Date(
            filters.sortBy === 'created_at'
                ? (left.created_at || 0)
                : (left.updated_at || left.created_at || 0),
        ).getTime();
        const rightValue = new Date(
            filters.sortBy === 'created_at'
                ? (right.created_at || 0)
                : (right.updated_at || right.created_at || 0),
        ).getTime();

        return (leftValue - rightValue) * direction;
    });
}

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
        const storage = new Map();
        const localStorageMock = {
            getItem: vi.fn((key) => storage.get(String(key)) ?? null),
            setItem: vi.fn((key, value) => {
                storage.set(String(key), String(value));
            }),
            removeItem: vi.fn((key) => {
                storage.delete(String(key));
            }),
            clear: vi.fn(() => {
                storage.clear();
            }),
        };
        Object.defineProperty(window, 'localStorage', {
            configurable: true,
            value: localStorageMock,
        });
        Object.defineProperty(globalThis, 'localStorage', {
            configurable: true,
            value: localStorageMock,
        });
        window.localStorage.clear();

        lastDocumentSettingsModalProps = null;
        lastDocumentDetailsModalProps = null;

        closedCasesData = [
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
        ];

        getClosedCasesMock.mockReset();
        getClosedCasesMock.mockResolvedValue({
            ok: true,
            data: closedCasesData,
        });

        deleteDocumentMock.mockReset();
        deleteDocumentMock.mockResolvedValue({ ok: true });

        getDocumentLockStatusMock.mockReset();
        getDocumentLockStatusMock.mockResolvedValue({ ok: true, is_locked: false });

        invalidateDocumentListingCacheMock.mockReset();
        invalidateDocumentListingCacheMock.mockResolvedValue({ ok: true });

        documentsState = {
            documents: [
                {
                    id: 1,
                    name: 'Doc Abierto',
                    suit_case_id: 1,
                    user_id: 1,
                    status: 'Borrador',
                    created_at: '2026-02-01T10:00:00.000Z',
                    updated_at: '2026-02-03T10:00:00.000Z',
                    latest_version: { creator: { id: 1, name: 'Ana' } },
                },
                {
                    id: 2,
                    name: 'Doc Personal',
                    suit_case_id: null,
                    user_id: 1,
                    status: 'Firmado',
                    created_at: '2026-02-04T10:00:00.000Z',
                    updated_at: '2026-02-02T10:00:00.000Z',
                    latest_version: { creator: { id: 1, name: 'Ana' } },
                },
                {
                    id: 3,
                    name: 'Doc Cerrado',
                    suit_case_id: 2,
                    user_id: 2,
                    status: 'Presentado',
                    created_at: '2026-02-05T10:00:00.000Z',
                    updated_at: '2026-02-01T10:00:00.000Z',
                    latest_version: { creator: { id: 2, name: 'Bruno' } },
                },
            ],
        };

        getDocumentListingPageMock.mockReset();
        getDocumentListingPageMock.mockImplementation(async ({ page = 1, filters = {} } = {}) => {
            const filtered = sortDocumentsForMock(
                filterDocumentsForMock(documentsState.documents, filters),
                {
                    sortBy: filters.sortBy || 'updated_at',
                    sortDirection: filters.sortDirection || 'desc',
                },
            );
            const perPage = 15;
            const startIndex = (page - 1) * perPage;

            return {
                items: filtered.slice(startIndex, startIndex + perPage),
                totalDocuments: filtered.length,
                totalPages: Math.max(1, Math.ceil(filtered.length / perPage)),
                perPage,
                page,
                source: 'cache',
            };
        });

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

        usersState = {
            users: [
                { id: 1, name: 'Ana', tag: 'ana' },
                { id: 2, name: 'Bruno', tag: 'bruno' },
            ],
        };

        authState = { user: { id: 1, role: 'lawyer' } };
    });

    it('muestra por defecto documentos de casos abiertos y personales, pero no finalizados', async () => {
        renderDocuments();

        expect(await screen.findByText('Doc Abierto')).toBeInTheDocument();
        expect(screen.getByText('Doc Personal')).toBeInTheDocument();
        expect(screen.queryByText('Doc Cerrado')).not.toBeInTheDocument();
    });

    it('incluye documentos de casos finalizados al activar el toggle del dialogo', async () => {
        renderDocuments();
        await screen.findByText('Doc Abierto');

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
        await screen.findByText('Doc Abierto');

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
        await screen.findByText('Doc Abierto');

        fireEvent.click(screen.getByRole('button', { name: /filtro por caso/i }));
        fireEvent.click(screen.getByRole('button', { name: /caso laboral/i }));

        await waitFor(() => {
            expect(screen.queryByText('Doc Personal')).not.toBeInTheDocument();
        });

        await waitFor(() => {
            const savedRaw = window.localStorage.getItem(DOCUMENT_FILTER_STORAGE_KEY);
            expect(savedRaw).toContain('specific');
        });

        firstRender.unmount();
        renderDocuments();

        expect(await screen.findByRole('button', { name: /filtro por caso/i })).toHaveTextContent('Caso Laboral');
        expect(screen.getByText('Doc Abierto')).toBeInTheDocument();
        expect(screen.queryByText('Doc Personal')).not.toBeInTheDocument();
    });

    it('permite cambiar el orden y persiste el criterio seleccionado', async () => {
        const firstRender = renderDocuments();
        await screen.findByText('Doc Abierto');

        fireEvent.click(screen.getByTestId('documents-sort-select'));
        fireEvent.click(await screen.findByText('Creación: más reciente'));

        await waitFor(() => {
            const documentButtons = screen.getAllByRole('button').filter((button) => (
                ['Doc Personal', 'Doc Abierto'].includes(button.textContent)
            ));
            expect(documentButtons.map((button) => button.textContent)).toEqual(['Doc Personal', 'Doc Abierto']);
        });

        await waitFor(() => {
            expect(getDocumentListingPageMock).toHaveBeenLastCalledWith(expect.objectContaining({
                filters: expect.objectContaining({
                    sortBy: 'created_at',
                    sortDirection: 'desc',
                }),
            }));
        });

        firstRender.unmount();
        renderDocuments();

        await waitFor(() => {
            expect(screen.getByTestId('documents-sort-select')).toHaveTextContent('Creación: más reciente');
        });
    });

    it('abre el modal de propiedades desde acciones del documento', async () => {
        renderDocuments();
        await screen.findByText('Doc Abierto');

        fireEvent.click(screen.getAllByRole('button', { name: /configuración y permisos/i })[0]);

        await waitFor(() => {
            expect(screen.getByTestId('document-settings-modal')).toHaveTextContent('open');
        });

        expect(lastDocumentSettingsModalProps?.documentData?.id).toBe(1);
    });

    it('abre el modal de detalle desde el icono de vista del documento', async () => {
        renderDocuments();
        await screen.findByText('Doc Abierto');

        fireEvent.click(screen.getAllByRole('button', { name: /ver información del documento/i })[0]);

        await waitFor(() => {
            expect(screen.getByTestId('document-details-modal')).toHaveTextContent('open');
        });

        expect(lastDocumentDetailsModalProps?.documentData?.id).toBe(1);
    });

    it('no muestra archivos con categoría multimedia', async () => {
        documentsState.documents.push({
            id: 100,
            name: 'Imagen Multimedia',
            suit_case_id: 1,
            category: 'multimedia',
            created_at: '2026-02-01T10:00:00.000Z',
            updated_at: '2026-02-02T10:00:00.000Z',
            latest_version: { creator: { id: 1, name: 'Ana' } },
        });

        renderDocuments();

        expect(await screen.findByText('Doc Abierto')).toBeInTheDocument();
        expect(screen.queryByText('Imagen Multimedia')).not.toBeInTheDocument();
    });

    it('elimina un documento y la fila desaparece del frontend', async () => {
        renderDocuments();
        await screen.findByText('Doc Abierto');

        fireEvent.click(screen.getAllByRole('button', { name: /configuración y permisos/i })[0]);
        fireEvent.click(screen.getByRole('button', { name: 'delete-document' }));

        fireEvent.click(await screen.findByRole('button', { name: /sí, eliminar/i }));

        documentsState.documents = documentsState.documents.filter((document) => document.id !== 1);

        await waitFor(() => {
            expect(deleteDocumentMock).toHaveBeenCalledWith(1);
            expect(invalidateDocumentListingCacheMock).toHaveBeenCalled();
            expect(screen.queryByText('Doc Abierto')).not.toBeInTheDocument();
        });
    });
});
