/**
 * templateCapitalization.js — Utilidad para aplicar transformaciones de capitalización
 * a los valores resueltos por el motor de plantillas.
 *
 * Se usa para escribir documentos legales donde ciertos campos
 * (nombres, jurisdicciones, etc.) deben ir en MAYÚSCULAS o en Título.
 */

/** Modos de capitalización disponibles para el motor de plantillas. */
export const CAPITALIZATION_MODE = {
    UPPER:      'UPPER',       // TODO EN MAYÚSCULAS
    TITLE_CASE: 'TITLE_CASE',  // Primera Mayúscula Por Palabra
};

/**
 * Convierte un string al formato título: primera letra de cada palabra en mayúscula,
 * el resto en minúscula. Maneja caracteres acentuados del español.
 *
 * @param {string} str
 * @returns {string}
 */
function toTitleCase(str) {
    return str
        .split(' ')
        .map(word => word.length > 0 ? word[0].toUpperCase() + word.slice(1).toLowerCase() : word)
        .join(' ');
}

/**
 * En nombres de cliente con tratamiento formal, el prefijo no debe mutar cuando
 * el resto del valor pasa a MAYÚSCULAS. Ej: "Sr. Juan Pérez" → "Sr. JUAN PÉREZ".
 */
function preserveClientTreatmentInUppercase(str, type) {
    if (type !== 'clientCompleteName' && type !== 'clientLastName') {
        return str.toUpperCase();
    }

    const match = String(str).match(/^(Sr\.|Sra\.)(\s+)(.*)$/i);
    if (!match) return str.toUpperCase();

    const [, treatment, spacing, remainder] = match;
    return `${treatment}${spacing}${remainder.toUpperCase()}`;
}

/**
 * Aplica la capitalización configurada a un valor resuelto del motor de plantillas.
 *
 * Solo transforma si el campo tiene habilitada la capitalización en settings.
 * Si el campo no está habilitado o no hay settings, devuelve el valor sin cambios.
 *
 * @param {string} value                  - Valor ya resuelto por el filler
 * @param {string} type                   - Tipo de requisito (ej: 'caseTitle', 'clientCompleteName')
 * @param {Object|null} capitalizationSettings - { mode: 'UPPER'|'TITLE_CASE', fields: { [type]: boolean } }
 * @returns {string}
 */
export function applyCapitalization(value, type, capitalizationSettings) {
    if (!capitalizationSettings || !value) return value;

    const { mode, fields } = capitalizationSettings;
    if (!fields?.[type]) return value;

    const str = String(value);

    if (mode === CAPITALIZATION_MODE.UPPER)      return preserveClientTreatmentInUppercase(str, type);
    if (mode === CAPITALIZATION_MODE.TITLE_CASE) return toTitleCase(str);

    return str;
}

/**
 * Configuración por defecto de capitalización para nuevos usuarios.
 * Todos los campos deshabilitados, modo TITLE_CASE como referencia.
 */
export const DEFAULT_TEMPLATE_CAPITALIZATION = {
    mode: CAPITALIZATION_MODE.TITLE_CASE,
    fields: {
        // Caso
        caseTitle:          false,
        caseType:           false,
        radicacion:         false,
        jurisdiccion:       false,
        competencia:        false,
        dependencia:        false,
        // Cliente
        clientCompleteName: false,
        clientFirstName:    false,
        clientLastName:     false,
        // Usuario / Abogado
        userCompleteName:   false,
        userLastName:       false,
        // Partes contrarias
        parteCompleteName:  false,
        // Fechas nombradas
        mesNombrado:        false,
        diaNombrado:        false,
        anioNombrado:       false,
        montoNombrado:      false,
        fechaConMesNombrado: false,
        // Financiero
        paymentType:        false,
        // Ubicación
        city:               false,
        province:           false,
        address:            false,
        // Eventos
        eventType:          false,
        eventName:          false,
    },
};
