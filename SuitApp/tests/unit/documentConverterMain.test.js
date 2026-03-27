import { describe, expect, it } from 'vitest';
import {
    buildSemanticPdfHtml,
    groupTextItemsIntoLines,
    normalizePdfFontFamily,
} from '../../electron/documentConverter.cjs';

describe('documentConverter main process', () => {
    it('normaliza familias PDF a nombres utilizables en Windows', () => {
        const availableFonts = ['Arial', 'Courier New', 'Times New Roman'];

        expect(normalizePdfFontFamily('TACTGM+NimbusRomNo9L-Medi', availableFonts)).toBe('Times New Roman');
        expect(normalizePdfFontFamily('Helvetica-Bold', availableFonts)).toBe('Arial');
        expect(normalizePdfFontFamily('CourierNewPSMT', availableFonts)).toBe('Courier New');
    });

    it('agrupa items de texto cercanos en una misma línea', () => {
        const lines = groupTextItemsIntoLines([
            {
                pageNumber: 1,
                text: 'Hola',
                x: 80,
                top: 100,
                width: 30,
                height: 12,
                right: 110,
                bottom: 112,
                fontSize: 12,
                fontFamily: 'Arial',
                isBold: false,
                isItalic: false,
            },
            {
                pageNumber: 1,
                text: 'mundo',
                x: 120,
                top: 101,
                width: 45,
                height: 12,
                right: 165,
                bottom: 113,
                fontSize: 12,
                fontFamily: 'Arial',
                isBold: false,
                isItalic: false,
            },
            {
                pageNumber: 1,
                text: 'Otra línea',
                x: 80,
                top: 132,
                width: 70,
                height: 12,
                right: 150,
                bottom: 144,
                fontSize: 12,
                fontFamily: 'Arial',
                isBold: false,
                isItalic: false,
            },
        ]);

        expect(lines).toHaveLength(2);
        expect(lines[0].items).toHaveLength(2);
        expect(lines[1].items).toHaveLength(1);
    });

    it('reconstruye el orden por columnas sin intercalar contenido', () => {
        const result = buildSemanticPdfHtml([
            {
                number: 1,
                widthPt: 612,
                heightPt: 792,
                items: [
                    {
                        pageNumber: 1,
                        text: 'Titulo principal',
                        x: 170,
                        top: 72,
                        width: 220,
                        height: 20,
                        right: 390,
                        bottom: 92,
                        fontSize: 20,
                        fontFamily: 'Arial',
                        isBold: true,
                        isItalic: false,
                    },
                    {
                        pageNumber: 1,
                        text: 'Columna izquierda linea 1',
                        x: 72,
                        top: 180,
                        width: 180,
                        height: 12,
                        right: 252,
                        bottom: 192,
                        fontSize: 12,
                        fontFamily: 'Times New Roman',
                        isBold: false,
                        isItalic: false,
                    },
                    {
                        pageNumber: 1,
                        text: 'Columna izquierda linea 2',
                        x: 72,
                        top: 196,
                        width: 180,
                        height: 12,
                        right: 252,
                        bottom: 208,
                        fontSize: 12,
                        fontFamily: 'Times New Roman',
                        isBold: false,
                        isItalic: false,
                    },
                    {
                        pageNumber: 1,
                        text: 'Columna derecha linea 1',
                        x: 332,
                        top: 182,
                        width: 180,
                        height: 12,
                        right: 512,
                        bottom: 194,
                        fontSize: 12,
                        fontFamily: 'Times New Roman',
                        isBold: false,
                        isItalic: false,
                    },
                    {
                        pageNumber: 1,
                        text: 'Columna derecha linea 2',
                        x: 332,
                        top: 198,
                        width: 180,
                        height: 12,
                        right: 512,
                        bottom: 210,
                        fontSize: 12,
                        fontFamily: 'Times New Roman',
                        isBold: false,
                        isItalic: false,
                    },
                ],
            },
        ]);

        expect(result.html).toContain('<h1');
        expect(result.margins).toEqual({
            top: 180,
            bottom: 582,
            left: 72,
            right: 100,
            unit: 'pt',
            mirrored: false,
        });

        const leftIndex = result.html.indexOf('Columna izquierda linea 1');
        const rightIndex = result.html.indexOf('Columna derecha linea 1');
        expect(leftIndex).toBeGreaterThan(-1);
        expect(rightIndex).toBeGreaterThan(-1);
        expect(leftIndex).toBeLessThan(rightIndex);
        expect(result.defaultFont).toBe('Times New Roman');
    });
});
