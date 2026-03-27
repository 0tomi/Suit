import { beforeEach, describe, expect, it, vi } from 'vitest';
import { convertDocumentToHtml, convertDocumentToTemplate } from '../../src/services/documentConverterService.js';

describe('documentConverterService', () => {
    beforeEach(() => {
        window.electronAPI.documents.convertToHtml = vi.fn();
    });

    it('devuelve ok false cuando Electron responde un error explícito', async () => {
        window.electronAPI.documents.convertToHtml.mockResolvedValue({
            ok: false,
            error: 'Este PDF no contiene texto digital extraíble.',
        });

        await expect(convertDocumentToHtml('/tmp/test.pdf')).resolves.toEqual({
            ok: false,
            error: 'Este PDF no contiene texto digital extraíble.',
            warnings: [],
        });
    });

    it('rechaza HTML de error aunque venga marcado como ok true', async () => {
        window.electronAPI.documents.convertToHtml.mockResolvedValue({
            ok: true,
            html: '<p>Error al convertir PDF: salida inválida</p>',
            warnings: ['falló la reconstrucción del PDF'],
        });

        await expect(convertDocumentToHtml('/tmp/test.pdf')).resolves.toEqual({
            ok: false,
            error: 'Error al convertir PDF: salida inválida',
            warnings: ['falló la reconstrucción del PDF'],
        });
    });

    it('preserva la conversión válida para documentos nuevos', async () => {
        window.electronAPI.documents.convertToHtml.mockResolvedValue({
            ok: true,
            html: '<p>Contenido importado</p>',
            margins: { top: 72, bottom: 72, left: 72, right: 72, unit: 'pt', mirrored: false },
            defaultFont: 'Arial',
            warnings: ['salto de línea ajustado'],
        });

        await expect(convertDocumentToHtml('/tmp/test.docx')).resolves.toEqual({
            ok: true,
            html: '<p>Contenido importado</p>',
            margins: { top: 72, bottom: 72, left: 72, right: 72, unit: 'pt', mirrored: false },
            defaultFont: 'Arial',
            warnings: ['salto de línea ajustado'],
        });
    });

    it('normaliza también el flujo de plantillas importadas', async () => {
        window.electronAPI.documents.convertToHtml.mockResolvedValue({
            ok: true,
            html: '<p>No se pudo convertir el PDF: contenido corrupto</p>',
        });

        await expect(convertDocumentToTemplate('/tmp/test.pdf', 'CAMPO')).resolves.toEqual({
            ok: false,
            error: 'No se pudo convertir el PDF: contenido corrupto',
            warnings: [],
        });
    });
});
