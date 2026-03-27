/**
 * numToWordsES.js — Conversión de números a palabras en español.
 *
 * Soporta el rango necesario para documentos legales:
 *   - Días (1–31): "uno", "veinticinco", "treinta y uno"
 *   - Meses (1–12): nombres directos vía MONTH_NAMES_ES
 *   - Años (ej: 2026): "dos mil veintiséis"
 *   - Montos hasta 999.999.999: "cinco millones quinientos mil"
 *
 * Nota: usa "uno" (no "un") para todos los enteros individuales.
 * Para montos que exigen "un millón" en vez de "uno millón",
 * el llamador debe ajustar el sufijo "millón/millones" con la lógica especial.
 */

const UNITS = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
const TEENS = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
const TENS  = ['', '', 'veinte', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
// Centenas: índice 1 = "ciento" (para 101–199); para exactamente 100 se trata aparte.
const HUNDREDS = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

/** Nombres de los meses en español (índice 1 = enero). */
export const MONTH_NAMES_ES = [
    '', 'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];

/** Convierte n (0–99) a palabras. */
function below100(n) {
    if (n === 0)  return '';
    if (n < 10)   return UNITS[n];
    if (n < 20)   return TEENS[n - 10];
    // 20–29: formas compuestas invariables ("veintiuno", "veintidós", etc.)
    if (n < 30) {
        const veintis = [
            'veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro',
            'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve',
        ];
        return veintis[n - 20];
    }
    const t = Math.floor(n / 10);
    const u = n % 10;
    return u === 0 ? TENS[t] : `${TENS[t]} y ${UNITS[u]}`;
}

/** Convierte n (0–999) a palabras. */
function below1000(n) {
    if (n === 0)   return '';
    if (n < 100)   return below100(n);
    const h   = Math.floor(n / 100);
    const rem = n % 100;
    // 100 exacto → "cien"; 101–199 → "ciento X"; 200–999 → "doscientos X"
    if (n === 100) return 'cien';
    const prefix = HUNDREDS[h];
    return rem === 0 ? prefix : `${prefix} ${below100(rem)}`;
}

/**
 * Convierte un entero no negativo a su representación en palabras en español.
 * Rango soportado: 0 a 999.999.999.
 *
 * @param {number} n - Número entero (se ignora la parte decimal).
 * @returns {string}
 */
export function numToWordsES(n) {
    n = Math.floor(Math.abs(n));
    if (n === 0) return 'cero';

    const parts = [];

    if (n >= 1_000_000) {
        const m = Math.floor(n / 1_000_000);
        // "un millón" para 1; "X millones" para el resto
        parts.push(m === 1 ? 'un millón' : `${below1000(m)} millones`);
        n %= 1_000_000;
    }

    if (n >= 1_000) {
        const t = Math.floor(n / 1_000);
        // "mil" para 1.000; "X mil" para el resto
        parts.push(t === 1 ? 'mil' : `${below1000(t)} mil`);
        n %= 1_000;
    }

    const r = below1000(n);
    if (r) parts.push(r);

    return parts.join(' ');
}
