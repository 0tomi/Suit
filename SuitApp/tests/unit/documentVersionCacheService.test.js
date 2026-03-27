import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    getDocumentVersionContentCached,
    getDocumentVersionsCached,
} from '../../src/services/documentVersionCacheService.js';

describe('documentVersionCacheService', () => {
    beforeEach(() => {
        window.electronAPI = {
            documents: {
                getVersionHistory: vi.fn().mockResolvedValue([]),
                getVersionContent: vi.fn().mockResolvedValue(null),
            },
        };
    });

    it('delegá el historial al backend de Electron', async () => {
        window.electronAPI.documents.getVersionHistory.mockResolvedValue([
            { id: 101, document_id: 42, version_number: 2 },
        ]);

        const versions = await getDocumentVersionsCached(42);

        expect(window.electronAPI.documents.getVersionHistory).toHaveBeenCalledWith(42);
        expect(versions).toHaveLength(1);
        expect(versions[0].version_number).toBe(2);
    });

    it('delegá el contenido puntual al backend de Electron', async () => {
        window.electronAPI.documents.getVersionContent.mockResolvedValue('<p>Versión histórica</p>');

        const content = await getDocumentVersionContentCached(42, 101, {
            id: 101,
            document_id: 42,
            version_number: 2,
        });

        expect(window.electronAPI.documents.getVersionContent).toHaveBeenCalledWith(42, 101, {
            id: 101,
            document_id: 42,
            version_number: 2,
        });
        expect(content).toBe('<p>Versión histórica</p>');
    });

    it('retorna fallback seguro cuando el bridge no está disponible', async () => {
        window.electronAPI = {};

        await expect(getDocumentVersionsCached(42)).resolves.toEqual([]);
        await expect(getDocumentVersionContentCached(42, 101)).resolves.toBeNull();
    });
});
