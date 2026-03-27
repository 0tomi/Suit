/**
 * Helpers para normalizar requisitos de plantillas.
 * Toleran pequeñas variaciones del payload entre API y caché local.
 */

function toIntOrNull(value) {
    if (value == null || value === '') return null;
    const parsed = Number(value);
    return Number.isInteger(parsed) ? parsed : null;
}

/**
 * Normaliza un requisito individual a un shape consistente.
 *
 * @param {object} raw
 * @returns {object|null}
 */
export function normalizeTemplateRequirement(raw) {
    if (!raw || typeof raw !== 'object') return null;

    const idCampo = toIntOrNull(raw.id_campo ?? raw.idCampo);
    if (idCampo == null) return null;

    const requisitoId = toIntOrNull(
        raw.requisito_id
        ?? raw.id_requisito
        ?? raw.requisitoId
        ?? raw.idRequisito
    );

    const nEntidad = toIntOrNull(
        raw.NEntidad
        ?? raw.nEntidad
        ?? raw.n_entidad
        ?? raw.nentidad
    ) ?? 1;

    return {
        id: toIntOrNull(raw.id),
        id_campo: idCampo,
        requisito_id: requisitoId,
        NEntidad: nEntidad,
        note: raw.note ?? null,
        type: raw.type ?? null,
        title: raw.title ?? null,
    };
}

/**
 * Normaliza un array de requisitos y descarta entradas inválidas.
 *
 * @param {Array} requirements
 * @returns {Array}
 */
export function normalizeTemplateRequirements(requirements = []) {
    if (!Array.isArray(requirements)) return [];

    return requirements
        .map(normalizeTemplateRequirement)
        .filter(Boolean);
}

function extractTemplatePlaceholderIds(content = '') {
    if (typeof content !== 'string' || content.length === 0) return [];

    const ids = new Set();
    for (const match of content.matchAll(/#(\d+)#/g)) {
        const parsed = toIntOrNull(match[1]);
        if (parsed != null) ids.add(parsed);
    }

    return [...ids].sort((left, right) => left - right);
}

/**
 * Genera un diagnóstico compacto del payload de requisitos para logging.
 * Señala entradas nulas/inválidas, campos críticos faltantes y placeholders
 * del contenido que no tienen requisito asociado.
 *
 * @param {Array} requirements
 * @param {string} content
 * @returns {object}
 */
export function getTemplateRequirementsDiagnostics(requirements = [], content = '') {
    const received = Array.isArray(requirements) ? requirements : [];
    const normalized = normalizeTemplateRequirements(received);
    const placeholderIds = extractTemplatePlaceholderIds(content);
    const normalizedIds = new Set(normalized.map((requirement) => requirement.id_campo));

    const problematicRequirements = received
        .map((raw, index) => {
            const normalizedRequirement = normalizeTemplateRequirement(raw);

            if (normalizedRequirement == null) {
                return {
                    index,
                    issue: 'invalid-entry',
                    raw: raw ?? null,
                };
            }

            const missingKeys = [];
            if (normalizedRequirement.requisito_id == null) missingKeys.push('requisito_id');
            if (normalizedRequirement.type == null) missingKeys.push('type');
            if (normalizedRequirement.title == null) missingKeys.push('title');

            if (missingKeys.length === 0) {
                return null;
            }

            return {
                index,
                issue: 'missing-fields',
                missingKeys,
                requirement: normalizedRequirement,
            };
        })
        .filter(Boolean);

    return {
        receivedCount: received.length,
        normalizedCount: normalized.length,
        placeholderIds,
        missingFieldIds: placeholderIds.filter((fieldId) => !normalizedIds.has(fieldId)),
        problematicRequirements,
    };
}

/**
 * Elige la fuente más completa de requisitos entre varias candidatas.
 * Esto permite preferir el detalle fresco de la API cuando el caché local
 * quedó incompleto.
 *
 * @param {...Array} sources
 * @returns {Array}
 */
export function pickBestTemplateRequirements(...sources) {
    let best = [];

    for (const source of sources) {
        const normalized = normalizeTemplateRequirements(source);
        if (normalized.length > best.length) {
            best = normalized;
        }
    }

    return best;
}
