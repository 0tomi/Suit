const FIELD_LABELS = {
    title: 'Carátula',
    details: 'Resumen / Descripción del Caso',
    start_date: 'Fecha de Inicio',
    case_type_id: 'Fuero del Caso',
    nro_expediente: 'Nro. Expediente',
    radicacion_id: 'Radicación',
    jurisdiccion_id: 'Jurisdicción',
    dependencia_id: 'Competencia (Juzgado)',
    client_ids: 'Clientes',
    tipo_expediente_ids: 'Tipos de expediente',
    user_tag: 'Usuario',
    permission_level: 'Nivel de permiso',
    last_updated_at: 'Última actualización',
};

function prettifyFieldName(fieldName) {
    const normalized = String(fieldName || '').trim().replace(/\.\d+/g, '');
    if (!normalized) return 'este campo';

    if (FIELD_LABELS[normalized]) {
        return FIELD_LABELS[normalized];
    }

    return normalized
        .split('_')
        .filter(Boolean)
        .map((chunk, index) => index === 0 ? chunk.charAt(0).toUpperCase() + chunk.slice(1) : chunk)
        .join(' ');
}

export function translateApiErrorMessage(message, fallback = 'Ocurrió un error inesperado.') {
    const source = typeof message === 'string' && message.trim() ? message.trim() : '';
    if (!source) return fallback;

    const matchers = [
        {
            regex: /^The (.+?) field is required\.?$/i,
            format: ([, field]) => `El campo ${prettifyFieldName(field)} es obligatorio.`,
        },
        {
            regex: /^The (.+?) field must be a string\.?$/i,
            format: ([, field]) => `El campo ${prettifyFieldName(field)} debe ser un texto.`,
        },
        {
            regex: /^The (.+?) field must be an integer\.?$/i,
            format: ([, field]) => `El campo ${prettifyFieldName(field)} debe ser un número entero.`,
        },
        {
            regex: /^The (.+?) field must be an array\.?$/i,
            format: ([, field]) => `El campo ${prettifyFieldName(field)} debe ser una lista.`,
        },
        {
            regex: /^The (.+?) field must be a boolean\.?$/i,
            format: ([, field]) => `El campo ${prettifyFieldName(field)} debe ser verdadero o falso.`,
        },
        {
            regex: /^The (.+?) field must be a valid date\.?$/i,
            format: ([, field]) => `El campo ${prettifyFieldName(field)} debe tener una fecha válida.`,
        },
        {
            regex: /^The selected (.+?) is invalid\.?$/i,
            format: ([, field]) => `El valor seleccionado para ${prettifyFieldName(field)} no es válido.`,
        },
        {
            regex: /^The (.+?) field must be one of the following values: (.+)\.?$/i,
            format: ([, field, values]) => `El campo ${prettifyFieldName(field)} debe ser uno de estos valores: ${values}.`,
        },
        {
            regex: /^The (.+?) has already been taken\.?$/i,
            format: ([, field]) => `El valor de ${prettifyFieldName(field)} ya está en uso.`,
        },
    ];

    for (const matcher of matchers) {
        const match = source.match(matcher.regex);
        if (match) {
            return matcher.format(match);
        }
    }

    return source;
}

/**
 * Interpreta un resultado de API fallido y devuelve un mensaje legible.
 * Centraliza el manejo de errores comunes (403, mensajes del servidor, errores de red)
 * para que los componentes no repitan esta lógica.
 *
 * @param {object} result   - Resultado de apiRequest / apiGet { ok, status, data, error }
 * @param {string} fallback - Mensaje por defecto si no hay información específica
 * @returns {string}
 */
export function getApiErrorMessage(result, fallback = 'Ocurrió un error inesperado.') {
    if (result?.status === 403) {
        return 'No tienes permisos para realizar esta acción.';
    }

    if (result?.data?.errors && typeof result.data.errors === 'object') {
        const firstError = Object.values(result.data.errors).flatMap((value) => Array.isArray(value) ? value : [value]).find(Boolean);
        return translateApiErrorMessage(firstError, fallback);
    }

    return translateApiErrorMessage(result?.data?.message || result?.error, fallback);
}
