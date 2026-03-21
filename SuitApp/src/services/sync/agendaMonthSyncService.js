import dayjs from 'dayjs';
import { fromApiStartsAt } from '../../utils/dateTimeAdapter.js';
import {
    getAgendaEventsByMonth,
    getAgendaMonthLastModified,
    getAllEventsByMonth,
    getAllEventsMonthLastModified,
} from '../eventService.js';
import { createLogger } from '../logService.js';
import { isExpectedNetworkError } from './syncCore.js';
import { startupMark, startupMarkCount } from '../../utils/startupMetrics.js';
import { syncAgendas } from './agendaSyncService.js';
import { isServerUpToDate } from './syncCore.js';
import { getApiBase } from '../api.js';

const DEFAULT_VIEW = 'month';
const DEFAULT_CONCURRENCY = 4;
const agendaMonthSyncInFlight = new Map();
const logger = createLogger('agenda-month-sync');

export function resetAgendaMonthSyncInFlightState() {
    agendaMonthSyncInFlight.clear();
}

function toNumber(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function toPositiveInteger(value) {
    const parsed = toNumber(value);
    if (!parsed || parsed < 1 || !Number.isInteger(parsed)) return null;
    return parsed;
}

function normalizeYearMonth(year, month) {
    const normalizedYear = toNumber(year);
    const normalizedMonth = toNumber(month);

    if (!normalizedYear || normalizedYear < 1) {
        throw new Error(`Año inválido para sync mensual: ${String(year)}`);
    }
    if (!normalizedMonth || normalizedMonth < 1 || normalizedMonth > 12) {
        throw new Error(`Mes inválido para sync mensual: ${String(month)}`);
    }

    return { year: normalizedYear, month: normalizedMonth };
}

function formatYearMonth(year, month) {
    const { year: y, month: m } = normalizeYearMonth(year, month);
    return `${String(y)}-${String(m).padStart(2, '0')}`;
}

export function buildAgendaMonthMetaResource(agendaId, year, month) {
    const normalizedAgendaId = toNumber(agendaId);
    if (!normalizedAgendaId || normalizedAgendaId < 1) {
        throw new Error(`agendaId inválido para sync mensual: ${String(agendaId)}`);
    }
    return `events:agenda:${normalizedAgendaId}:month:${formatYearMonth(year, month)}`;
}

export function buildAllAgendasMonthMetaResource(year, month) {
    return `events:all:month:${formatYearMonth(year, month)}`;
}

function buildMonthTarget(dateLike) {
    const date = dayjs(dateLike);
    const safeDate = date.isValid() ? date : dayjs();
    return {
        year: safeDate.year(),
        month: safeDate.month() + 1,
    };
}

function pushUniqueTarget(targets, target) {
    const key = formatYearMonth(target.year, target.month);
    const exists = targets.some((item) => formatYearMonth(item.year, item.month) === key);
    if (!exists) targets.push(target);
}

export function resolveVisibleMonthTargets(date, view = DEFAULT_VIEW) {
    const safeView = view || DEFAULT_VIEW;
    const safeDate = dayjs(date);
    const baseDate = safeDate.isValid() ? safeDate : dayjs();

    if (safeView === 'year') {
        const year = baseDate.year();
        return Array.from({ length: 12 }, (_unused, index) => ({
            year,
            month: index + 1,
        }));
    }

    if (safeView === 'week') {
        const targets = [];
        pushUniqueTarget(targets, buildMonthTarget(baseDate.startOf('week')));
        pushUniqueTarget(targets, buildMonthTarget(baseDate.endOf('week')));
        return targets;
    }

    return [buildMonthTarget(baseDate)];
}

function normalizeEventsPayload(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.events)) return payload.events;
    return [];
}

function mapEventRow(event) {
    const normalizedEvent = {
        ...event,
        suit_case_id: event?.suit_case_id ?? event?.case_id ?? null,
        // Normalizar starts_at: stripear timezone para almacenamiento naive.
        starts_at: fromApiStartsAt(event?.starts_at) ?? null,
        is_all_day: event?.is_all_day ? 1 : 0,
    };

    return {
        id: normalizedEvent.id,
        agenda_id: normalizedEvent.agenda_id,
        suit_case_id: normalizedEvent.suit_case_id,
        event_type_id: normalizedEvent.event_type_id || 1,
        title: normalizedEvent.title,
        description: normalizedEvent.description,
        starts_at: normalizedEvent.starts_at,
        is_all_day: normalizedEvent.is_all_day,
        data_json: JSON.stringify(normalizedEvent),
        synced_at: new Date().toISOString(),
    };
}

function parseAgendaId(row) {
    const direct = toNumber(row?.id);
    if (direct && direct > 0) return direct;

    if (!row?.data_json) return null;
    try {
        const parsed = JSON.parse(row.data_json);
        const parsedId = toNumber(parsed?.id);
        return parsedId && parsedId > 0 ? parsedId : null;
    } catch (error) {
        void logger.warn('failed to parse cached agenda row while building sync targets', {
            rowId: row?.id ?? null,
            error,
        });
        return null;
    }
}

async function readCachedAgendaIds() {
    const rows = await window.electronAPI.db.getAll('agendas');
    const ids = new Set();

    for (const row of rows || []) {
        const agendaId = parseAgendaId(row);
        if (agendaId) ids.add(agendaId);
    }

    return Array.from(ids);
}

async function runWithConcurrency(taskFactories, concurrency = DEFAULT_CONCURRENCY) {
    if (!Array.isArray(taskFactories) || taskFactories.length === 0) return [];

    const safeConcurrency = Math.max(1, Number(concurrency) || DEFAULT_CONCURRENCY);
    const results = new Array(taskFactories.length);
    let currentIndex = 0;

    const workers = Array.from({ length: Math.min(safeConcurrency, taskFactories.length) }, async () => {
        while (currentIndex < taskFactories.length) {
            const index = currentIndex;
            currentIndex += 1;
            results[index] = await taskFactories[index]();
        }
    });

    await Promise.all(workers);
    return results;
}

async function syncAgendaMonth(agendaId, target, {
    force = false,
    onFetchRequired = null,
    onEventsFetched = null,
    persistMode = 'await',
} = {}) {
    const { year, month } = normalizeYearMonth(target.year, target.month);
    const resource = buildAgendaMonthMetaResource(agendaId, year, month);
    const safePersistMode = persistMode === 'background' ? 'background' : 'await';
    const inFlightKey = `${resource}|force:${force ? '1' : '0'}|persist:${safePersistMode}`;

    if (agendaMonthSyncInFlight.has(inFlightKey)) {
        return agendaMonthSyncInFlight.get(inFlightKey);
    }

    const task = (async () => {
        const onFetchRequiredCb = typeof onFetchRequired === 'function' ? onFetchRequired : null;
        const onEventsFetchedCb = typeof onEventsFetched === 'function' ? onEventsFetched : null;

        startupMarkCount('events:month-sync:start', 'events:month-sync:calls', {
            agendaId,
            year,
            month,
            force,
        });

        const localMeta = await window.electronAPI.sync.getMeta(resource);
        let serverTimestamp = null;
        let shouldFetch = Boolean(force) || !localMeta;
        let fetchReason = shouldFetch ? (force ? 'force' : 'cache-miss') : null;

        if (!shouldFetch) {
            try {
                serverTimestamp = await getAgendaMonthLastModified(agendaId, month, year);
                shouldFetch = !isServerUpToDate(serverTimestamp, localMeta?.last_server || null);
                if (shouldFetch) {
                    fetchReason = 'stale';
                }
            } catch (err) {
                void logger.warn('last-modified fallback to fetch', {
                    agendaId,
                    year,
                    month,
                    message: err?.message || String(err),
                });
                shouldFetch = true;
                fetchReason = 'last-modified-error';
            }
        }

        if (!shouldFetch) {
            startupMark('events:month-sync:up-to-date', { agendaId, year, month });
            return false;
        }

        onFetchRequiredCb?.({
            agendaId,
            year,
            month,
            reason: fetchReason || 'unknown',
            hasLocalCache: Boolean(localMeta),
        });

        const rawEvents = await getAgendaEventsByMonth(agendaId, month, year);
        const events = normalizeEventsPayload(rawEvents);
        const rows = events.map(mapEventRow);
        onEventsFetchedCb?.({
            agendaId,
            year,
            month,
            reason: fetchReason || 'unknown',
            hasLocalCache: Boolean(localMeta),
            events,
            rows,
        });

        if (serverTimestamp == null) {
            try {
                serverTimestamp = await getAgendaMonthLastModified(agendaId, month, year);
            } catch (err) {
                void logger.warn('failed to persist exact last-modified', {
                    agendaId,
                    year,
                    month,
                    message: err?.message || String(err),
                });
            }
        }

        const persistTask = (async () => {
            await window.electronAPI.db.reconcileEventsForAgendaMonth(agendaId, year, month, rows);
            await window.electronAPI.sync.setMeta(resource, new Date().toISOString(), serverTimestamp ?? null);
        })();

        if (safePersistMode === 'background') {
            persistTask.catch((err) => {
                const level = isExpectedNetworkError(err) ? 'warn' : 'error';
                void logger[level]('background persist error', {
                    agendaId,
                    year,
                    month,
                    message: err?.message || String(err),
                });
            });
        } else {
            await persistTask;
        }

        startupMark('events:month-sync:done', {
            agendaId,
            year,
            month,
            fetchedEvents: rows.length,
            persistMode: safePersistMode,
        });
        return true;
    })().catch((err) => {
        const level = isExpectedNetworkError(err) ? 'warn' : 'error';
        void logger[level]('month sync error', {
            agendaId,
            year,
            month,
            message: err?.message || String(err),
        });
        startupMark('events:month-sync:error', {
            agendaId,
            year,
            month,
            message: err?.message || String(err),
        });
        return false;
    }).finally(() => {
        agendaMonthSyncInFlight.delete(inFlightKey);
    });

    agendaMonthSyncInFlight.set(inFlightKey, task);
    return task;
}

async function syncAllAgendasMonth(target, {
    force = false,
    onFetchRequired = null,
    onEventsFetched = null,
    persistMode = 'await',
} = {}) {
    const { year, month } = normalizeYearMonth(target.year, target.month);
    const resource = buildAllAgendasMonthMetaResource(year, month);
    const safePersistMode = persistMode === 'background' ? 'background' : 'await';
    const inFlightKey = `${resource}|scope:all|force:${force ? '1' : '0'}|persist:${safePersistMode}`;

    if (agendaMonthSyncInFlight.has(inFlightKey)) {
        return agendaMonthSyncInFlight.get(inFlightKey);
    }

    const task = (async () => {
        const onFetchRequiredCb = typeof onFetchRequired === 'function' ? onFetchRequired : null;
        const onEventsFetchedCb = typeof onEventsFetched === 'function' ? onEventsFetched : null;

        startupMarkCount('events:month-sync-all:start', 'events:month-sync-all:calls', {
            year,
            month,
            force,
        });

        const localMeta = await window.electronAPI.sync.getMeta(resource);
        let serverTimestamp = null;
        let shouldFetch = Boolean(force) || !localMeta;
        let fetchReason = shouldFetch ? (force ? 'force' : 'cache-miss') : null;

        if (!shouldFetch) {
            try {
                serverTimestamp = await getAllEventsMonthLastModified(month, year);
                shouldFetch = !isServerUpToDate(serverTimestamp, localMeta?.last_server || null);
                if (shouldFetch) {
                    fetchReason = 'stale';
                }
            } catch (err) {
                void logger.warn('all-agendas last-modified fallback to fetch', {
                    year,
                    month,
                    message: err?.message || String(err),
                });
                shouldFetch = true;
                fetchReason = 'last-modified-error';
            }
        }

        if (!shouldFetch) {
            startupMark('events:month-sync-all:up-to-date', { year, month });
            return false;
        }

        onFetchRequiredCb?.({
            agendaId: 'ALL',
            year,
            month,
            reason: fetchReason || 'unknown',
            hasLocalCache: Boolean(localMeta),
        });

        const rawEvents = await getAllEventsByMonth(month, year);
        const events = normalizeEventsPayload(rawEvents);
        const rows = events.map(mapEventRow);
        onEventsFetchedCb?.({
            agendaId: 'ALL',
            year,
            month,
            reason: fetchReason || 'unknown',
            hasLocalCache: Boolean(localMeta),
            events,
            rows,
        });

        if (serverTimestamp == null) {
            try {
                serverTimestamp = await getAllEventsMonthLastModified(month, year);
            } catch (err) {
                void logger.warn('all-agendas failed to persist exact last-modified', {
                    year,
                    month,
                    message: err?.message || String(err),
                });
            }
        }

        const rowsByAgendaId = new Map();
        for (const row of rows) {
            const rowAgendaId = toPositiveInteger(row?.agenda_id);
            if (!rowAgendaId) continue;
            if (!rowsByAgendaId.has(rowAgendaId)) {
                rowsByAgendaId.set(rowAgendaId, []);
            }
            rowsByAgendaId.get(rowAgendaId).push(row);
        }

        const cachedAgendaIds = await readCachedAgendaIds();
        const touchedAgendaIds = new Set(cachedAgendaIds);
        for (const rowAgendaId of rowsByAgendaId.keys()) {
            touchedAgendaIds.add(rowAgendaId);
        }

        const persistTask = (async () => {
            for (const targetAgendaId of touchedAgendaIds) {
                const targetRows = rowsByAgendaId.get(targetAgendaId) || [];
                await window.electronAPI.db.reconcileEventsForAgendaMonth(targetAgendaId, year, month, targetRows);
            }
            await window.electronAPI.sync.setMeta(resource, new Date().toISOString(), serverTimestamp ?? null);
        })();

        if (safePersistMode === 'background') {
            persistTask.catch((err) => {
                const level = isExpectedNetworkError(err) ? 'warn' : 'error';
                void logger[level]('all-agendas background persist error', {
                    year,
                    month,
                    message: err?.message || String(err),
                });
            });
        } else {
            await persistTask;
        }

        startupMark('events:month-sync-all:done', {
            year,
            month,
            fetchedEvents: rows.length,
            touchedAgendas: touchedAgendaIds.size,
            persistMode: safePersistMode,
        });
        return true;
    })().catch((err) => {
        const level = isExpectedNetworkError(err) ? 'warn' : 'error';
        void logger[level]('all-agendas month sync error', {
            year,
            month,
            message: err?.message || String(err),
        });
        startupMark('events:month-sync-all:error', {
            year,
            month,
            message: err?.message || String(err),
        });
        return false;
    }).finally(() => {
        agendaMonthSyncInFlight.delete(inFlightKey);
    });

    agendaMonthSyncInFlight.set(inFlightKey, task);
    return task;
}

export async function syncAgendaEventsForView({
    date = new Date(),
    view = DEFAULT_VIEW,
    force = false,
    concurrency = DEFAULT_CONCURRENCY,
    agendaId = null,
    syncAgendaCatalog = true,
    onFetchRequired = null,
    onEventsFetched = null,
    persistMode = 'await',
} = {}) {
    if (!window.electronAPI) return false;

    // Guard: API URL not configured yet (race condition during startup on Windows)
    if (!getApiBase()) return false;

    if (syncAgendaCatalog) {
        await syncAgendas();
    }

    const normalizedAgendaId = agendaId == null || agendaId === 'ALL' ? null : toPositiveInteger(agendaId);
    const monthTargets = resolveVisibleMonthTargets(date, view);
    const tasks = [];
    if (normalizedAgendaId) {
        for (const target of monthTargets) {
            tasks.push(() => syncAgendaMonth(normalizedAgendaId, target, {
                force,
                onFetchRequired,
                onEventsFetched,
                persistMode,
            }));
        }
    } else {
        for (const target of monthTargets) {
            tasks.push(() => syncAllAgendasMonth(target, {
                force,
                onFetchRequired,
                onEventsFetched,
                persistMode,
            }));
        }
    }

    if (tasks.length === 0) {
        startupMark('events:month-sync:skip-no-targets');
        return false;
    }

    const results = await runWithConcurrency(tasks, concurrency);
    return results.some(Boolean);
}

export default {
    syncAgendaEventsForView,
    resolveVisibleMonthTargets,
    buildAgendaMonthMetaResource,
    buildAllAgendasMonthMetaResource,
};
