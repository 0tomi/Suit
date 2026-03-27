import { describe, it, expect } from 'vitest';
import {
    getVisualPageMargins,
    setVisualHorizontalMargin,
    pxToMargin,
    marginToPx,
    buildPrintPageCss,
} from '../../src/components/Editor/marginsUtils.js';

describe('marginsUtils', () => {
    it('mantiene los márgenes en páginas impares y espeja interior/exterior en páginas pares', () => {
        const margins = { top: 3, bottom: 2.5, left: 4, right: 2.5, unit: 'cm', mirrored: true };

        expect(getVisualPageMargins(margins, 'odd')).toMatchObject({ left: 4, right: 2.5 });
        expect(getVisualPageMargins(margins, 'even')).toMatchObject({ left: 2.5, right: 4 });
    });

    it('persiste el drag horizontal sobre el campo correcto cuando la vista espejada está en página par', () => {
        const margins = { top: 3, bottom: 2.5, left: 4, right: 2.5, unit: 'cm', mirrored: true };

        const updatedLeft = setVisualHorizontalMargin(margins, 'left', 3.1, 'even');
        const updatedRight = setVisualHorizontalMargin(margins, 'right', 4.2, 'even');

        expect(updatedLeft.right).toBe(3.1);
        expect(updatedLeft.left).toBe(4);
        expect(updatedRight.left).toBe(4.2);
        expect(updatedRight.right).toBe(2.5);
    });

    it('convierte px a unidad configurada y viceversa sin perder la medida base', () => {
        const px = marginToPx(2.5, 'cm');
        const roundTrip = pxToMargin(px, 'cm');

        expect(roundTrip).toBeCloseTo(2.5, 1);
    });

    it('genera CSS de impresión espejado con páginas left/right', () => {
        const css = buildPrintPageCss({ top: 3, bottom: 2.5, left: 4, right: 2.5, unit: 'cm', mirrored: true, pageFormat: 'A4' });

        expect(css).toContain('@page :right');
        expect(css).toContain('@page :left');
        expect(css).toContain('size: A4;');
        expect(css).toContain('margin-left: 4cm;');
        expect(css).toContain('margin-right: 2.5cm;');
    });
});
