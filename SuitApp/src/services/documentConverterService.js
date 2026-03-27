/**
 * documentConverterService.js — Wrapper renderer para la conversión DOCX/PDF → HTML.
 *
 * Delega al proceso principal via IPC (documents:convertToHtml).
 * Solo acepta archivos con ruta absoluta del sistema de archivos local.
 *
 * Formatos soportados: .docx, .pdf
 * Limitaciones:
 *   - DOCX: preserva estructura básica (títulos, párrafos, tablas, listas).
 *           Imágenes embebidas y layouts complejos pueden perderse.
 *   - PDF:  extrae texto digital. PDFs escaneados o conversiones fallidas
 *           deben devolverse como `ok: false` y no abrir el editor.
 */

const CONVERSION_ERROR_MARKERS = [
    'error al convertir pdf:',
    'no se pudo convertir el pdf:',
    'error interno al leer la conversión del pdf.',
    'archivo no encontrado:',
    'formato no soportado:',
];

function stripHtml(html) {
    return String(html || '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizeConversionResult(rawResult) {
    if (!rawResult || rawResult.ok !== true) {
        return {
            ok: false,
            error: rawResult?.error || 'No se pudo convertir el documento.',
            warnings: rawResult?.warnings ?? [],
        };
    }

    const html = typeof rawResult.html === 'string' ? rawResult.html.trim() : '';
    if (!html) {
        return {
            ok: false,
            error: 'La conversión no devolvió contenido utilizable.',
            warnings: rawResult.warnings ?? [],
        };
    }

    const plainText = stripHtml(html).toLowerCase();
    const looksLikePureErrorDocument = plainText.length > 0
        && plainText.length <= 300
        && CONVERSION_ERROR_MARKERS.some((marker) => plainText.startsWith(marker));

    if (looksLikePureErrorDocument) {
        return {
            ok: false,
            error: stripHtml(html),
            warnings: rawResult.warnings ?? [],
        };
    }

    return {
        ...rawResult,
        ok: true,
        html,
        warnings: rawResult.warnings ?? [],
    };
}

/**
 * Convierte un archivo DOCX o PDF a HTML.
 *
 * @param {string} filePath       - Ruta absoluta al archivo local
 * @returns {Promise<{ok: boolean, html?: string, warnings?: string[], placeholderCount?: number, error?: string}>}
 */
export async function convertDocumentToHtml(filePath) {
    const result = await window.electronAPI.documents.convertToHtml(filePath);
    return normalizeConversionResult(result);
}

/**
 * Convierte un archivo DOCX o PDF a HTML para usarlo como plantilla.
 * Reemplaza todas las ocurrencias de `keyword` en el texto por placeholders
 * numéricos secuenciales: #1#, #2#, ..., #n#.
 *
 * El frontend luego presenta al usuario una interfaz para asignar un
 * requisito (type) a cada placeholder numerado antes de guardar la plantilla.
 *
 * @param {string} filePath  - Ruta absoluta al archivo local
 * @param {string} keyword   - Palabra clave que marca los campos a reemplazar (ej: "BLANCO")
 * @returns {Promise<{ok: boolean, html?: string, warnings?: string[], placeholderCount?: number, error?: string}>}
 *   - placeholderCount: cantidad de #n# generados (= ocurrencias encontradas de keyword)
 */
export async function convertDocumentToTemplate(filePath, keyword) {
    const result = await window.electronAPI.documents.convertToHtml(filePath, keyword);
    return normalizeConversionResult(result);
}
