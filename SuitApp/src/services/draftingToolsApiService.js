/**
 * draftingToolsApiService.js — API enrichment para las herramientas de redacción.
 *
 * Centraliza las llamadas a la API para enriquecer el panel lateral del editor
 * con datos frescos más allá de lo que el caché local tiene disponible.
 * Los componentes de la toolbar usan este servicio en lugar de llamar directamente a la API.
 */
import { apiGet } from './api.js';
import { createLogger } from './logService.js';

const logger = createLogger('service:drafting-tools-api');

/**
 * Obtiene el contenido HTML desencriptado de un documento desde la API.
 * La respuesta es texto plano (HTML), no JSON.
 * @param {number|string} id - ID del documento
 * @returns {Promise<string|null>} HTML del documento, o null si falla
 */
export async function fetchDocumentContent(id) {
    const result = await apiGet(`/documents/${id}`, { responseType: 'text' });
    if (!result.ok) {
        void logger.warn('fetchDocumentContent failed', { id, status: result.status });
        return null;
    }
    return typeof result.data === 'string' ? result.data : null;
}

/**
 * Obtiene el detalle completo de un caso desde la API.
 * Incluye campos como nro_expediente, details, owner_tag, start_date.
 * @param {number|string} id - ID del caso
 * @returns {Promise<Object|null>}
 */
export async function fetchCaseDetail(id) {
    const result = await apiGet(`/cases/${id}`);
    if (!result.ok) {
        void logger.warn('fetchCaseDetail failed', { id, status: result.status });
        return null;
    }
    return result.data || null;
}

/**
 * Obtiene el detalle completo de un cliente desde la API.
 * @param {number|string} id - ID del cliente
 * @returns {Promise<Object|null>}
 */
export async function fetchClientDetail(id) {
    const result = await apiGet(`/clients/${id}`);
    if (!result.ok) {
        void logger.warn('fetchClientDetail failed', { id, status: result.status });
        return null;
    }
    return result.data || null;
}

/**
 * Dispatcher: dado un tipo de entidad y su id, llama al endpoint correspondiente.
 * Retorna null si el tipo no tiene endpoint individual conocido.
 * @param {'Caso'|'Cliente'} type - Tipo de entidad
 * @param {number|string} id - ID de la entidad
 * @returns {Promise<Object|null>}
 */
export async function fetchEntityDetail(type, id) {
    switch (type) {
        case 'Caso':    return fetchCaseDetail(id);
        case 'Cliente': return fetchClientDetail(id);
        default:        return null;
    }
}
