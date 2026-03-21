import { apiGet, apiRequest } from './api.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

function parseIsoDateToUtcStart(dateString) {
    const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(dateString ?? ''));
    if (!match) return null;

    const [, year, month, day] = match;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

/**
 * Retorna si el vencimiento puede prorrogarse desde la UI.
 * La API actual no bloquea por estado, así que solo ocultamos la acción en cumplidos.
 */
export function canPostponeDeadline(deadline) {
    return deadline?.status !== 'Cumplido';
}

/**
 * Calcula la prioridad esperada para una fecha límite:
 * Urgente si faltan 2 días o menos; Normal en cualquier otro caso.
 */
export function resolveDeadlinePriorityForDate(dueDate, { now = new Date() } = {}) {
    const dueUtc = parseIsoDateToUtcStart(dueDate);
    if (dueUtc == null) return 'Normal';

    const todayUtc = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.round((dueUtc - todayUtc) / MS_PER_DAY);
    return diffDays <= 2 ? 'Urgente' : 'Normal';
}

/**
 * Normaliza el mensaje de error devuelto por la API para mutaciones de vencimientos.
 * Detecta 403 para reportar falta de permisos en lugar de un mensaje genérico.
 */
export function getDeadlineActionErrorMessage(result, fallback = 'No se pudo completar la operación.') {
    if (result?.status === 403) return 'No tienes permisos para realizar esta acción.';
    return result?.data?.message || result?.error || fallback;
}

/** Obtiene los vencimientos del mes/año especificado desde la API. */
export async function getDeadlines(month, year) {
    const result = await apiGet(`/vencimientos/${month}/${year}`);
    return result.ok ? result.data : [];
}

/** Obtiene un vencimiento individual por ID (con estado inferido actualizado). */
export async function getDeadline(id) {
    const result = await apiGet(`/vencimientos/${id}`);
    return result.ok ? result.data : null;
}

/** Crea un nuevo vencimiento. Si no se provee event_id, la API crea el evento automáticamente. */
export async function createDeadline(data) {
    return await apiRequest('/vencimientos', { method: 'POST', body: data });
}

/** Actualiza título, descripción, prioridad, estado o notify_at de un vencimiento. */
export async function updateDeadline(id, data) {
    return await apiRequest(`/vencimientos/${id}`, { method: 'PUT', body: data });
}

/** Elimina un vencimiento (registra tombstone para sync). */
export async function deleteDeadline(id) {
    return await apiRequest(`/vencimientos/${id}`, { method: 'DELETE' });
}

/** Marca un vencimiento como Cumplido (única vía para alcanzar ese estado). */
export async function markDeadlineCompleted(id) {
    return await apiRequest(`/vencimientos/${id}/completar`, { method: 'POST' });
}

/**
 * Prorroga un vencimiento Vencido a una nueva fecha.
 * El estado pasa automáticamente a Prorrogado.
 * @param {number} id
 * @param {string} newDate - Fecha en formato 'YYYY-MM-DD'
 */
export async function postponeDeadline(id, newDate) {
    const postponeResult = await apiRequest(`/vencimientos/${id}/prorrogar`, {
        method: 'POST',
        body: { due_date: newDate },
    });

    if (!postponeResult.ok) return postponeResult;

    const normalizedPriority = resolveDeadlinePriorityForDate(newDate);
    const priorityResult = await updateDeadline(id, {
        priority: normalizedPriority,
        status: 'Prorrogado',
    });

    if (!priorityResult.ok) {
        return {
            ...priorityResult,
            error: getDeadlineActionErrorMessage(
                priorityResult,
                'Se prorrogó el vencimiento, pero no se pudo normalizar la prioridad.'
            ),
            partialSuccess: true,
        };
    }

    return postponeResult;
}

/**
 * Obtiene el timestamp de última modificación de los vencimientos de un mes/año.
 * Usado para el check de caché antes de re-sincronizar.
 */
export async function getDeadlinesLastModified(month, year) {
    const result = await apiGet(`/vencimientos/last-modified/${month}/${year}`);
    return result.ok ? result.data?.last_modified : null;
}
