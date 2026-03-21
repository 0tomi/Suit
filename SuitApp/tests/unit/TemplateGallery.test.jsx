import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createMemoryRouter, RouterProvider, useLocation } from 'react-router-dom';

const refreshTemplatesMock = vi.fn().mockResolvedValue(undefined);
const refreshTemplateCategoriesMock = vi.fn().mockResolvedValue(undefined);
const getTemplateMock = vi.fn();
const showAppToastMock = vi.fn();

let templatesState = [];
let categoriesState = [];
let authState = { user: { id: 1, role: 'lawyer' } };

vi.mock('../../src/context/TemplatesContext.jsx', () => ({
    useTemplates: () => ({
        templates: templatesState,
        refreshTemplates: refreshTemplatesMock,
        syncing: false,
        initialized: true,
    }),
}));

vi.mock('../../src/context/TemplateCategoriesContext.jsx', () => ({
    useTemplateCategories: () => ({
        template_categories: categoriesState,
        refreshTemplateCategories: refreshTemplateCategoriesMock,
        syncing: false,
        initialized: true,
    }),
}));

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/hooks/useConfirmDialog.js', () => ({
    useConfirmDialog: () => ({
        dialogProps: { open: false, loading: false },
        openDialog: vi.fn(),
        closeDialog: vi.fn(),
        setDialogLoading: vi.fn(),
    }),
}));

vi.mock('../../src/services/templateService.js', () => ({
    createTemplateCategory: vi.fn(),
    deleteTemplate: vi.fn(),
    getTemplate: (...args) => getTemplateMock(...args),
}));

vi.mock('../../src/components/ui/show-app-toast.jsx', () => ({
    showAppToast: (...args) => showAppToastMock(...args),
}));

vi.mock('../../src/components/Editor/TiptapEditor.jsx', () => ({
    default: ({ content, readOnly }) => (
        <div data-testid="template-preview-editor" data-readonly={String(readOnly)}>
            {content}
        </div>
    ),
}));

import TemplateGallery from '../../src/pages/TemplateGallery.jsx';

function LocationDisplay() {
    const location = useLocation();
    return <div data-testid="location">{location.pathname}{location.search}</div>;
}

function renderTemplateGallery() {
    const router = createMemoryRouter([
        {
            path: '/templates',
            element: (
                <>
                    <LocationDisplay />
                    <TemplateGallery />
                </>
            ),
        },
        {
            path: '/documents/new',
            element: <LocationDisplay />,
        },
    ], {
        initialEntries: ['/templates'],
    });

    return render(<RouterProvider router={router} />);
}

describe('TemplateGallery', () => {
    beforeEach(() => {
        templatesState = [
            {
                id: 21,
                title: 'Modelo laboral',
                template_category_id: 7,
                content: '<p>Contenido cacheado</p>',
            },
            {
                id: 22,
                title: 'Modelo sin cache',
                template_category_id: 7,
            },
        ];
        categoriesState = [
            {
                id: 7,
                name: 'Laboral',
                description: 'Modelos del fuero laboral',
            },
        ];
        authState = { user: { id: 1, role: 'lawyer' } };

        refreshTemplatesMock.mockClear();
        refreshTemplateCategoriesMock.mockClear();
        getTemplateMock.mockReset();
        showAppToastMock.mockReset();
    });

    it('abre la vista previa usando el contenido cacheado y permite usar la plantilla', async () => {
        renderTemplateGallery();

        fireEvent.click(await screen.findByTestId('template-card-preview-21'));

        expect(await screen.findByTestId('template-preview-modal')).toBeInTheDocument();
        expect(screen.getByTestId('template-preview-editor')).toHaveTextContent('<p>Contenido cacheado</p>');

        fireEvent.click(screen.getByTestId('template-preview-use-button'));

        await waitFor(() => {
            expect(screen.getByTestId('location')).toHaveTextContent('/documents/new?templateId=21');
        });
        expect(getTemplateMock).not.toHaveBeenCalled();
    });

    it('rehidrata la plantilla desde la API si el listado no trae content', async () => {
        getTemplateMock.mockResolvedValue({
            id: 22,
            title: 'Modelo sin cache',
            template_category_id: 7,
            content: '<p>Contenido remoto</p>',
        });

        renderTemplateGallery();

        fireEvent.click(await screen.findByTestId('template-card-preview-22'));

        await waitFor(() => {
            expect(getTemplateMock).toHaveBeenCalledWith(22);
        });
        expect(await screen.findByTestId('template-preview-editor')).toHaveTextContent('<p>Contenido remoto</p>');
    });

    it('muestra feedback si falla la carga de la vista previa remota', async () => {
        getTemplateMock.mockResolvedValue(null);

        renderTemplateGallery();

        fireEvent.click(await screen.findByTestId('template-card-preview-22'));

        await waitFor(() => {
            expect(showAppToastMock).toHaveBeenCalledWith(expect.objectContaining({
                title: 'Error al cargar la vista previa',
                variant: 'danger',
            }));
        });
        expect(screen.queryByTestId('template-preview-modal')).not.toBeInTheDocument();
    });
});
