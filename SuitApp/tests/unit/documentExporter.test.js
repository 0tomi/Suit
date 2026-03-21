import { describe, expect, it, vi } from 'vitest';
import {
    buildPdfExportHtml,
    normalizePdfFontFamily,
    buildSuggestedPdfFilename,
    exportDocumentToPdf,
} from '../../electron/documentExporter.cjs';

describe('documentExporter', () => {
    it('genera un nombre de archivo PDF saneado', () => {
        expect(buildSuggestedPdfFilename('Contrato Laboral 2026!!')).toBe('contrato-laboral-2026.pdf');
    });

    it('construye el HTML de exportación conservando el contenido del documento', () => {
        const html = buildPdfExportHtml({
            title: 'Contrato',
            html: '<p>Contenido exportable</p>',
        });

        expect(html).toContain('<title>Contrato</title>');
        expect(html).toContain('<p>Contenido exportable</p>');
    });

    it('usa la familia tipográfica enviada desde renderer para exportar el PDF', () => {
        const html = buildPdfExportHtml({
            title: 'Contrato',
            html: '<p>Contenido exportable</p>',
            fontFamily: '"Aptos", "Segoe UI", sans-serif',
        });

        expect(html).toContain('font-family: "Aptos", "Segoe UI", sans-serif;');
    });

    it('normaliza una fuente por defecto cuando renderer no envía ninguna', () => {
        expect(normalizePdfFontFamily()).toContain('"Inter"');
    });

    it('incluye la regla de impresión para nodos de salto de página', () => {
        const html = buildPdfExportHtml({
            title: 'Contrato',
            html: '<div data-page-break="true"><span>Salto de pagina</span></div>',
        });

        expect(html).toContain('[data-page-break="true"]');
        expect(html).toContain('break-before: page;');
        expect(html).toContain('[data-page-break="true"] > span');
    });

    it('retorna cancelación si el usuario cierra el diálogo de guardado', async () => {
        const browserWindowFactory = vi.fn();

        const result = await exportDocumentToPdf({
            dialogModule: {
                showSaveDialog: vi.fn().mockResolvedValue({
                    canceled: true,
                    filePath: null,
                }),
            },
            browserWindowFactory,
            title: 'Contrato',
            html: '<p>Contenido</p>',
        });

        expect(result).toEqual({ canceled: true });
        expect(browserWindowFactory).not.toHaveBeenCalled();
    });

    it('genera y escribe el PDF usando una ventana oculta', async () => {
        const destroy = vi.fn();
        const printWindow = {
            loadURL: vi.fn().mockResolvedValue(undefined),
            webContents: {
                printToPDF: vi.fn().mockResolvedValue(Buffer.from('pdf')),
            },
            isDestroyed: vi.fn().mockReturnValue(false),
            destroy,
        };

        const result = await exportDocumentToPdf({
            dialogModule: {
                showSaveDialog: vi.fn().mockResolvedValue({
                    canceled: false,
                    filePath: '/tmp/contrato.pdf',
                }),
            },
            browserWindowFactory: vi.fn().mockReturnValue(printWindow),
            fsModule: {
                writeFile: vi.fn().mockResolvedValue(undefined),
            },
            title: 'Contrato',
            html: '<p>Contenido</p>',
        });

        expect(result).toEqual({
            canceled: false,
            filePath: '/tmp/contrato.pdf',
        });
        expect(printWindow.loadURL).toHaveBeenCalledOnce();
        expect(printWindow.webContents.printToPDF).toHaveBeenCalledOnce();
        expect(destroy).toHaveBeenCalledOnce();
    });
});
