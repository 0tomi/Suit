import { describe, expect, it, vi } from 'vitest';
import { FALLBACK_FONTS, listSystemFonts, sanitizeFontFamilies } from '../../electron/systemFonts.cjs';

describe('systemFonts', () => {
    it('normaliza comillas, deduplica y ordena familias', () => {
        expect(sanitizeFontFamilies(['"Arial"', 'Verdana', 'Arial', '  "Courier New"  '])).toEqual([
            'Arial',
            'Courier New',
            'Verdana',
        ]);
    });

    it('usa fallback cuando la enumeración falla', async () => {
        const result = await listSystemFonts({
            fontListModule: {
                getFonts: vi.fn().mockRejectedValue(new Error('boom')),
            },
            forceRefresh: true,
        });

        expect(result).toEqual(FALLBACK_FONTS);
    });

    it('usa font-list cuando responde correctamente', async () => {
        const result = await listSystemFonts({
            fontListModule: {
                getFonts: vi.fn().mockResolvedValue(['"Verdana"', 'Arial', 'Arial']),
            },
            forceRefresh: true,
        });

        expect(result).toEqual(['Arial', 'Verdana']);
    });
});
