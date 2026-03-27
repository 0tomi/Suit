import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.fn();
const apiRequestMock = vi.fn();

vi.mock('../../src/services/api.js', () => ({
    apiGet: (...args) => apiGetMock(...args),
    apiRequest: (...args) => apiRequestMock(...args),
}));

describe('documentService', () => {
    beforeEach(() => {
        apiGetMock.mockReset();
        apiRequestMock.mockReset();
    });

    it('crea documentos enviando JSON con content', async () => {
        apiRequestMock.mockResolvedValue({ ok: true, data: { id: 44 } });
        const { createDocument } = await import('../../src/services/documentService.js');

        await createDocument({
            name: 'Escrito inicial',
            content: '<p>Contenido</p>',
            suit_case_id: 7,
            status: 'Borrador',
        });

        expect(apiRequestMock).toHaveBeenCalledWith('/documents', {
            method: 'POST',
            body: {
                name: 'Escrito inicial',
                content: '<p>Contenido</p>',
                suit_case_id: 7,
                status: 'Borrador',
            },
        });
    });

    it('actualiza documentos enviando PUT JSON solo con content', async () => {
        apiRequestMock.mockResolvedValue({ ok: true, data: { id: 9 } });
        const { updateDocument } = await import('../../src/services/documentService.js');

        await updateDocument(9, {
            content: '<p>Versión 2</p>',
        });

        expect(apiRequestMock).toHaveBeenCalledWith('/documents/9', {
            method: 'PUT',
            body: {
                content: '<p>Versión 2</p>',
            },
        });
    });

    it('actualiza el nombre del documento via PATCH /name', async () => {
        apiRequestMock.mockResolvedValue({ ok: true, data: { id: 9 } });
        const { updateDocumentName } = await import('../../src/services/documentService.js');

        await updateDocumentName(9, 'Contrato actualizado');

        expect(apiRequestMock).toHaveBeenCalledWith('/documents/9/name', {
            method: 'PATCH',
            body: {
                name: 'Contrato actualizado',
            },
        });
    });

    it('actualiza el estado del documento via PATCH /status', async () => {
        apiRequestMock.mockResolvedValue({ ok: true, data: { id: 9 } });
        const { updateDocumentStatus } = await import('../../src/services/documentService.js');

        await updateDocumentStatus(9, 'Firmado');

        expect(apiRequestMock).toHaveBeenCalledWith('/documents/9/status', {
            method: 'PATCH',
            body: {
                status: 'Firmado',
            },
        });
    });
});
