/**
 * marginsUtils.js — Utilidades de márgenes de página.
 *
 * Separado de MarginsModal.jsx para cumplir la regla de react-refresh:
 * los archivos que exportan componentes React no pueden también exportar
 * constantes o funciones utilitarias (rompe Fast Refresh).
 */

import { DEFAULT_PAGE_FORMAT, getPageFormatConfig } from './pageLayoutUtils.js';

/** Factor de conversión entre unidades de margen. */
export const MARGIN_UNIT_FACTORS = {
    pt: { pt: 1,          mm: 25.4 / 72,  cm: 2.54 / 72  },
    mm: { pt: 72 / 25.4,  mm: 1,          cm: 0.1        },
    cm: { pt: 72 / 2.54,  mm: 10,         cm: 1          },
};

/** Convierte un valor entre unidades de margen preservando la medida física. */
export function convertMarginValue(value, fromUnit, toUnit) {
    if (fromUnit === toUnit || !value) return value;
    const converted = value * MARGIN_UNIT_FACTORS[fromUnit][toUnit];
    if (toUnit === 'pt') return Math.round(converted);
    if (toUnit === 'mm') return Math.round(converted * 10) / 10;
    return Math.round(converted * 100) / 100; // cm
}

/** Precisión de paso para inputs según la unidad. */
export const UNIT_STEP = { pt: 1, mm: 0.5, cm: 0.05 };

/** Etiqueta legible de cada unidad. */
export const UNIT_LABELS = { pt: 'Puntos (pt)', mm: 'Milímetros (mm)', cm: 'Centímetros (cm)' };

/**
 * Preset de márgenes estándar para escritos judiciales en Argentina (PJN / acordadas).
 * Interior amplio (4 cm) para encuadernación, espejado para impresión a doble cara.
 */
export const ARG_JUDICIAL_PRESET = { top: 3, bottom: 2.5, left: 4, right: 2.5, unit: 'cm', mirrored: true };

/** Márgenes por defecto: 1 pulgada en todos los lados (72 pt), sin espejado. */
export const DEFAULT_MARGINS = { top: 72, bottom: 72, left: 72, right: 72, unit: 'pt', mirrored: false, pageFormat: DEFAULT_PAGE_FORMAT };

/** Normaliza un objeto de márgenes legado para que siempre tenga la forma actual. */
export function normalizeMargins(margins) {
    return {
        ...DEFAULT_MARGINS,
        ...(margins || {}),
        pageFormat: margins?.pageFormat || DEFAULT_PAGE_FORMAT,
    };
}

/** Convierte un valor de margen a px para posicionamiento visual sobre el lienzo/reglas (96dpi). */
export function marginToPx(value, unit) {
    if (unit === 'mm') return Math.round(value * 96 / 25.4);
    if (unit === 'cm') return Math.round(value * 96 / 2.54);
    return Math.round(value * 96 / 72);
}

/** Convierte px del lienzo/regla a la unidad configurada del margen. */
export function pxToMargin(px, unit) {
    const pt = px * 72 / 96;
    if (unit === 'mm') return Math.round(pt * 25.4 / 72 * 10) / 10;
    if (unit === 'cm') return Math.round(pt * 2.54 / 72 * 100) / 100;
    return Math.round(pt);
}

/**
 * Devuelve los márgenes visibles para la página actual.
 * En modo espejado, la página par invierte interior/exterior.
 */
export function getVisualPageMargins(margins, previewSide = 'odd') {
    const source = normalizeMargins(margins);
    const isEvenMirroredPage = source.mirrored && previewSide === 'even';

    return {
        ...source,
        left: isEvenMirroredPage ? source.right : source.left,
        right: isEvenMirroredPage ? source.left : source.right,
    };
}

/**
 * Persiste un cambio horizontal hecho sobre la página visible.
 * Si la vista actual es una página par espejada, izquierda/derecha se invierten
 * respecto del dato persistido interior/exterior.
 */
export function setVisualHorizontalMargin(margins, side, value, previewSide = 'odd') {
    const source = normalizeMargins(margins);
    const isEvenMirroredPage = source.mirrored && previewSide === 'even';
    const targetField = isEvenMirroredPage
        ? (side === 'left' ? 'right' : 'left')
        : side;

    return { ...source, [targetField]: value };
}

/** Devuelve el tamaño en px de la hoja configurada para el editor actual. */
export function getPagePixelSize(margins) {
    const source = normalizeMargins(margins);
    const config = getPageFormatConfig(source.pageFormat);

    return { widthPx: config.widthPx, heightPx: config.heightPx };
}

/** Construye el CSS de impresión real para el formato y márgenes configurados. */
export function buildPrintPageCss(margins) {
    const source = normalizeMargins(margins);
    const config = getPageFormatConfig(source.pageFormat);
    const { top, right, bottom, left, unit, mirrored } = source;

    if (mirrored) {
        return `
            @page {
                size: ${config.pdfPageSize};
                margin-top: ${top}${unit};
                margin-bottom: ${bottom}${unit};
            }

            @page :right {
                margin-left: ${left}${unit};
                margin-right: ${right}${unit};
            }

            @page :left {
                margin-left: ${right}${unit};
                margin-right: ${left}${unit};
            }
        `;
    }

    return `
        @page {
            size: ${config.pdfPageSize};
            margin: ${top}${unit} ${right}${unit} ${bottom}${unit} ${left}${unit};
        }
    `;
}

/** Clave de localStorage para guardar la preferencia de márgenes por usuario. */
export const marginsStorageKey = (userId) => `suit-template-margins:${userId}`;

/** Guarda la preferencia de márgenes en localStorage. */
export function saveMarginPreference(userId, margins) {
    try {
        localStorage.setItem(marginsStorageKey(userId), JSON.stringify(margins));
    } catch { /* ignora errores de cuota */ }
}

/** Carga la preferencia de márgenes guardada, o null si no existe. */
export function loadMarginPreference(userId) {
    try {
        const raw = localStorage.getItem(marginsStorageKey(userId));
        return raw ? normalizeMargins(JSON.parse(raw)) : null;
    } catch { return null; }
}
