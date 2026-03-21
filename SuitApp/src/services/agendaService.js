/**
 * agendaService.js — Operaciones de solo-lectura contra la API SuitAPI para agendas.
 */
import { apiGet } from './api.js';

/**
 * Obtiene la lista de agendas disponibles (metadatos).
 */
export async function getAgendas() {
    const result = await apiGet('/agendas');
    return result.ok ? result.data : [];
}

/**
 * Obtiene el estado de una agenda específica.
 */
export async function getAgendaStatus(agendaId) {
    const result = await apiGet(`/agendas/status/${agendaId}`, { dedupe: false });
    return result.ok ? result.data : null;
}
