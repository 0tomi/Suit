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
    return result?.data?.message || result?.error || fallback;
}
