import React from 'react';
import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let casesState = { cases: [], syncing: false };
let clientsState = { clients: [], syncing: false };
let documentsState = { documents: [], loading: false, syncing: false };
let usersState = { users: [], syncing: false };
let partesState = { partes: [], syncing: false };
let multimediaState = { multimedia: [], loading: false };
let filesState = { files: [], loading: false };
let partesCasoState = { partesCaso: [], loading: false };

vi.mock('../../src/context/CasesContext.jsx', () => ({
    useCases: () => casesState,
}));

vi.mock('../../src/context/ClientsContext.jsx', () => ({
    useClients: () => clientsState,
}));

vi.mock('../../src/context/DocumentsContext.jsx', () => ({
    useDocuments: () => documentsState,
}));

vi.mock('../../src/context/UsersContext.jsx', () => ({
    useUsers: () => usersState,
}));

vi.mock('../../src/context/PartesContext.jsx', () => ({
    usePartes: () => partesState,
}));

vi.mock('../../src/context/MultimediaContext.jsx', () => ({
    useMultimedia: () => multimediaState,
}));

vi.mock('../../src/context/FilesContext.jsx', () => ({
    useFiles: () => filesState,
}));

vi.mock('../../src/hooks/usePartesCaso.js', () => ({
    usePartesCaso: () => partesCasoState,
}));

vi.mock('../../src/services/draftingToolsApiService.js', () => ({
    fetchEntityDetail: vi.fn(),
}));

vi.mock('../../src/services/logService.js', () => ({
    createLogger: () => ({
        error: vi.fn(),
    }),
}));

import GeneralTools from '../../src/components/Editor/DraftingTools/GeneralTools.jsx';
import CaseTools from '../../src/components/Editor/DraftingTools/CaseTools.jsx';

describe('Drafting tools panels', () => {
    beforeEach(() => {
        window.electronAPI = {
            db: {
                getAll: vi.fn().mockResolvedValue([]),
            },
        };
    });

    it('oculta honorarios y gastos en las herramientas generales del editor', () => {
        render(<GeneralTools onPreviewDocument={vi.fn()} />);

        expect(screen.queryByText('Honorarios')).not.toBeInTheDocument();
        expect(screen.queryByText('Gastos')).not.toBeInTheDocument();
        expect(screen.getByText('Casos')).toBeInTheDocument();
        expect(screen.getByText('Documentos')).toBeInTheDocument();
    });

    it('oculta honorarios y gastos en las herramientas por caso del editor', async () => {
        render(
            <CaseTools
                caseId={12}
                onPreviewDocument={vi.fn()}
                onPreviewMedia={vi.fn()}
            />,
        );

        expect(screen.queryByText('Honorarios')).not.toBeInTheDocument();
        expect(screen.queryByText('Gastos')).not.toBeInTheDocument();
        expect(await screen.findByText('Documentos')).toBeInTheDocument();
        expect(screen.getByText('Eventos del caso')).toBeInTheDocument();
    });
});
