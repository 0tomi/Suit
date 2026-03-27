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

const PREVIEW_BUBBLE = (() => {
    const style = buildPreviewBubbleStyle([
        'background:#f3f4f6',
        'border:1px solid #d1d5db',
        'color:#6b7280',
        'font-size:0.75rem',
        'font-weight:500',
        'margin:0 2px',
    ]);
    return `<span style="${style}">Requisito</span>`;
})();

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
    if (!content) return '';

    // 1. Normalizar bloques como párrafos → añadir salto de línea tras el cierre
    const withBreaks = content
        .replace(/<\/(p|h[1-6]|li|div|tr)>/gi, '</$1>\n')
        .replace(/<br\s*\/?>/gi, '\n');

    // 2. Extraer solo el texto (quitar todas las etiquetas HTML)
    const plainText = withBreaks.replace(/<[^>]+>/g, '');

    // 3. Decodificar entidades HTML básicas
    const decoded = plainText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');

    // 4. Reemplazar #n# por burbujas; escapar el resto para evitar XSS
    const parts = decoded.split(/(#\d+#)/g);
    const rendered = parts.map((part) =>
        /^#\d+#$/.test(part) ? PREVIEW_BUBBLE : escapeHtmlPreview(part)
    ).join('');

    // 5. Envolver en un <pre> con word-wrap para respetar los saltos de línea
    return `<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;margin:0;">${rendered}</pre>`;
}

/** Escapa caracteres HTML en texto plano para evitar XSS. */
function escapeHtmlPreview(text) {
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
}

/**
 * Devuelve la "familia" de un tipo de requisito para agrupar el foco en la preview.
 * Se usa para determinar qué burbujas resaltar cuando el usuario enfoca un componente.
 */
function getReqFamily(type) {
    if (type.startsWith('client')) return 'client';
    if (type.startsWith('user')) return 'user';
    if (['caseTitle','caseNumber','caseStartDate','caseEndDate'].includes(type)) return 'case';
    if (['caseType','radicacion','jurisdiccion','competencia','dependencia'].includes(type)) return 'caseSubEntities';
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

    // 2. Normalizar bloques y extraer texto (igual que buildPreviewHtml)
    const withBreaks = content
        .replace(/<\/(p|h[1-6]|li|div|tr)>/gi, '</$1>\n')
        .replace(/<br\s*\/?>/gi, '\n');
    const plainText = withBreaks.replace(/<[^>]+>/g, '');
    const decoded = plainText
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#039;/g, "'")
        .replace(/&nbsp;/g, ' ');

    // 3. Procesar por partes
    const parts = decoded.split(/(#\d+#)/g);
    const rendered = parts.map((part) => {
        const match = part.match(/^#(\d+)#$/);
        if (!match) return escapeHtmlPreview(part);

        const fieldId = match[1];
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
            textColor = '#1e293b';

            if (req) {
                if (req.type.startsWith('client'))                                          borderColor = 'rgba(37, 99, 235, 0.4)';
                else if (req.type.startsWith('user'))                                       borderColor = 'rgba(147, 51, 234, 0.4)';
                else if (req.type.startsWith('case') || ['caseType','radicacion','jurisdiccion','competencia','dependencia'].includes(req.type))
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

        const style = buildPreviewBubbleStyle([
            'background:' + bgColor,
            'border:1px solid ' + borderColor,
            'color:' + textColor,
            'font-size:0.75rem',
            'font-weight:600',
            'margin:2px 4px',
            'transition:all 0.2s ease',
            extraStyles,
        ]);

        return `<span style="${style}">${label}</span>`;
    }).join('');

    return `<pre style="white-space:pre-wrap;word-break:break-word;font-family:inherit;margin:0;line-height:1.8;">${rendered}</pre>`;
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
