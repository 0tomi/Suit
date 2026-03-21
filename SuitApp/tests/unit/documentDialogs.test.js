import { describe, expect, it, vi } from 'vitest';
import {
    MAX_IMAGE_FILE_SIZE_BYTES,
    openImageDialog,
} from '../../electron/documentDialogs.cjs';

describe('documentDialogs', () => {
    it('retorna cancelación si el usuario cierra el diálogo', async () => {
        const result = await openImageDialog({
            dialogModule: {
                showOpenDialog: vi.fn().mockResolvedValue({
                    canceled: true,
                    filePaths: [],
                }),
            },
        });

        expect(result).toEqual({ canceled: true });
    });

    it('rechaza extensiones no soportadas', async () => {
        const result = await openImageDialog({
            dialogModule: {
                showOpenDialog: vi.fn().mockResolvedValue({
                    canceled: false,
                    filePaths: ['/tmp/firma.svg'],
                }),
            },
            fsModule: {
                stat: vi.fn(),
                readFile: vi.fn(),
            },
        });

        expect(result.error).toMatch(/Formato de imagen no soportado/);
    });

    it('rechaza imágenes que superan el tamaño máximo', async () => {
        const result = await openImageDialog({
            dialogModule: {
                showOpenDialog: vi.fn().mockResolvedValue({
                    canceled: false,
                    filePaths: ['/tmp/firma.png'],
                }),
            },
            fsModule: {
                stat: vi.fn().mockResolvedValue({ size: MAX_IMAGE_FILE_SIZE_BYTES + 1 }),
                readFile: vi.fn(),
            },
        });

        expect(result.error).toMatch(/supera el límite/);
    });

    it('convierte una imagen válida a data URL', async () => {
        const result = await openImageDialog({
            dialogModule: {
                showOpenDialog: vi.fn().mockResolvedValue({
                    canceled: false,
                    filePaths: ['/tmp/firma.png'],
                }),
            },
            fsModule: {
                stat: vi.fn().mockResolvedValue({ size: 128 }),
                readFile: vi.fn().mockResolvedValue(Buffer.from('firma')),
            },
        });

        expect(result).toEqual({
            canceled: false,
            fileName: 'firma.png',
            mimeType: 'image/png',
            dataUrl: `data:image/png;base64,${Buffer.from('firma').toString('base64')}`,
        });
    });
});
