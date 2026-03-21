import { getDeadlines, getDeadlinesLastModified } from '../deadlineService.js';
import { createLogger } from '../logService.js';
import { isServerUpToDate, isExpectedNetworkError, getLocalLaravelTime } from './syncCore.js';
import { getApiBase } from '../api.js';

/** Map para deduplicar syncs en vuelo del mismo mes. */
const deadlineMonthSyncInFlight = new Map();
const logger = createLogger('deadline-month-sync');

function buildDeadlineMonthKey(year, month) {
    return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Lee la tabla local una sola vez para decidir si la cache de vencimientos sigue hidratada.
 * Si sync_meta quedó pero la tabla se vació, forzamos fetch para reconstruir el recurso.
 */
async function readDeadlineCacheState(month, year) {
    const allRows = await window.electronAPI.db.getAll('deadlines');
    const monthKey = buildDeadlineMonthKey(year, month);

    return {
        allRows,
        hasAnyRows: Array.isArray(allRows) && allRows.length > 0,
        monthRows: (allRows || []).filter((row) => String(row.due_date ?? '').slice(0, 7) === monthKey),
    };
}

/** Clave de sync_meta para un mes/año específico de vencimientos. */
export function buildDeadlineMonthMetaResource(year, month) {
    return `deadlines:month:${year}-${String(month).padStart(2, '0')}`;
}

/** Mapea una respuesta de la API de vencimientos a una fila de SQLite. */
function mapDeadlineRow(deadline) {
    return {
        id: deadline.id,
        event_id: deadline.event_id ?? null,
        suit_case_id: deadline.suit_case_id ?? null,
        title: deadline.title,
        description: deadline.description ?? null,
        due_date: deadline.due_date,
        priority: deadline.priority ?? 'Normal',
        status: deadline.status ?? 'Pendiente',
        notify_at: deadline.notify_at ?? null,
        data_json: JSON.stringify(deadline),
        synced_at: new Date().toISOString(),
    };
}

/**
 * Elimina de SQLite los vencimientos locales del mes sincronizado que ya no existen en la API.
 */
async function reconcileRemovedDeadlines(month, year, rows) {
    const monthKey = buildDeadlineMonthKey(year, month);
    const serverIds = new Set(rows.map((row) => Number(row.id)));
    const { allRows: existingRows } = await readDeadlineCacheState(month, year);

    const removedLocalIds = existingRows
        .filter((row) => String(row.due_date ?? '').slice(0, 7) === monthKey)
        .map((row) => Number(row.id))
        .filter((localId) => !serverIds.has(localId));

    await Promise.all(removedLocalIds.map((deadlineId) => window.electronAPI.db.deleteById('deadlines', deadlineId)));
}

/**
 * Sincroniza los vencimientos de un mes/año específico.
 * Patrón: check local meta → check last-modified → fetch si hay cambios → upsert SQLite.
 * Tiene deduplicación: si ya hay un sync en vuelo para el mismo mes, reutiliza la promesa.
 *
 * @param {number} month - Mes (1-12)
 * @param {number} year - Año (ej. 2026)
 * @returns {Promise<boolean>} true si se hizo fetch, false si estaba up-to-date
 */
export async function syncDeadlinesMonth(month, year) {
    if (!window.electronAPI) return false;

    // Guard: API URL not configured yet (race condition during startup on Windows)
    if (!getApiBase()) return false;

    const resource = buildDeadlineMonthMetaResource(year, month);

    if (deadlineMonthSyncInFlight.has(resource)) {
        return deadlineMonthSyncInFlight.get(resource);
    }

    const task = (async () => {
        try {
            const localMeta = await window.electronAPI.sync.getMeta(resource);
            const localTimestamp = localMeta?.last_server ?? null;

            // Sin meta local: full fetch directo (primera vez), luego guardamos referencia.
            if (!localMeta) {
                const deadlines = await getDeadlines(month, year);
                if (!Array.isArray(deadlines)) return false;

                const rows = deadlines.map(mapDeadlineRow);
                let serverTimestamp = null;
                try {
                    serverTimestamp = await getDeadlinesLastModified(month, year);
                } catch (error) {
                    void logger.warn('no se pudo obtener last-modified tras fetch inicial', { month, year, error });
                }

                await window.electronAPI.db.upsertMany('deadlines', rows);
                await reconcileRemovedDeadlines(month, year, rows);
                // Usar getLocalLaravelTime como fallback si el servidor devuelve null
                await window.electronAPI.sync.setMeta(resource, new Date().toISOString(), serverTimestamp ?? getLocalLaravelTime());
                void logger.info(`${year}-${month} done (initial)`, { rowCount: rows.length });
                return true;
            }

            // Tenemos meta local → verificar last-modified primero.
            let serverTimestamp = null;
            try {
                serverTimestamp = await getDeadlinesLastModified(month, year);
            } catch (err) {
                // Si falla el last-modified, hacemos fetch de todas formas (conservador)
                void logger.warn('last-modified error, forzando fetch', { month, year, err: err?.message });
            }

            // null significa que el servidor no tiene vencimientos para este mes → nada que sincronizar.
            if (!serverTimestamp) {
                void logger.info(`${year}-${month} server returned null last_modified (no data), skipping fetch`);
                return false;
            }

            if (isServerUpToDate(serverTimestamp, localTimestamp)) {
                void logger.info(`${year}-${month} up-to-date`);
                return false;
            }

            const deadlines = await getDeadlines(month, year);
            if (!Array.isArray(deadlines)) return false;

            const rows = deadlines.map(mapDeadlineRow);

            await window.electronAPI.db.upsertMany('deadlines', rows);
            await reconcileRemovedDeadlines(month, year, rows);
            await window.electronAPI.sync.setMeta(resource, new Date().toISOString(), serverTimestamp);

            void logger.info(`${year}-${month} done`, { rowCount: rows.length });
            return true;
        } catch (err) {
            const level = isExpectedNetworkError(err) ? 'warn' : 'error';
            void logger[level]('month sync error', { month, year, err: err?.message });
            return false;
        }
    })().finally(() => {
        deadlineMonthSyncInFlight.delete(resource);
    });

    deadlineMonthSyncInFlight.set(resource, task);
    return task;
}
