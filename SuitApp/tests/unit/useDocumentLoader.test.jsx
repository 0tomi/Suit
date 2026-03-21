import { act, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const getDocumentContentMock = vi.fn();
const getDocumentLastModifiedMock = vi.fn();

vi.mock('../../src/services/documentService.js', () => ({
    getDocumentContent: (...args) => getDocumentContentMock(...args),
    getDocumentLastModified: (...args) => getDocumentLastModifiedMock(...args),
}));

import { useDocumentLoader } from '../../src/hooks/useDocumentLoader.js';

function createDbMock(localRow = null) {
    return {
        getById: vi.fn().mockResolvedValue(localRow),
        upsertMany: vi.fn().mockResolvedValue(undefined),
    };
}

describe('useDocumentLoader', () => {
    beforeEach(() => {
        getDocumentContentMock.mockReset();
        getDocumentLastModifiedMock.mockReset();
        vi.useRealTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it('inicializa un documento nuevo sin cargar remoto', () => {
        const db = createDbMock();

        const { result } = renderHook(() => useDocumentLoader({
            id: undefined,
            db,
            documents: [],
        }));

        expect(result.current.title).toBe('');
        expect(result.current.content).toBe('');
        expect(result.current.isLoading).toBe(false);
        expect(result.current.docMeta).toBeNull();
        expect(getDocumentLastModifiedMock).not.toHaveBeenCalled();
        expect(getDocumentContentMock).not.toHaveBeenCalled();
    });

    it('usa cache local y revalida cuando hay una version remota mas nueva', async () => {
        const localRow = {
            id: 3,
            name: 'Contrato viejo',
            content: '<p>Contenido local</p>',
            updated_at: '2025-01-10T10:00:00.000Z',
            data_json: JSON.stringify({
                id: 3,
                name: 'Contrato viejo',
                updated_at: '2025-01-10T10:00:00.000Z',
            }),
        };
        const db = createDbMock(localRow);

        getDocumentLastModifiedMock.mockResolvedValue({
            last_modified: '2025-02-12T12:00:00.000Z',
        });
        getDocumentContentMock.mockResolvedValue('<p>Contenido remoto nuevo</p>');

        const { result } = renderHook(() => useDocumentLoader({
            id: '3',
            db,
            documents: [],
        }));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.title).toBe('Contrato viejo');
            expect(result.current.content).toBe('<p>Contenido remoto nuevo</p>');
            expect(result.current.saveMessage).toEqual({
                type: 'success',
                text: 'Se actualizó el documento a la última versión del servidor.',
            });
        });

        expect(db.getById).toHaveBeenCalledWith('documents', 3);
        expect(getDocumentLastModifiedMock).toHaveBeenCalledWith('3');
        expect(getDocumentContentMock).toHaveBeenCalledWith('3');
        expect(db.upsertMany).toHaveBeenCalledTimes(1);
    });

    it('permite refrescar manualmente y persistir la nueva version', async () => {
        const db = createDbMock({
            id: 7,
            name: 'Acta inicial',
            content: '<p>Version 1</p>',
            updated_at: '2025-01-01T08:00:00.000Z',
            data_json: JSON.stringify({
                id: 7,
                name: 'Acta inicial',
                updated_at: '2025-01-01T08:00:00.000Z',
            }),
        });

        getDocumentLastModifiedMock
            .mockResolvedValueOnce({ last_modified: '2025-01-01T08:00:00.000Z' })
            .mockResolvedValueOnce({ last_modified: '2025-03-01T08:00:00.000Z' });
        getDocumentContentMock.mockResolvedValueOnce('<p>Version 2</p>');

        const { result } = renderHook(() => useDocumentLoader({
            id: '7',
            db,
            documents: [],
        }));

        await waitFor(() => {
            expect(result.current.isLoading).toBe(false);
            expect(result.current.content).toBe('<p>Version 1</p>');
        });

        await act(async () => {
            await result.current.refreshDocument();
        });

        await waitFor(() => {
            expect(result.current.content).toBe('<p>Version 2</p>');
        });

        expect(getDocumentLastModifiedMock).toHaveBeenCalledTimes(2);
        expect(getDocumentContentMock).toHaveBeenCalledTimes(1);
        expect(db.upsertMany).toHaveBeenCalledTimes(2);
    });
});
