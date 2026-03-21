import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';

const createDocumentMock = vi.fn();
const updateDocumentMock = vi.fn();
const getDocumentLastModifiedMock = vi.fn();
const getDocumentContentMock = vi.fn();
const getDocumentVersionContentMock = vi.fn();
const getDocumentLockStatusMock = vi.fn();
const lockDocumentMock = vi.fn();
const unlockDocumentMock = vi.fn();
const exportPdfMock = vi.fn();

let documentsState = { documents: [], refreshDocuments: vi.fn() };
let authState = { user: { id: 1, name: 'Ana', tag: 'ana' } };

vi.mock('../../src/context/DocumentsContext.jsx', () => ({
    useDocuments: () => documentsState,
}));

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/components/Editor/TiptapEditor', () => ({
    default: ({ content, onChange, readOnly }) => (
        <textarea
            aria-label="editor"
            value={content}
            onChange={(event) => onChange(event.target.value)}
            readOnly={readOnly}
        />
    ),
}));

vi.mock('../../src/components/DocumentSettingsModal', () => ({
    default: ({ isOpen, onConfirmCreate }) => (
        isOpen ? (
            <div data-testid="document-settings-modal">
                settings
                {onConfirmCreate ? (
                    <button type="button" onClick={onConfirmCreate}>
                        Guardar documento
                    </button>
                ) : null}
            </div>
        ) : null
    ),
}));

vi.mock('../../src/services/documentService.js', () => ({
    createDocument: (...args) => createDocumentMock(...args),
    updateDocument: (...args) => updateDocumentMock(...args),
    getDocumentLastModified: (...args) => getDocumentLastModifiedMock(...args),
    getDocumentContent: (...args) => getDocumentContentMock(...args),
    getDocumentVersionContent: (...args) => getDocumentVersionContentMock(...args),
    getDocumentLockStatus: (...args) => getDocumentLockStatusMock(...args),
    lockDocument: (...args) => lockDocumentMock(...args),
    unlockDocument: (...args) => unlockDocumentMock(...args),
}));

import DocumentEditor from '../../src/pages/DocumentEditor.jsx';

function LocationDisplay() {
    const location = useLocation();
    return (
        <>
            <div data-testid="location">{`${location.pathname}${location.search}`}</div>
            <div data-testid="location-active-tab">{location.state?.activeTab || ''}</div>
        </>
    );
}

function renderDocumentEditor(initialEntry) {
    const routes = [
        {
            path: '/documents/new',
            element: (
                <>
                    <LocationDisplay />
                    <DocumentEditor />
                </>
            ),
        },
        {
            path: '/documents/edit/:id',
            element: (
                <>
                    <LocationDisplay />
                    <DocumentEditor />
                </>
            ),
        },
        {
            path: '/cases/:id',
            element: (
                <>
                    <LocationDisplay />
                    <div>Caso</div>
                </>
            ),
        },
        {
            path: '/documents',
            element: (
                <>
                    <LocationDisplay />
                    <div>Documentos</div>
                </>
            ),
        },
    ];
    const router = createMemoryRouter(routes, {
        initialEntries: [initialEntry],
    });

    return {
        ...render(<RouterProvider router={router} />),
        router,
    };
}

describe('DocumentEditor', () => {
    beforeEach(() => {
        documentsState = { documents: [], refreshDocuments: vi.fn().mockResolvedValue(undefined) };
        authState = { user: { id: 1, name: 'Ana', tag: 'ana' } };

        createDocumentMock.mockReset();
        updateDocumentMock.mockReset();
        getDocumentLastModifiedMock.mockReset();
        getDocumentContentMock.mockReset();
        getDocumentVersionContentMock.mockReset();
        getDocumentLockStatusMock.mockReset();
        lockDocumentMock.mockReset();
        unlockDocumentMock.mockReset();
        exportPdfMock.mockReset();

        window.electronAPI = {
            db: {
                getById: vi.fn().mockResolvedValue(null),
                upsertMany: vi.fn().mockResolvedValue(undefined),
            },
            documents: {
                exportPdf: exportPdfMock,
            },
        };
    });

    it('crea un documento nuevo y navega al editor del nuevo id', async () => {
        createDocumentMock.mockResolvedValue({ ok: true, data: { id: 44 } });

        renderDocumentEditor('/documents/new');

        fireEvent.change(screen.getByPlaceholderText('Sin Título'), {
            target: { value: 'Contrato nuevo' },
        });
        fireEvent.change(screen.getByLabelText('editor'), {
            target: { value: '<p>Contenido nuevo</p>' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Guardar documento' }));

        await waitFor(() => {
            expect(createDocumentMock).toHaveBeenCalledWith({
                name: 'Contrato nuevo',
                content: '<p>Contenido nuevo</p>',
                suit_case_id: null,
            });
            expect(documentsState.refreshDocuments).toHaveBeenCalled();
            expect(screen.getByTestId('location')).toHaveTextContent('/documents/edit/44');
        });
    });

    it('preserva el retorno al caso cuando se crea un documento desde su pestaña de documentos', async () => {
        createDocumentMock.mockResolvedValue({ ok: true, data: { id: 44 } });

        renderDocumentEditor({
            pathname: '/documents/new',
            search: '?caseId=24',
            state: {
                returnTo: {
                    pathname: '/cases/24',
                    state: { activeTab: 'documents' },
                },
            },
        });

        fireEvent.change(screen.getByPlaceholderText('Sin Título'), {
            target: { value: 'Escrito desde caso' },
        });
        fireEvent.change(screen.getByLabelText('editor'), {
            target: { value: '<p>Contenido</p>' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));
        fireEvent.click(await screen.findByRole('button', { name: 'Guardar documento' }));

        await waitFor(() => {
            expect(createDocumentMock).toHaveBeenCalledWith({
                name: 'Escrito desde caso',
                content: '<p>Contenido</p>',
                suit_case_id: 24,
            });
            expect(screen.getByTestId('location')).toHaveTextContent('/documents/edit/44');
        });

        fireEvent.click(await screen.findByRole('button', { name: 'Volver' }));

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/cases/24');
            expect(screen.getByTestId('location-active-tab')).toHaveTextContent('documents');
        });
    });

    it('habilita edicion de un documento existente y lo guarda', async () => {
        const dbGetById = vi.fn().mockResolvedValue({
            id: 9,
            name: 'Contrato existente',
            content: '<p>Original</p>',
            updated_at: '2026-03-01T10:00:00.000Z',
            data_json: JSON.stringify({
                id: 9,
                name: 'Contrato existente',
                updated_at: '2026-03-01T10:00:00.000Z',
            }),
        });
        const dbUpsertMany = vi.fn().mockResolvedValue(undefined);
        window.electronAPI = {
            db: {
                getById: dbGetById,
                upsertMany: dbUpsertMany,
            },
        };

        getDocumentLastModifiedMock.mockResolvedValue({
            last_modified: '2026-03-01T10:00:00.000Z',
        });
        getDocumentLockStatusMock.mockResolvedValue({
            ok: true,
            is_locked: false,
        });
        lockDocumentMock.mockResolvedValue({ ok: true });
        updateDocumentMock.mockResolvedValue({
            ok: true,
            data: {
                id: 9,
                name: 'Contrato existente',
                updated_at: '2026-03-02T10:00:00.000Z',
            },
        });

        renderDocumentEditor('/documents/edit/9');

        await screen.findByDisplayValue('Contrato existente');

        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

        await waitFor(() => {
            expect(lockDocumentMock).toHaveBeenCalledWith('9');
        });

        fireEvent.change(screen.getByLabelText('editor'), {
            target: { value: '<p>Actualizado</p>' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(updateDocumentMock).toHaveBeenCalledWith('9', { content: '<p>Actualizado</p>' });
            expect(documentsState.refreshDocuments).toHaveBeenCalled();
            expect(screen.getByText('Documento guardado correctamente.')).toBeInTheDocument();
        });

        expect(dbUpsertMany).toHaveBeenCalled();
    });

    it('bloquea navegacion con cambios sin guardar y permite confirmar salida', async () => {
        renderDocumentEditor('/documents/new');

        fireEvent.change(screen.getByLabelText('editor'), {
            target: { value: '<p>Borrador sin guardar</p>' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Volver' }));

        await screen.findByText('Cambios sin guardar');
        expect(screen.getByText('Tienes cambios sin guardar en este documento. Si sales ahora, se perderán.')).toBeInTheDocument();
        expect(screen.getByTestId('location')).toHaveTextContent('/documents/new');

        fireEvent.click(screen.getByRole('button', { name: 'Continuar editando' }));
        await waitFor(() => {
            expect(screen.queryByText('Cambios sin guardar')).not.toBeInTheDocument();
        });

        fireEvent.click(screen.getByRole('button', { name: 'Volver' }));
        await screen.findByRole('button', { name: 'Salir sin guardar' });
        fireEvent.click(screen.getByRole('button', { name: 'Salir sin guardar' }));

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/documents');
        });
    });

    it('exporta el documento actual a PDF usando el bridge de Electron', async () => {
        exportPdfMock.mockResolvedValue({
            canceled: false,
            filePath: '/tmp/contrato-nuevo.pdf',
        });

        renderDocumentEditor('/documents/new');

        fireEvent.change(screen.getByPlaceholderText('Sin Título'), {
            target: { value: 'Contrato nuevo' },
        });
        fireEvent.change(screen.getByLabelText('editor'), {
            target: { value: '<p>Contenido exportable</p>' },
        });

        fireEvent.click(screen.getByRole('button', { name: 'Exportar PDF' }));

        await waitFor(() => {
            expect(exportPdfMock).toHaveBeenCalledWith({
                title: 'Contrato nuevo',
                html: '<p>Contenido exportable</p>',
                fontFamily: window.getComputedStyle(document.body).fontFamily || undefined,
            });
        });
    });

    it('abre una versión histórica en solo lectura y al guardarla vuelve al documento actual', async () => {
        const dbGetById = vi.fn().mockResolvedValue({
            id: 9,
            name: 'Contrato existente',
            content: '<p>Ultima version</p>',
            updated_at: '2026-03-03T10:00:00.000Z',
            data_json: JSON.stringify({
                id: 9,
                name: 'Contrato existente',
                updated_at: '2026-03-03T10:00:00.000Z',
            }),
        });

        window.electronAPI = {
            db: {
                getById: dbGetById,
                upsertMany: vi.fn().mockResolvedValue(undefined),
            },
        };

        getDocumentLastModifiedMock.mockResolvedValue({
            last_modified: '2026-03-03T10:00:00.000Z',
        });
        getDocumentContentMock.mockResolvedValue('<p>Ultima version</p>');
        getDocumentVersionContentMock.mockResolvedValue('<p>Version historica</p>');
        getDocumentLockStatusMock.mockResolvedValue({
            ok: true,
            is_locked: false,
        });
        lockDocumentMock.mockResolvedValue({ ok: true });
        updateDocumentMock.mockResolvedValue({
            ok: true,
            data: {
                id: 9,
                name: 'Contrato existente',
                updated_at: '2026-03-04T10:00:00.000Z',
            },
        });

        renderDocumentEditor('/documents/edit/9?versionId=21&versionNumber=3');

        await waitFor(() => {
            expect(getDocumentVersionContentMock).toHaveBeenCalledWith('9', '21');
        });

        expect(screen.getByLabelText('editor')).toHaveValue('<p>Version historica</p>');
        expect(screen.getByText('Historial v3')).toBeInTheDocument();
        expect(screen.getByLabelText('editor')).toHaveAttribute('readonly');

        fireEvent.click(screen.getByRole('button', { name: 'Editar' }));

        await waitFor(() => {
            expect(lockDocumentMock).toHaveBeenCalledWith('9');
        });

        fireEvent.change(screen.getByLabelText('editor'), {
            target: { value: '<p>Version historica editada</p>' },
        });
        fireEvent.click(screen.getByRole('button', { name: 'Guardar' }));

        await waitFor(() => {
            expect(updateDocumentMock).toHaveBeenCalledWith('9', { content: '<p>Version historica editada</p>' });
            expect(screen.getByTestId('location')).toHaveTextContent('/documents/edit/9');
        });
    });
});
