/** Presets de hoja soportados por el editor y la exportación PDF. */
export const PAGE_FORMATS = {
    A4: { label: 'A4', widthPx: 794, heightPx: 1123, pdfPageSize: 'A4' },
    A3: { label: 'A3', widthPx: 1123, heightPx: 1588, pdfPageSize: 'A3' },
    LETTER: { label: 'Carta', widthPx: 816, heightPx: 1056, pdfPageSize: 'Letter' },
    LEGAL: { label: 'Oficio', widthPx: 816, heightPx: 1344, pdfPageSize: 'Legal' },
};

export const DEFAULT_PAGE_FORMAT = 'A4';
export const PAGE_GAP_PX = 28;

export function getPageFormatConfig(pageFormat = DEFAULT_PAGE_FORMAT) {
    return PAGE_FORMATS[pageFormat] || PAGE_FORMATS[DEFAULT_PAGE_FORMAT];
}
