/**
 * templateEditorUtils.js — Helpers de pre/post-procesado HTML para el editor de plantillas.
 *
 * El backend almacena los placeholders como #1#, #2#, etc.
 * El editor TipTap los representa internamente como nodos <span data-field-id="n">.
 * Este módulo convierte entre ambas representaciones.
 */
import { getRequisitoLabel } from '../../constants/requisitoLabels.js';

/**
 * Convierte el HTML con placeholders #n# al formato que entiende TipTap.
 * Si se proveen los requirements existentes (al editar una plantilla),
 * también inyecta los datos de asignación (requisito_id, title) en cada nodo.
 *
 * @param {string} htmlBody - HTML con placeholders #1#, #2#, etc.
 * @param {Array}  requirements - Lista de { id_campo, requisito_id, type, title } (opcional)
 * @returns {string} HTML con <span data-field-id="n" ...> en lugar de #n#
 */
export function injectPlaceholderNodes(htmlBody, requirements = []) {
    if (!htmlBody) return '';

    // Construir mapa id_campo → requisito para búsqueda O(1)
    const reqMap = new Map(
        requirements.map((r) => [r.id_campo, r])
    );

    return htmlBody.replace(/#(\d+)#/g, (_, n) => {
        const fieldId = parseInt(n, 10);
        const req = reqMap.get(fieldId);

        const requisitoId = req?.requisito_id ?? '';
        const requisitoTitle = req?.title ?? '';
        const NEntidad = req?.NEntidad ?? 1;
        const note = req?.note ?? '';

        return (
            `<span` +
            ` data-field-id="${fieldId}"` +
            ` data-requisito-id="${requisitoId}"` +
            ` data-requisito-title="${requisitoTitle}"` +
            ` data-nentidad="${NEntidad}"` +
            ` data-note="${note}"` +
            ` class="template-placeholder">` +
            `</span>`
        );
    });
}

/**
 * Extrae del editor TipTap:
 *  - El HTML "limpio" con #n# restaurados (para enviar al backend)
 *  - El array de requirements asignados [{ id_campo, id_requisito }]
 *
 * Solo se incluyen en requirements los campos que tengan requisito asignado.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @returns {{ html: string, requirements: Array<{id_campo: number, id_requisito: number}> }}
 */
export function extractTemplateData(editor) {
    const requirements = [];

    // Recorrer el árbol JSON para recolectar assignments
    const json = editor.getJSON();

    function walkNode(node) {
        if (node.type === 'templatePlaceholder') {
            if (node.attrs?.requisitoId) {
                requirements.push({
                    id_campo: node.attrs.fieldId,
                    id_requisito: node.attrs.requisitoId,
                    NEntidad: node.attrs.NEntidad ?? 1,
                    note: node.attrs.note ?? null,
                });
            }
        }
        if (node.content) {
            node.content.forEach(walkNode);
        }
    }
    walkNode(json);

    // Obtener HTML serializado y restaurar #n# en lugar de los spans
    const rawHtml = editor.getHTML();
    const html = rawHtml.replace(
        /<span[^>]*data-field-id="(\d+)"[^>]*>[\s\S]*?<\/span>/g,
        (_, n) => `#${n}#`
    );

    return { html, requirements };
}

/**
 * Genera el HTML de vista previa de una plantilla.
 * Reemplaza los placeholders #n# por burbujas grises de "Requisito" para
 * indicar visualmente los campos sin completar, sin requerir una instancia TipTap.
 *
 * Los estilos van inline para que el HTML sea auto-contenido al inyectarlo con
 * dangerouslySetInnerHTML sin depender de clases CSS externas.
 *
 * @param {string} content - HTML de la plantilla con placeholders #n#
 * @returns {string} HTML listo para renderizar en vista previa
 */
/**
 * Burbuja inline para usar en buildPreviewHtml.
 * Estilos inline para ser auto-contenida al inyectar con dangerouslySetInnerHTML.
 */
function buildPreviewBubbleStyle(extraStyles = []) {
    return [
        'display:inline',
        'padding:2px 10px',
        'border-radius:10px',
        'line-height:1.8',
        'vertical-align:baseline',
        'white-space:normal',
        'overflow-wrap:break-word',
        'word-break:normal',
        'box-decoration-break:clone',
        '-webkit-box-decoration-break:clone',
        'user-select:none',
        ...extraStyles,
    ].join(';');
}

const PREVIEW_ALLOWED_TAGS = new Set([
    'p', 'div', 'br',
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
    'strong', 'b', 'em', 'i', 'u',
    'ul', 'ol', 'li',
    'table', 'thead', 'tbody', 'tr', 'td', 'th',
    'span',
    'blockquote',
    'pre',
]);

const PREVIEW_REMOVED_TAGS = new Set([
    'img', 'iframe', 'video', 'audio', 'canvas', 'svg', 'style', 'script',
]);

const PREVIEW_TEXT_NODES = { element: 1, text: 3 };

/** Construye la burbuja neutra usada en la galería de plantillas. */
function buildNeutralPreviewBubble(previewDocument) {
    const bubble = previewDocument.createElement('span');
    bubble.setAttribute('style', buildPreviewBubbleStyle([
        'background:var(--bg-input)',
        'border:1px solid var(--border-subtle)',
        'color:var(--text-secondary)',
        'font-size:0.75rem',
        'font-weight:500',
        'margin:0 2px',
    ]));
    bubble.textContent = 'Requisito';
    return bubble;
}

function createPreviewDocument() {
    return document.implementation.createHTMLDocument('template-preview');
}

/** Parsea el HTML original a un documento aislado para poder recorrerlo con DOM. */
function parsePreviewSourceHtml(content) {
    return new DOMParser().parseFromString(content, 'text/html');
}

/** Convierte el atributo style en un mapa simple para filtrar solo reglas útiles de lectura. */
function parseInlineStyles(styleText = '') {
    return styleText
        .split(';')
        .map((declaration) => declaration.trim())
        .filter(Boolean)
        .reduce((styles, declaration) => {
            const colonIndex = declaration.indexOf(':');
            if (colonIndex === -1) return styles;

            const property = declaration.slice(0, colonIndex).trim().toLowerCase();
            const value = declaration.slice(colonIndex + 1).trim();
            if (!property || !value) return styles;

            styles[property] = value;
            return styles;
        }, {});
}

function normalizePreviewFontSize(value) {
    const match = value.match(/^(\d+(?:\.\d+)?)(px|pt|rem|em)$/i);
    if (!match) return null;

    const numericValue = Number(match[1]);
    const unit = match[2].toLowerCase();
    if (!Number.isFinite(numericValue)) return null;

    if (unit === 'px') {
        const clamped = Math.min(36, Math.max(11, numericValue));
        return `${clamped}px`;
    }

    if (unit === 'pt') {
        const clamped = Math.min(27, Math.max(8, numericValue));
        return `${clamped}pt`;
    }

    if (unit === 'rem' || unit === 'em') {
        const clamped = Math.min(2.25, Math.max(0.7, numericValue));
        return `${clamped}${unit}`;
    }

    return null;
}

/** Mantiene line-heights razonables para la preview y descarta valores extravagantes de Word. */
function normalizePreviewLineHeight(value) {
    const numericMatch = value.match(/^(\d+(?:\.\d+)?)$/);
    if (numericMatch) {
        const clamped = Math.min(2.4, Math.max(1.1, Number(numericMatch[1])));
        return String(clamped);
    }

    const sizedMatch = value.match(/^(\d+(?:\.\d+)?)(px|rem|em)$/i);
    if (!sizedMatch) return null;

    const numericValue = Number(sizedMatch[1]);
    const unit = sizedMatch[2].toLowerCase();
    if (!Number.isFinite(numericValue)) return null;

    if (unit === 'px') {
        const clamped = Math.min(40, Math.max(12, numericValue));
        return `${clamped}px`;
    }

    const clamped = Math.min(2.5, Math.max(0.9, numericValue));
    return `${clamped}${unit}`;
}

/** Solo se respetan alineaciones textuales compatibles con la preview de lectura. */
function normalizePreviewTextAlign(value) {
    if (!['left', 'right', 'center', 'justify'].includes(value)) return null;
    return value;
}

/** Define el espaciado base por etiqueta para que la preview conserve estructura visual. */
function getPreviewDefaultStyles(tagName) {
    switch (tagName) {
    case 'div':
    case 'p':
        return ['margin:0 0 1rem 0'];
    case 'h1':
        return ['margin:0 0 1rem 0', 'font-size:1.75rem', 'font-weight:700', 'line-height:1.3'];
    case 'h2':
        return ['margin:0 0 0.9rem 0', 'font-size:1.5rem', 'font-weight:700', 'line-height:1.35'];
    case 'h3':
        return ['margin:0 0 0.85rem 0', 'font-size:1.3rem', 'font-weight:700', 'line-height:1.4'];
    case 'h4':
        return ['margin:0 0 0.8rem 0', 'font-size:1.15rem', 'font-weight:700', 'line-height:1.45'];
    case 'h5':
    case 'h6':
        return ['margin:0 0 0.75rem 0', 'font-size:1rem', 'font-weight:700', 'line-height:1.45'];
    case 'ul':
    case 'ol':
        return ['margin:0 0 1rem 0', 'padding-left:1.5rem'];
    case 'li':
        return ['margin:0 0 0.35rem 0'];
    case 'table':
        return ['margin:0 0 1rem 0', 'width:100%', 'border-collapse:collapse', 'table-layout:fixed'];
    case 'th':
        return [
            'border:1px solid var(--border-subtle)',
            'padding:0.5rem 0.65rem',
            'vertical-align:top',
            'text-align:left',
            'font-weight:600',
        ];
    case 'td':
        return [
            'border:1px solid var(--border-subtle)',
            'padding:0.5rem 0.65rem',
            'vertical-align:top',
        ];
    case 'blockquote':
        return [
            'margin:0 0 1rem 0',
            'padding-left:1rem',
            'border-left:3px solid var(--border-subtle)',
            'color:var(--text-secondary)',
        ];
    case 'pre':
        return [
            'margin:0 0 1rem 0',
            'white-space:pre-wrap',
            'word-break:break-word',
            'font-family:inherit',
        ];
    default:
        return [];
    }
}

/** Mezcla estilos base con una whitelist mínima de tipografía proveniente del HTML fuente. */
function getPreviewNormalizedStyles(element, tagName) {
    const inlineStyles = parseInlineStyles(element.getAttribute('style') || '');
    const styles = [...getPreviewDefaultStyles(tagName)];

    const normalizedFontSize = inlineStyles['font-size']
        ? normalizePreviewFontSize(inlineStyles['font-size'])
        : null;
    if (normalizedFontSize) styles.push(`font-size:${normalizedFontSize}`);

    const normalizedLineHeight = inlineStyles['line-height']
        ? normalizePreviewLineHeight(inlineStyles['line-height'])
        : null;
    if (normalizedLineHeight) styles.push(`line-height:${normalizedLineHeight}`);

    const fontWeight = inlineStyles['font-weight'];
    if (fontWeight && /^(normal|bold|[1-9]00)$/i.test(fontWeight)) {
        styles.push(`font-weight:${fontWeight}`);
    }

    const fontStyle = inlineStyles['font-style'];
    if (fontStyle && /^(normal|italic|oblique)$/i.test(fontStyle)) {
        styles.push(`font-style:${fontStyle}`);
    }

    const textDecoration = inlineStyles['text-decoration'];
    if (textDecoration && /^(none|underline|line-through|underline line-through|line-through underline)$/i.test(textDecoration)) {
        styles.push(`text-decoration:${textDecoration}`);
    }

    const textAlign = normalizePreviewTextAlign(inlineStyles['text-align'] || element.getAttribute('align') || '');
    if (textAlign) styles.push(`text-align:${textAlign}`);

    return styles.join(';');
}

/** Reemplaza placeholders dentro de nodos de texto sin destruir la estructura del HTML. */
function buildPreviewTextNodes(text, previewDocument, renderPlaceholder) {
    const fragment = previewDocument.createDocumentFragment();
    const parts = text.split(/(#\d+#)/g);

    parts.forEach((part) => {
        const match = part.match(/^#(\d+)#$/);
        if (match) {
            fragment.append(renderPlaceholder(match[1], previewDocument));
            return;
        }

        if (part) {
            fragment.append(previewDocument.createTextNode(part));
        }
    });

    return fragment;
}

/** Normaliza un nodo del HTML fuente y elimina elementos no textuales o inseguros. */
function normalizePreviewNode(node, previewDocument, renderPlaceholder) {
    if (node.nodeType === PREVIEW_TEXT_NODES.text) {
        return buildPreviewTextNodes(node.textContent || '', previewDocument, renderPlaceholder);
    }

    if (node.nodeType !== PREVIEW_TEXT_NODES.element) return null;

    const tagName = node.tagName.toLowerCase();
    if (PREVIEW_REMOVED_TAGS.has(tagName)) return null;

    if (!PREVIEW_ALLOWED_TAGS.has(tagName)) {
        const fragment = previewDocument.createDocumentFragment();
        node.childNodes.forEach((childNode) => {
            const normalizedChild = normalizePreviewNode(childNode, previewDocument, renderPlaceholder);
            if (normalizedChild) fragment.append(normalizedChild);
        });
        return fragment;
    }

    const normalizedNode = previewDocument.createElement(tagName);
    const normalizedStyles = getPreviewNormalizedStyles(node, tagName);
    if (normalizedStyles) {
        normalizedNode.setAttribute('style', normalizedStyles);
    }

    node.childNodes.forEach((childNode) => {
        const normalizedChild = normalizePreviewNode(childNode, previewDocument, renderPlaceholder);
        if (normalizedChild) normalizedNode.append(normalizedChild);
    });

    return normalizedNode;
}

/** Genera una preview HTML controlada que preserva estructura textual y placeholders dinámicos. */
function buildNormalizedPreviewHtml(content, renderPlaceholder) {
    if (!content) return '';

    const parsedDocument = parsePreviewSourceHtml(content);
    const previewDocument = createPreviewDocument();
    const root = previewDocument.createElement('div');
    root.setAttribute(
        'style',
        [
            'color:var(--text-primary)',
            'font-family:inherit',
            'font-size:0.95rem',
            'line-height:1.7',
            'word-break:break-word',
            'overflow-wrap:anywhere',
        ].join(';')
    );

    parsedDocument.body.childNodes.forEach((node) => {
        const normalizedNode = normalizePreviewNode(node, previewDocument, renderPlaceholder);
        if (normalizedNode) root.append(normalizedNode);
    });

    return root.outerHTML;
}

/**
 * Genera el HTML de vista previa de una plantilla en modo "texto plano".
 * Extrae el texto de cada nodo del HTML (sin etiquetas), une los párrafos
 * con saltos de línea y reemplaza los placeholders #n# por burbujas grises.
 *
 * No se usa DOMParser para no depender de window en entornos de test;
 * en su lugar se parsea con regex: suficiente para el HTML simple que
 * produce TipTap (p, h1-h4, ul/li, strong, em — sin HTML arbitrario).
 *
 * @param {string} content - HTML de la plantilla con placeholders #n#
 * @returns {string} HTML listo para renderizar en vista previa
 */
export function buildPreviewHtml(content) {
    return buildNormalizedPreviewHtml(content, (_, previewDocument) => buildNeutralPreviewBubble(previewDocument));
}

/**
 * Devuelve la "familia" de un tipo de requisito para agrupar el foco en la preview.
 * Se usa para determinar qué burbujas resaltar cuando el usuario enfoca un componente.
 */
function getReqFamily(type) {
    if (type.startsWith('client')) return 'client';
    if (type.startsWith('user')) return 'user';
    if (['caseTitle','caseNumber','caseStartDate','caseEndDate'].includes(type)) return 'case';
    if (['caseType','caseExpedientType','radicacion','jurisdiccion','competencia','dependencia'].includes(type)) return 'caseSubEntities';
    if (type.startsWith('parte')) return 'parte';
    if (type.startsWith('event')) return 'event';
    if (['anioNombrado','mesNombrado','diaNombrado','anioNumero','mesNumero','diaNumero','fechaConMesNombrado'].includes(type)) return 'dateParts';
    if (['text','number','date','dateTime'].includes(type)) return 'general';
    if (['amount','paymentType','montoNombrado'].includes(type)) return 'financial';
    if (['city','province','address'].includes(type)) return 'location';
    return 'other';
}

/**
 * Genera el HTML de vista previa "inteligente" para UseTemplateModal.
 * A diferencia de buildPreviewHtml, esta versión:
 *  - Usa colores dinámicos (Amarillo: vacío, Verde: completo, Azul: enfocado).
 *  - Muestra el nombre del requisito real (ej: "Nombre del Cliente") en lugar de "Requisito".
 *  - Resalta solo los campos de la entidad actualmente editada (familia + NEntidad).
 *
 * @param {string} content      - HTML original con #n#
 * @param {Array}  requirements - Lista de requisitos [{id_campo, type, title, NEntidad}]
 * @param {Object} values       - Valores por id_campo: { [String(id_campo)]: string }
 * @param {Object|null} activeInfo - { family: string, nEntidad: number } | null
 * @param {Object} labelOverrides - Labels opcionales por id_campo para casos específicos de UI.
 * @returns {string} HTML renderizado con burbujas dinámicas
 */
export function buildEnhancedPreviewHtml(content, requirements = [], values = {}, activeInfo = null, labelOverrides = {}) {
    if (!content) return '';

    // 1. Mapa de id_campo (#n#) a metadata del requisito
    const reqMap = new Map(requirements.map(r => [String(r.id_campo), r]));

    return buildNormalizedPreviewHtml(content, (fieldId, previewDocument) => {
        const req = reqMap.get(fieldId);

        // Valores indexados por id_campo (string)
        const value = values[fieldId];
        const hasValue = value != null && value !== '' && value !== false;

        // Azul (Enfocado) > completado con subrayado > Amarillo (Vacío)
        // Un campo está enfocado si su familia Y su NEntidad coinciden con activeInfo.
        const isFocused = req && activeInfo
            && getReqFamily(req.type) === activeInfo.family
            && (req.NEntidad ?? 1) === activeInfo.nEntidad;

        let bgColor = '#fef3c7'; // amber-100 (Vacío)
        let textColor = '#92400e';
        let borderColor = '#f59e0b';
        let extraStyles = '';

        if (isFocused) {
            bgColor = '#3b82f6';
            textColor = '#ffffff';
            borderColor = '#2563eb';
            extraStyles = 'box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.4); z-index: 10;';
        } else if (hasValue) {
            bgColor = 'rgba(219, 234, 254, 0.5)';
            textColor = 'var(--text-primary)';

            if (req) {
                if (req.type.startsWith('client'))                                          borderColor = 'rgba(37, 99, 235, 0.4)';
                else if (req.type.startsWith('user'))                                       borderColor = 'rgba(147, 51, 234, 0.4)';
                else if (req.type.startsWith('case') || ['caseType','caseExpedientType','radicacion','jurisdiccion','competencia','dependencia'].includes(req.type))
                                                                                            borderColor = 'rgba(234, 88, 12, 0.4)';
                else if (req.type.startsWith('parte'))                                      borderColor = 'rgba(219, 39, 119, 0.4)';
                else if (req.type.startsWith('event'))                                      borderColor = 'rgba(8, 145, 178, 0.4)';
                else if (['text','number','date','dateTime'].includes(req.type))            borderColor = 'rgba(79, 70, 229, 0.4)';
                else if (['amount','paymentType','montoNombrado'].includes(req.type))       borderColor = 'rgba(225, 29, 72, 0.4)';
                else if (['city','province','address'].includes(req.type))                  borderColor = 'rgba(13, 148, 136, 0.4)';
                else if (['anioNombrado','mesNombrado','diaNombrado','anioNumero','mesNumero','diaNumero','fechaConMesNombrado'].includes(req.type))
                                                                                            borderColor = 'rgba(15, 118, 110, 0.4)';
                else borderColor = 'rgba(217, 119, 6, 0.4)';
            } else {
                borderColor = 'rgba(34, 197, 94, 0.4)';
            }

            // Valor completado: subrayado sutil, sin fondo
            extraStyles = 'background: transparent; border: none; border-bottom: 2px solid ' + borderColor + '; border-radius: 0; padding: 0 2px; font-weight: 500; font-size: inherit;';
        }

        // Mostrar el valor real si disponible, si no el label del tipo
        const label = (hasValue && typeof value === 'string')
            ? value
            : (labelOverrides[fieldId] || (req ? getRequisitoLabel(req.type) : 'Requisito'));

        const bubble = previewDocument.createElement('span');
        bubble.setAttribute('style', buildPreviewBubbleStyle([
            'background:' + bgColor,
            'border:1px solid ' + borderColor,
            'color:' + textColor,
            'font-size:0.75rem',
            'font-weight:600',
            'margin:2px 4px',
            'transition:all 0.2s ease',
            extraStyles,
        ]));
        bubble.textContent = label;
        return bubble;
    });
}

/**
 * Cuenta cuántos fieldIds tienen requisito asignado en el JSON del editor.
 * Retorna { assigned, total } para poder calcular si todos los campos están cubiertos.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @returns {{ assigned: number, total: number }}
 */
export function countAssignedFields(editor) {
    if (!editor) return { assigned: 0, total: 0 };

    const json = editor.getJSON();
    let total = 0;
    let assigned = 0;

    function walk(node) {
        if (node.type === 'templatePlaceholder') {
            total++;
            if (node.attrs?.requisitoId) assigned++;
        }
        node.content?.forEach(walk);
    }
    walk(json);

    return { assigned, total };
}

/**
 * Calcula el siguiente fieldId libre dado el estado actual del editor.
 * Útil para insertar un nuevo campo en modo edición.
 *
 * @param {import('@tiptap/core').Editor} editor
 * @returns {number}
 */
export function getNextFieldId(editor) {
    const json = editor.getJSON();
    let maxId = 0;

    function walkNode(node) {
        if (node.type === 'templatePlaceholder' && node.attrs?.fieldId) {
            maxId = Math.max(maxId, node.attrs.fieldId);
        }
        if (node.content) {
            node.content.forEach(walkNode);
        }
    }
    walkNode(json);

    return maxId + 1;
}
