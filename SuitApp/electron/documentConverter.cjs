/**
 * documentConverter.cjs — Conversión de documentos DOCX y PDF a HTML.
 *
 * Se ejecuta en el proceso principal de Electron (acceso a Node.js / fs).
 * El renderer invoca estas funciones via IPC: documents:convertToHtml
 *
 * Importante:
 *   - La conversión DOCX con mammoth NO se toca. Mantiene el pipeline actual.
 *   - La conversión PDF usa pdfjs-dist para reconstruir HTML editable sin
 *     depender de binarios externos.
 */

const path = require('path');
const fs = require('fs');
const { getLogger } = require('./logService.cjs');
const { listSystemFonts } = require('./systemFonts.cjs');

const logger = getLogger('document-converter');

const PDF_HEADING_H1_RATIO = 1.55;
const PDF_HEADING_H2_RATIO = 1.22;
const PDF_INDENT_STEP_PT = 24;
const PDF_MAX_INDENT_LEVEL = 5;
const PDF_COLUMN_SPLIT_THRESHOLD = 96;
const PDF_FONT_FALLBACKS = {
    serif: 'Times New Roman',
    'sans-serif': 'Arial',
    monospace: 'Courier New',
};

let pdfJsPromise = null;

// ─── Utilidades DOCX ──────────────────────────────────────────────────────────

/**
 * Extrae los márgenes de página de un ZIP de DOCX ya cargado.
 * Lee word/document.xml y parsea las etiquetas w:pgMar.
 * Retorna el objeto de márgenes en pt o null si no se encuentran.
 *
 * @param {JSZip} zip       - Instancia de JSZip ya cargada
 * @param {string} filePath - Solo para logging
 */
async function extractMarginsFromZip(zip, filePath) {
    const docFile = zip.file('word/document.xml');
    if (!docFile) {
        logger.warn('No se encontró word/document.xml en el DOCX', { filePath });
        return null;
    }

    const docXml = await docFile.async('text');

    const pgMarMatches = docXml.match(/<w:pgMar\s+([^>]+?)\s*\/?>/gs);
    if (!pgMarMatches || pgMarMatches.length === 0) {
        logger.info('No se encontró etiqueta w:pgMar en el DOCX', { filePath });
        return null;
    }

    const lastPgMarTag = pgMarMatches[pgMarMatches.length - 1];

    const extractAttr = (tag, attr) => {
        const m = tag.match(new RegExp(`w:${attr}=["']([^"']+)["']`));
        return m ? parseInt(m[1], 10) : null;
    };

    const rawMargins = {
        top: extractAttr(lastPgMarTag, 'top'),
        bottom: extractAttr(lastPgMarTag, 'bottom'),
        left: extractAttr(lastPgMarTag, 'left'),
        right: extractAttr(lastPgMarTag, 'right'),
    };

    if (rawMargins.top === null && rawMargins.left === null) {
        logger.warn('Etiqueta w:pgMar encontrada pero sin atributos válidos', { filePath, lastPgMarTag });
        return null;
    }

    const margins = {
        top: rawMargins.top !== null ? rawMargins.top / 20 : 36,
        bottom: rawMargins.bottom !== null ? rawMargins.bottom / 20 : 36,
        left: rawMargins.left !== null ? rawMargins.left / 20 : 36,
        right: rawMargins.right !== null ? rawMargins.right / 20 : 36,
        unit: 'pt',
        mirrored: false,
    };

    logger.info('Márgenes extraídos exitosamente', { filePath, margins, foundCount: pgMarMatches.length });
    return margins;
}

/**
 * Extrae la fuente por defecto de un ZIP de DOCX ya cargado.
 * Busca en word/styles.xml, primero en <w:docDefaults> y luego en el estilo Normal.
 * Ignora referencias de tema (minorHAnsi, majorLatn, etc.) ya que no son nombres reales.
 * Retorna el nombre de la fuente (string) o null.
 *
 * @param {JSZip} zip       - Instancia de JSZip ya cargada
 * @param {string} filePath - Solo para logging
 */
async function extractFontFromZip(zip, filePath) {
    const stylesFile = zip.file('word/styles.xml');
    if (!stylesFile) return null;

    const stylesXml = await stylesFile.async('text');

    const extractAsciiFont = (fragment) => {
        const m = fragment.match(/w:ascii=["']([^"']+)["']/);
        if (!m) return null;
        const name = m[1];
        if (/^(minor|major)/i.test(name)) return null;
        return name;
    };

    const docDefaultsMatch = stylesXml.match(/<w:docDefaults>[\s\S]*?<\/w:docDefaults>/);
    if (docDefaultsMatch) {
        const rFontsMatch = docDefaultsMatch[0].match(/<w:rFonts[^/]*/);
        if (rFontsMatch) {
            const font = extractAsciiFont(rFontsMatch[0]);
            if (font) {
                logger.info('Fuente extraída de docDefaults', { filePath, font });
                return font;
            }
        }
    }

    const normalMatch = stylesXml.match(/<w:style\s[^>]*w:styleId=["']Normal["'][^>]*>[\s\S]*?<\/w:style>/);
    if (normalMatch) {
        const rFontsMatch = normalMatch[0].match(/<w:rFonts[^/]*/);
        if (rFontsMatch) {
            const font = extractAsciiFont(rFontsMatch[0]);
            if (font) {
                logger.info('Fuente extraída del estilo Normal', { filePath, font });
                return font;
            }
        }
    }

    logger.info('No se encontró fuente por defecto en el DOCX', { filePath });
    return null;
}

/**
 * Abre el DOCX como ZIP y extrae márgenes + fuente en paralelo.
 * Evita abrir el archivo dos veces al reutilizar la misma instancia de JSZip.
 * Retorna { margins, defaultFont }.
 *
 * @param {string} filePath - Ruta absoluta al archivo .docx
 */
async function extractDocxMetadata(filePath) {
    try {
        const JSZip = require('jszip');
        const data = fs.readFileSync(filePath);
        const zip = await JSZip.loadAsync(data);

        const [margins, defaultFont] = await Promise.all([
            extractMarginsFromZip(zip, filePath),
            extractFontFromZip(zip, filePath),
        ]);

        return { margins, defaultFont };
    } catch (err) {
        logger.error('Error al extraer metadatos DOCX', { filePath, err: err?.message });
        return { margins: null, defaultFont: null };
    }
}

/**
 * Convierte un archivo DOCX a HTML usando mammoth.
 * Preserva: títulos, párrafos, listas, tablas, negrita/cursiva.
 * Descarta: imágenes embebidas, columnas, posicionamiento preciso.
 *
 * @param {string} filePath  - Ruta absoluta al archivo .docx
 * @returns {Promise<{html: string, warnings: string[]}>}
 */
async function convertDocxToHtml(filePath) {
    const mammoth = require('mammoth');
    const result = await mammoth.convertToHtml({ path: filePath });

    const warnings = result.messages
        .filter((message) => message.type === 'warning')
        .map((message) => message.message);

    if (warnings.length > 0) {
        logger.warn('mammoth warnings', { filePath, count: warnings.length });
    }

    return { html: result.value, warnings };
}

// ─── Utilidades PDF ───────────────────────────────────────────────────────────

function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}

function roundPt(value) {
    return Math.max(0, Math.round(Number(value) || 0));
}

function escapeHtml(text) {
    return String(text || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;');
}

function stripQuotes(value) {
    return String(value || '').replace(/^["']+|["']+$/g, '').trim();
}

function escapeAttribute(value) {
    return String(value)
        .replace(/&/g, '&amp;')
        .replace(/"/g, '&quot;');
}

function buildStyleAttribute(styleMap) {
    const entries = Object.entries(styleMap).filter(([, value]) => value != null && value !== '');
    if (entries.length === 0) return '';
    return ` style="${entries.map(([key, value]) => `${key}:${value}`).join(';')}"`;
}

function loadPdfJs() {
    if (!pdfJsPromise) {
        pdfJsPromise = import('pdfjs-dist/legacy/build/pdf.mjs');
    }
    return pdfJsPromise;
}

function normalizeWhitespace(text) {
    return String(text || '')
        .replace(/\u00a0/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function normalizePdfFontFamily(rawFontName, availableFonts = []) {
    const stripped = stripQuotes(rawFontName).replace(/^[A-Z]{6}\+/, '');
    if (!stripped) return null;

    const lower = stripped.toLowerCase();
    const directCandidates = [
        stripped,
        stripped.replace(/[-_]/g, ' '),
        stripped.split('-')[0],
        stripped.split(',')[0],
    ].map((value) => stripQuotes(value)).filter(Boolean);

    const mappingCandidates = [];
    if (/aptos/.test(lower)) mappingCandidates.push('Aptos');
    if (/calibri/.test(lower)) mappingCandidates.push('Calibri');
    if (/cambria/.test(lower)) mappingCandidates.push('Cambria');
    if (/georgia/.test(lower)) mappingCandidates.push('Georgia');
    if (/verdana/.test(lower)) mappingCandidates.push('Verdana');
    if (/tahoma/.test(lower)) mappingCandidates.push('Tahoma');
    if (/times|nimbusrom|garamond|baskerville|serif/.test(lower)) mappingCandidates.push('Times New Roman');
    if (/arial|helvetica|nimbussan|segoeui|sans/.test(lower)) mappingCandidates.push('Arial');
    if (/courier|nimbusmono|cmtt|consolas|monospace/.test(lower)) mappingCandidates.push('Courier New');

    const uniqueCandidates = Array.from(new Set([...directCandidates, ...mappingCandidates]));
    for (const candidate of uniqueCandidates) {
        if (availableFonts.includes(candidate)) {
            return candidate;
        }
    }

    if (/times|nimbusrom|garamond|baskerville|serif/.test(lower)) return PDF_FONT_FALLBACKS.serif;
    if (/courier|nimbusmono|cmtt|consolas|monospace/.test(lower)) return PDF_FONT_FALLBACKS.monospace;
    if (/arial|helvetica|nimbussan|segoeui|sans|calibri|aptos/.test(lower)) return PDF_FONT_FALLBACKS['sans-serif'];

    return directCandidates[0] || null;
}

function resolvePdfFontInfo(page, fontName, style, availableFonts) {
    let rawFontName = style?.fontFamily || '';
    let fallbackName = style?.fontFamily || '';

    try {
        const fontObject = page.commonObjs.get(fontName);
        rawFontName = fontObject?.name || rawFontName;
        fallbackName = fontObject?.fallbackName || fallbackName;
    } catch {
        // noop: pdf.js no garantiza que la fuente esté resuelta en todos los casos
    }

    const candidateName = rawFontName || fallbackName;
    const normalizedFamily = normalizePdfFontFamily(candidateName, availableFonts);
    const loweredName = `${rawFontName} ${fallbackName}`.toLowerCase();

    return {
        rawName: rawFontName,
        family: normalizedFamily || null,
        isBold: /bold|black|heavy|demi|medi/.test(loweredName),
        isItalic: /italic|oblique|slant/.test(loweredName),
    };
}

function buildPdfTextItems({ page, pageNumber, availableFonts, textContent, viewport }) {
    const items = [];

    for (const item of textContent.items || []) {
        const text = normalizeWhitespace(item.str);
        if (!text) continue;

        const transform = Array.isArray(item.transform) ? item.transform : [0, 0, 0, 0, 0, 0];
        const x = Number(transform[4]) || 0;
        const baselineY = Number(transform[5]) || 0;
        const height = Math.max(Math.abs(Number(item.height) || 0), Math.abs(Number(transform[3]) || 0), 1);
        const width = Math.max(Number(item.width) || 0, 1);
        const top = viewport.height - baselineY - height;
        const style = textContent.styles?.[item.fontName] || {};
        const fontInfo = resolvePdfFontInfo(page, item.fontName, style, availableFonts);

        items.push({
            pageNumber,
            text,
            x,
            top,
            width,
            height,
            right: x + width,
            bottom: top + height,
            fontSize: height,
            fontFamily: fontInfo.family,
            rawFontName: fontInfo.rawName,
            isBold: fontInfo.isBold,
            isItalic: fontInfo.isItalic,
            hasEOL: Boolean(item.hasEOL),
        });
    }

    return items;
}

function groupTextItemsIntoLines(items) {
    const sorted = [...items].sort((left, right) => (
        left.pageNumber - right.pageNumber
        || left.top - right.top
        || left.x - right.x
    ));

    const lines = [];

    for (const item of sorted) {
        const lastLine = lines.at(-1);
        const threshold = Math.max(2, item.height * 0.45);
        const matchesLastLine = lastLine
            && lastLine.pageNumber === item.pageNumber
            && Math.abs(lastLine.baselineTop - item.top) <= threshold;

        if (matchesLastLine) {
            lastLine.items.push(item);
            lastLine.baselineTop = Math.min(lastLine.baselineTop, item.top);
            continue;
        }

        lines.push({
            pageNumber: item.pageNumber,
            items: [item],
            baselineTop: item.top,
        });
    }

    return lines.map((line) => {
        const sortedItems = [...line.items].sort((left, right) => left.x - right.x);
        const left = Math.min(...sortedItems.map((item) => item.x));
        const right = Math.max(...sortedItems.map((item) => item.right));
        const top = Math.min(...sortedItems.map((item) => item.top));
        const bottom = Math.max(...sortedItems.map((item) => item.bottom));
        const dominantFontSize = Math.max(...sortedItems.map((item) => item.fontSize));
        const fontFamilies = sortedItems
            .map((item) => item.fontFamily)
            .filter(Boolean);

        return {
            pageNumber: line.pageNumber,
            items: sortedItems,
            left,
            right,
            top,
            bottom,
            width: right - left,
            height: bottom - top,
            fontSize: dominantFontSize,
            fontFamily: fontFamilies[0] || null,
            isBold: sortedItems.some((item) => item.isBold),
            isItalic: sortedItems.some((item) => item.isItalic),
        };
    });
}

function determineGapSeparator(previousItem, currentItem) {
    if (!previousItem) return '';

    const previousText = previousItem.text || '';
    const currentText = currentItem.text || '';
    const gap = currentItem.x - previousItem.right;
    const averageGlyphWidth = previousText.length > 0
        ? previousItem.width / Math.max(previousText.length, 1)
        : 4;

    if (previousText.endsWith(' ') || currentText.startsWith(' ')) return '';
    if (/^[,.;:!?)]/.test(currentText)) return '';
    if (/[(]$/.test(previousText)) return '';

    return gap > Math.max(averageGlyphWidth * 0.35, 2) ? ' ' : '';
}

function wrapInlineText(item, text) {
    let content = escapeHtml(text);
    if (item.isBold) content = `<strong>${content}</strong>`;
    if (item.isItalic) content = `<em>${content}</em>`;

    const style = {};
    if (item.fontFamily && !item.fontFamily.startsWith('Times New Roman')) {
        style['font-family'] = escapeAttribute(`"${item.fontFamily}"`);
    }

    if (item.fontSize > 0) {
        style['font-size'] = `${Math.round(item.fontSize)}pt`;
    }

    const styleAttribute = buildStyleAttribute(style);
    if (!styleAttribute) return content;
    return `<span${styleAttribute}>${content}</span>`;
}

function buildInlineHtml(items) {
    const htmlParts = [];
    let previousItem = null;

    for (const item of items) {
        const separator = determineGapSeparator(previousItem, item);
        const wrappedText = wrapInlineText(item, item.text);
        if (separator) htmlParts.push(escapeHtml(separator));
        htmlParts.push(wrappedText);
        previousItem = item;
    }

    return htmlParts.join('');
}

function detectColumnLayout(lines, pageWidth) {
    const candidates = lines
        .filter((line) => line.width > pageWidth * 0.18)
        .map((line) => line.left);

    if (candidates.length < 8) {
        return null;
    }

    let centerA = Math.min(...candidates);
    let centerB = Math.max(...candidates);

    for (let iteration = 0; iteration < 8; iteration += 1) {
        const clusterA = [];
        const clusterB = [];

        for (const value of candidates) {
            if (Math.abs(value - centerA) <= Math.abs(value - centerB)) clusterA.push(value);
            else clusterB.push(value);
        }

        if (clusterA.length === 0 || clusterB.length === 0) {
            return null;
        }

        centerA = clusterA.reduce((sum, value) => sum + value, 0) / clusterA.length;
        centerB = clusterB.reduce((sum, value) => sum + value, 0) / clusterB.length;
    }

    const leftCenter = Math.min(centerA, centerB);
    const rightCenter = Math.max(centerA, centerB);

    if (rightCenter - leftCenter < PDF_COLUMN_SPLIT_THRESHOLD) {
        return null;
    }

    return { leftCenter, rightCenter };
}

function inferTextAlign(line, pageWidth) {
    const leftMargin = line.left;
    const rightMargin = pageWidth - line.right;
    const centerOffset = Math.abs((line.left + line.right) / 2 - pageWidth / 2);

    if (centerOffset < 24 && line.width < pageWidth * 0.8) {
        return 'center';
    }

    if (leftMargin > 96 && rightMargin < 48) {
        return 'right';
    }

    return 'left';
}

function classifyLine(line, bodyFontSize, pageWidth) {
    const align = inferTextAlign(line, pageWidth);

    if (line.fontSize >= bodyFontSize * PDF_HEADING_H1_RATIO) {
        return { tag: 'h1', textAlign: align };
    }

    if (line.fontSize >= bodyFontSize * PDF_HEADING_H2_RATIO || (line.isBold && line.width < pageWidth * 0.8)) {
        return { tag: 'h2', textAlign: align };
    }

    return { tag: 'p', textAlign: align };
}

function assignColumns(lines, pageWidth) {
    const layout = detectColumnLayout(lines, pageWidth);
    if (!layout) {
        return lines.map((line) => ({ ...line, columnIndex: 0, columnBaseLeft: Math.min(...lines.map((entry) => entry.left)) }));
    }

    const fullWidthThreshold = pageWidth * 0.62;
    const leftBase = lines
        .filter((line) => line.left < layout.rightCenter && line.width < fullWidthThreshold)
        .reduce((acc, line) => Math.min(acc, line.left), Infinity);
    const rightBase = lines
        .filter((line) => line.left >= layout.rightCenter && line.width < fullWidthThreshold)
        .reduce((acc, line) => Math.min(acc, line.left), Infinity);

    return lines.map((line) => {
        if (line.width >= fullWidthThreshold && Math.abs((line.left + line.right) / 2 - pageWidth / 2) < 36) {
            return { ...line, columnIndex: -1, columnBaseLeft: line.left };
        }

        if (Math.abs(line.left - layout.leftCenter) <= Math.abs(line.left - layout.rightCenter)) {
            return { ...line, columnIndex: 0, columnBaseLeft: Number.isFinite(leftBase) ? leftBase : layout.leftCenter };
        }

        return { ...line, columnIndex: 1, columnBaseLeft: Number.isFinite(rightBase) ? rightBase : layout.rightCenter };
    });
}

function lineToBlock(line, bodyFontSize, pageWidth) {
    const { tag, textAlign } = classifyLine(line, bodyFontSize, pageWidth);
    const indentLevel = clamp(Math.round((line.left - line.columnBaseLeft) / PDF_INDENT_STEP_PT), 0, PDF_MAX_INDENT_LEVEL);

    return {
        pageNumber: line.pageNumber,
        columnIndex: line.columnIndex,
        tag,
        textAlign,
        fontSize: line.fontSize,
        top: line.top,
        bottom: line.bottom,
        left: line.left,
        right: line.right,
        width: line.width,
        height: line.height,
        indentLevel,
        html: buildInlineHtml(line.items),
        plainText: normalizeWhitespace(line.items.map((item) => item.text).join(' ')),
        fontFamily: line.fontFamily,
    };
}

function appendParagraphHtml(currentHtml, nextHtml) {
    const currentText = currentHtml.replace(/<[^>]+>/g, '');
    const nextText = nextHtml.replace(/<[^>]+>/g, '');

    if (/-$/.test(currentText) && /^[a-záéíóúñ]/.test(nextText)) {
        return `${currentHtml.slice(0, -1)}${nextHtml}`;
    }

    return `${currentHtml} ${nextHtml}`;
}

function mergeAdjacentParagraphBlocks(blocks) {
    const merged = [];

    for (const block of blocks) {
        const previous = merged.at(-1);
        if (
            previous
            && previous.pageNumber === block.pageNumber
            && previous.columnIndex === block.columnIndex
            && previous.tag === 'p'
            && block.tag === 'p'
            && previous.textAlign === block.textAlign
            && previous.indentLevel === block.indentLevel
            && block.top - previous.bottom <= Math.max(previous.height, block.height) * 1.35
        ) {
            previous.html = appendParagraphHtml(previous.html, block.html);
            previous.plainText = normalizeWhitespace(`${previous.plainText} ${block.plainText}`);
            previous.bottom = block.bottom;
            previous.right = Math.max(previous.right, block.right);
            previous.width = previous.right - previous.left;
            previous.height = previous.bottom - previous.top;
            continue;
        }

        merged.push({ ...block });
    }

    return merged;
}

function inferBodyFontSize(lines) {
    const counts = new Map();

    for (const line of lines) {
        const roundedSize = Math.round(line.fontSize);
        counts.set(roundedSize, (counts.get(roundedSize) || 0) + 1);
    }

    let bodyFontSize = 12;
    let maxCount = 0;
    for (const [size, count] of counts.entries()) {
        if (count > maxCount) {
            bodyFontSize = size;
            maxCount = count;
        }
    }

    return bodyFontSize;
}

function inferPageMargins(blocks, pageWidth, pageHeight) {
    const bodyBlocks = blocks.filter((block) => block.tag === 'p');
    const referenceBlocks = bodyBlocks.length > 0 ? bodyBlocks : blocks;

    if (referenceBlocks.length === 0) {
        return null;
    }

    const left = Math.min(...referenceBlocks.map((block) => block.left));
    const right = Math.min(...referenceBlocks.map((block) => Math.max(0, pageWidth - block.right)));
    const top = Math.min(...referenceBlocks.map((block) => block.top));
    const bottom = Math.min(...referenceBlocks.map((block) => Math.max(0, pageHeight - block.bottom)));

    return {
        top: roundPt(top),
        bottom: roundPt(bottom),
        left: roundPt(left),
        right: roundPt(right),
        unit: 'pt',
        mirrored: false,
    };
}

function mergeDocumentMargins(marginsList) {
    const validMargins = marginsList.filter(Boolean);
    if (validMargins.length === 0) return null;

    const average = (field) => roundPt(
        validMargins.reduce((sum, margins) => sum + (margins[field] || 0), 0) / validMargins.length
    );

    return {
        top: average('top'),
        bottom: average('bottom'),
        left: average('left'),
        right: average('right'),
        unit: 'pt',
        mirrored: false,
    };
}

function inferDefaultPdfFont(blocks, bodyFontSize) {
    const counts = new Map();

    for (const block of blocks) {
        if (block.tag !== 'p') continue;
        if (!block.fontFamily) continue;
        if (block.fontSize < Math.max(bodyFontSize - 1, 8) || block.fontSize > bodyFontSize + 2) continue;
        counts.set(block.fontFamily, (counts.get(block.fontFamily) || 0) + block.plainText.length);
    }

    let winner = null;
    let winnerScore = 0;
    for (const [fontFamily, score] of counts.entries()) {
        if (score > winnerScore) {
            winner = fontFamily;
            winnerScore = score;
        }
    }

    return winner;
}

function renderBlock(block, bodyFontSize) {
    const style = {};

    if (block.textAlign && block.textAlign !== 'left') {
        style['text-align'] = block.textAlign;
    }

    const openTag = [];
    openTag.push(`<${block.tag}`);
    if (block.indentLevel > 0) {
        openTag.push(` data-indent="${block.indentLevel}"`);
    }
    const styleAttribute = buildStyleAttribute(style);
    if (styleAttribute) {
        openTag.push(styleAttribute);
    }
    openTag.push('>');

    let html = block.html;
    if (block.tag === 'p' && Math.abs(block.fontSize - bodyFontSize) >= 2) {
        html = `<span style="font-size:${Math.round(block.fontSize)}pt">${html}</span>`;
    }

    return `${openTag.join('')}${html}</${block.tag}>`;
}

function buildSemanticPdfHtml(pages) {
    const htmlParts = [];
    const documentMargins = [];
    const blockFontSamples = [];

    for (const page of pages) {
        const lines = groupTextItemsIntoLines(page.items);
        if (lines.length === 0) continue;

        const bodyFontSize = inferBodyFontSize(lines);
        const linesWithColumns = assignColumns(lines, page.widthPt)
            .sort((left, right) => (
                left.columnIndex - right.columnIndex
                || left.top - right.top
                || left.left - right.left
            ));
        const blocks = mergeAdjacentParagraphBlocks(
            linesWithColumns.map((line) => lineToBlock(line, bodyFontSize, page.widthPt))
        );

        for (const block of blocks) {
            htmlParts.push(renderBlock(block, bodyFontSize));
        }

        documentMargins.push(inferPageMargins(blocks, page.widthPt, page.heightPt));
        blockFontSamples.push({ font: inferDefaultPdfFont(blocks, bodyFontSize), bodyFontSize });
    }

    const defaultFont = blockFontSamples.find((entry) => entry.font)?.font || null;
    return {
        html: htmlParts.join('\n'),
        margins: mergeDocumentMargins(documentMargins),
        defaultFont,
    };
}

async function convertPdfToHtml(filePath) {
    const pdfJs = await loadPdfJs();
    const data = new Uint8Array(fs.readFileSync(filePath));
    const loadingTask = pdfJs.getDocument({
        data,
        useWorkerFetch: false,
        isEvalSupported: false,
    });

    let pdfDocument;
    try {
        pdfDocument = await loadingTask.promise;
        const availableFonts = await listSystemFonts();
        const pages = [];

        for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
            const page = await pdfDocument.getPage(pageNumber);
            const viewport = page.getViewport({ scale: 1 });
            const textContent = await page.getTextContent();
            await page.getOperatorList();
            const items = buildPdfTextItems({ page, pageNumber, availableFonts, textContent, viewport });
            page.cleanup?.();

            if (items.length > 0) {
                pages.push({
                    number: pageNumber,
                    widthPt: viewport.width,
                    heightPt: viewport.height,
                    items,
                });
            }
        }

        if (pages.length === 0) {
            return {
                ok: false,
                error: 'Este PDF no contiene texto digital extraíble. Es posible que sea un documento escaneado. Procesalo con un software de OCR antes de importarlo.',
                warnings: ['El PDF no contiene texto digital extraíble.'],
            };
        }

        const result = buildSemanticPdfHtml(pages);
        if (!result.html.trim()) {
            return {
                ok: false,
                error: 'No se pudo reconstruir contenido utilizable desde el PDF.',
                warnings: ['El PDF fue leído, pero no se pudo reconstruir HTML utilizable.'],
            };
        }

        logger.info('PDF convertido con pdfjs-dist', {
            filePath,
            pages: pages.length,
            hasMargins: Boolean(result.margins),
            defaultFont: result.defaultFont,
        });

        return {
            ok: true,
            html: result.html,
            margins: result.margins,
            defaultFont: result.defaultFont,
            warnings: [],
        };
    } catch (err) {
        logger.error('error al convertir PDF con pdfjs-dist', { filePath, err: err?.message });
        return {
            ok: false,
            error: `No se pudo convertir el PDF: ${err?.message ?? 'error desconocido'}`,
            warnings: [],
        };
    } finally {
        pdfDocument?.cleanup?.();
        loadingTask?.destroy?.();
    }
}

// ─── Reemplazo de keyword por placeholders ────────────────────────────────────

function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function replaceKeywordWithPlaceholders(html, keyword) {
    if (!keyword || keyword.trim().length === 0) {
        return { html, placeholderCount: 0 };
    }

    let counter = 0;
    const pattern = new RegExp(escapeRegex(keyword.trim()), 'g');

    const processed = html.replace(/>([^<]*)</g, (match, textContent) => {
        if (!textContent.includes(keyword.trim())) return match;
        const replaced = textContent.replace(pattern, () => `#${++counter}#`);
        return `>${replaced}<`;
    });

    return { html: processed, placeholderCount: counter };
}

// ─── Función principal ────────────────────────────────────────────────────────

/**
 * Convierte un archivo DOCX o PDF a HTML.
 * Detecta el tipo de archivo por extensión.
 *
 * Si se provee `keyword`, reemplaza todas sus ocurrencias en el HTML resultante
 * por placeholders numéricos secuenciales (#1#, #2#, ..., #n#).
 *
 * @param {string} filePath   - Ruta absoluta al archivo
 * @param {string} [keyword]  - Palabra clave a reemplazar por #n# (opcional)
 * @returns {Promise<{ok: boolean, html?: string, margins?: object, warnings?: string[], placeholderCount?: number, error?: string, defaultFont?: string|null}>}
 */
async function convertToHtml(filePath, keyword) {
    if (!filePath || !fs.existsSync(filePath)) {
        return { ok: false, error: `Archivo no encontrado: ${filePath}` };
    }

    const ext = path.extname(filePath).toLowerCase();

    try {
        let html = '';
        let warnings = [];
        let margins = null;
        let defaultFont = null;

        if (ext === '.docx') {
            const [{ html: rawHtml, warnings: rawWarnings }, metadata] = await Promise.all([
                convertDocxToHtml(filePath),
                extractDocxMetadata(filePath),
            ]);
            html = rawHtml;
            warnings = rawWarnings;
            margins = metadata.margins;
            defaultFont = metadata.defaultFont;
        } else if (ext === '.pdf') {
            const pdfResult = await convertPdfToHtml(filePath);
            if (!pdfResult.ok) {
                return {
                    ok: false,
                    error: pdfResult.error,
                    warnings: pdfResult.warnings ?? [],
                };
            }

            html = pdfResult.html;
            warnings = pdfResult.warnings ?? [];
            margins = pdfResult.margins ?? null;
            defaultFont = pdfResult.defaultFont ?? null;
        } else {
            return { ok: false, error: `Formato no soportado: ${ext}. Solo se aceptan .docx y .pdf` };
        }

        if (keyword && keyword.trim().length > 0) {
            const { html: processedHtml, placeholderCount } = replaceKeywordWithPlaceholders(html, keyword);
            return { ok: true, html: processedHtml, margins, defaultFont, warnings, placeholderCount };
        }

        return { ok: true, html, margins, defaultFont, warnings, placeholderCount: 0 };
    } catch (err) {
        logger.error('error al convertir documento', { filePath, err: err?.message });
        return { ok: false, error: err?.message ?? 'Error desconocido al convertir' };
    }
}

module.exports = {
    convertToHtml,
    normalizePdfFontFamily,
    groupTextItemsIntoLines,
    buildSemanticPdfHtml,
};
