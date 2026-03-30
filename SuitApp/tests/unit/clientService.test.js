import { beforeEach, describe, expect, it, vi } from 'vitest';

describe('clientService', () => {
    beforeEach(() => {
        window.electronAPI = {
            clients: {
                list: vi.fn(),
                get: vi.fn(),
                getDocuments: vi.fn(),
                create: vi.fn(),
                update: vi.fn(),
                delete: vi.fn(),
                getLastModified: vi.fn(),
            },
        };
    });

    it('consulta la documentación del cliente usando el bridge clients.getDocuments', async () => {
        const expectedPayload = {
            personales: { data: [] },
            por_casos: { data: [] },
        };
        window.electronAPI.clients.getDocuments.mockResolvedValue(expectedPayload);

        const { getClientDocuments } = await import('../../src/services/clientService.js');
        const result = await getClientDocuments('15', {
            page_personal: 2,
            page_cases: 3,
            page_case_docs: 4,
        });

        expect(window.electronAPI.clients.getDocuments).toHaveBeenCalledWith(15, {
            page_personal: 2,
            page_cases: 3,
            page_case_docs: 4,
        });
        expect(result).toEqual(expectedPayload);
    });
});
