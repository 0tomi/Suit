import { format, parseISO } from 'date-fns';
import { apiGet, getApiBase } from '../api.js';
import { createLogger } from '../logService.js';
import { startupMark, startupMarkCount } from '../../utils/startupMetrics.js';

const logger = createLogger('sync-core');

/**
 * Devuelve la fecha/hora local en formato "YYYY-MM-DD HH:mm:ss" que espera Laravel
 * en sus comparaciones de timestamps sin timezone.
 */
export function getLocalLaravelTime() {
    return format(new Date(), 'yyyy-MM-dd HH:mm:ss');
}


/** Número de días a partir de los cuales el caché se considera desactualizado. */
export const STALE_THRESHOLD_DAYS = 3;
const syncInFlightByResource = new Map();

export function resetSyncInFlightState() {
    syncInFlightByResource.clear();
}

/**
 * Clasifica errores de red/configuración esperados que no deben generar error snapshots.
 * Estos errores ocurren durante startup o cuando el servidor no está disponible,
 * y son condiciones normales de operación.
 */
export function isExpectedNetworkError(err) {
    const msg = err?.message || String(err);
    return (
        msg.includes('API base URL no configurada') ||
        msg.includes('ECONNREFUSED') ||
        msg.includes('ETIMEDOUT') ||
        msg.includes('ENOTFOUND') ||
        msg.includes('Network Error') ||
        msg.includes('Failed to fetch') ||
        msg.includes('net::ERR_')
    );
}

export function parseTimestampToMs(timestamp) {
    if (!timestamp) return null;

    const raw = String(timestamp).trim();
    if (!raw) return null;

    // Laravel suele responder "YYYY-MM-DD HH:mm:ss" sin timezone.
    const base = raw.replace(' ', 'T');
    const candidates = [base, `${base}Z`];

    for (const candidate of candidates) {
        const ms = Date.parse(candidate);
        if (!Number.isNaN(ms)) return ms;
    }

    return null;
}

function normalizeComparableTimestamp(timestamp) {
    if (!timestamp) return null;

    const raw = String(timestamp).trim();
    const match = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2})/.exec(raw);
    if (!match) return null;

    return `${match[1]} ${match[2]}`;
}

export function isServerUpToDate(serverTimestamp, localTimestamp) {
    if (!serverTimestamp || !localTimestamp) return false;

    const serverRaw = String(serverTimestamp);
    const localRaw = String(localTimestamp);
    if (serverRaw === localRaw) return true;

    // Compatibilidad con metas legacy guardadas como ISO a partir del mismo valor
    // "wall-clock" que hoy devuelve Laravel sin timezone.
    const normalizedServer = normalizeComparableTimestamp(serverRaw);
    const normalizedLocal = normalizeComparableTimestamp(localRaw);
    if (normalizedServer && normalizedLocal && normalizedServer === normalizedLocal) {
        return true;
    }

    const serverMs = parseTimestampToMs(serverTimestamp);
    const localMs = parseTimestampToMs(localTimestamp);

    if (serverMs !== null && localMs !== null) {
        return serverMs <= localMs;
    }

    // Fallback conservador si el parseo falla en ambos lados.
    return serverRaw <= localRaw;
}

/**
 * Comprueba cada recurso sincronizado y, si su último sync supera el umbral de días
 * definido en STALE_THRESHOLD_DAYS, limpia su tabla y resetea el sync_meta.
 * Esto fuerza un full re-fetch en el siguiente syncResource.
 */
export async function clearStaleResources() {
    // Recursos con claves compuestas (events, agendas, deadlines) no entran aquí:
    // su sync usa claves tipo 'deadlines:month:2026-03' y el getMeta('deadlines')
    // siempre devuelve null → triggea clear innecesario. Estos recursos se auto-validan
    // por last-modified en cada acceso y no necesitan stale check global.
    const resources = [
        'cases', 'documents', 'clients', 'users', 'templates', 'template_categories',
        // Catálogos nuevos — se limpian si no se sincronizan en 3 días para forzar re-fetch
        'radicaciones', 'tipo_expedientes', 'roles', 'tipo_pagos', 'gastos_catalogo', 'partes',
        // Catálogos judiciales
        'jurisdicciones', 'competencias', 'dependencias_judiciales',
        // Multimedia y archivos generales — metadatos cacheados, contenido binario on-demand
        'multimedia', 'files',
    ];
    const thresholdMs = STALE_THRESHOLD_DAYS * 24 * 60 * 60 * 1000;
    const now = Date.now();

    // Las 19 operaciones son independientes entre sí: Promise.allSettled las
    // paraleliza eliminando el waterfall secuencial (cada await ya no bloquea al siguiente).
    // allSettled en lugar de all: un fallo en un recurso no cancela los demás.
    await Promise.allSettled(resources.map(async (resource) => {
        try {
            const meta = await window.electronAPI.sync.getMeta(resource);
            const lastSync = meta?.last_sync ? parseISO(String(meta.last_sync).replace(' ', 'T')).getTime() : null;

            const isStale = !lastSync || (now - lastSync) > thresholdMs;
            if (isStale) {
                void logger.info(`cache stale (>${STALE_THRESHOLD_DAYS}d), forcing full re-sync`, { resource });
                await window.electronAPI.db.clearTable(resource);
                // Borrar sync_meta para que syncResource haga full fetch
                await window.electronAPI.sync.setMeta(resource, null, null);
            }
        } catch (err) {
            void logger.warn(`error checking stale resource ${resource}`, err);
        }
    }));
}

/**
 * Sincroniza un recurso individual usando last-modified.
 */
export async function syncResource(resourceName, lastModifiedEndpoint, fetchFn) {
    if (syncInFlightByResource.has(resourceName)) {
        startupMark('sync:resource:deduped', { resourceName });
        return syncInFlightByResource.get(resourceName);
    }

    const syncPromise = (async () => {
        startupMarkCount('sync:resource:start', `sync:resource:${resourceName}:calls`, {
            resourceName,
            hasLastModifiedEndpoint: Boolean(lastModifiedEndpoint),
        });

        // Guard: API URL no configurada aún (race condition de startup)
        if (!getApiBase()) {
            void logger.warn(`${resourceName} skipped (API not configured yet)`);
            return false;
        }

        if (!window.electronAPI) {
            // Fallback for web environment, directly fetch if needed or just skip sync
            void logger.warn(`${resourceName} skipped (electronAPI not available)`);
            return false;
        }

        try {
            const meta = await window.electronAPI.sync.getMeta(resourceName);
            const localTimestamp = meta?.last_server || null;

            // Usar count en lugar de getAll: evita serializar toda la tabla por IPC
            // solo para responder si está vacía. SELECT COUNT(*) es instantáneo en SQLite.
            const rowCount = await window.electronAPI.db.count(resourceName);
            const isTableEmpty = rowCount === 0;

            if (lastModifiedEndpoint) {
                // Si no hay timestamp local: hacemos full fetch directamente y luego persistimos
                // el last-modified real del servidor para evitar un re-fetch en la próxima sesión.
                // Nota: isTableEmpty ya no dispara Path A por sí solo — si hay localTimestamp
                // siempre verificamos last-modified primero (Path B). Si el servidor devuelve null,
                // significa que no hay datos y se saltea el fetch.
                if (!localTimestamp) {
                    void logger.info('no local timestamp, skipping last-modified check and doing full fetch', { resourceName });
                    await fetchFn();

                    let fetchedServerTimestamp = null;
                    try {
                        const lastModifiedResult = await apiGet(lastModifiedEndpoint, {
                            dedupeKey: `sync:last-modified:${resourceName}`,
                        });
                        fetchedServerTimestamp = lastModifiedResult.ok ? lastModifiedResult.data?.last_modified : null;
                    } catch (error) {
                        void logger.warn(`failed to fetch last-modified after initial sync for ${resourceName}`, error);
                    }

                    await window.electronAPI.sync.setMeta(
                        resourceName,
                        new Date().toISOString(),
                        fetchedServerTimestamp || getLocalLaravelTime()
                    );
                    startupMark('sync:resource:done', { resourceName, fullFetch: true });
                    return true;
                }

                const result = await apiGet(lastModifiedEndpoint, {
                    dedupeKey: `sync:last-modified:${resourceName}`,
                });
                const serverTimestamp = result.ok ? result.data?.last_modified : null;

                // null significa que el servidor no tiene datos para este recurso (sin registros).
                // No hay nada que sincronizar: salteamos el fetch.
                if (!serverTimestamp) {
                    void logger.info(`${resourceName} server returned null last_modified (no data), skipping fetch`);
                    startupMark('sync:resource:up-to-date', { resourceName });
                    return false;
                }

                if (isServerUpToDate(serverTimestamp, localTimestamp)) {
                    // Si los timestamps coinciden pero la tabla está vacía, el sync anterior
                    // registró el meta pero falló al poblar el cache. Forzar re-fetch.
                    if (!isTableEmpty) {
                        void logger.info(`${resourceName} up-to-date`);
                        startupMark('sync:resource:up-to-date', { resourceName });
                        return false;
                    }
                    void logger.warn(`${resourceName} timestamps match but table is empty — forcing re-fetch`);
                }

                await fetchFn();

                await window.electronAPI.sync.setMeta(
                    resourceName,
                    new Date().toISOString(),
                    serverTimestamp || getLocalLaravelTime()
                );
                startupMark('sync:resource:done', { resourceName, fullFetch: false });
                return true;
            }

            // Recurso sin endpoint last-modified (events usa su propio flujo)
            const changed = await fetchFn(isTableEmpty ? null : localTimestamp);
            startupMark('sync:resource:done', {
                resourceName,
                fullFetch: isTableEmpty,
                changed: Boolean(changed),
            });
            return changed;
        } catch (err) {
            // Errores de red/configuración son esperados (startup, servidor caído): usar warn.
            // Errores inesperados (DB, lógica) mantienen nivel error para generar snapshot.
            const level = isExpectedNetworkError(err) ? 'warn' : 'error';
            void logger[level](`sync error for ${resourceName}`, err);
            startupMark('sync:resource:error', {
                resourceName,
                message: err?.message || String(err),
            });
            return false;
        }
    })().finally(() => {
        syncInFlightByResource.delete(resourceName);
    });

    syncInFlightByResource.set(resourceName, syncPromise);
    return syncPromise;
}
