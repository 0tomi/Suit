/**
 * caseSyncDownService.js — Orquestador de sync incremental por caso individual.
 *
 * Al entrar a un caso, este servicio:
 * 1. Consulta GET /cases/{id}/last-modified para obtener timestamps per-entity del servidor.
 * 2. Compara con los timestamps locales almacenados en case_sync_meta.
 * 3. Decide si los datos están al día, si falta cache o si hay entidades desactualizadas.
 * 4. En caso de desactualización, llama a syncDown con la fecha más antigua de los datos stale.
 * 5. Persiste los datos recibidos en SQLite por entidad (en paralelo) y actualiza case_sync_meta.
 *
 * El servicio espera a que la persistencia termine antes de resolver.
 * Esto evita carreras donde la UI re-lee SQLite enseguida después del sync
 * y todavía encuentra datos viejos.
 */

import { getCaseLastModified, getCaseSyncDown } from '../caseService.js';
import { parseTimestampToMs, isServerUpToDate } from './syncCore.js';
import { buildHonorarioCacheRow } from '../cache/honorarioCacheRow.js';
import { buildGastoCacheRow } from '../cache/gastoCacheRow.js';
import { buildEntregaCacheRow } from '../cache/entregaCacheRow.js';
import { buildParteCacheRow, buildParteCasoRow } from '../cache/parteCasoRow.js';
import { buildMultimediaCacheRow } from '../cache/multimediaCacheRow.js';
import { buildFileCacheRow } from '../cache/fileCacheRow.js';
import { buildCaseCacheRow } from '../cache/caseCacheRow.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:case-syncdown');

/**
 * Fecha epoch usada para forzar un syncDown completo cuando no hay cache local.
 * La API retornará todo lo que exista desde esta fecha en adelante.
 */
const EPOCH_DATE = '2000-01-01 00:00:00';

/**
 * Map de deduplicación: evita lanzar múltiples syncDown concurrentes para el mismo caso.
 * key: caseId (number), value: Promise<SyncResult>
 */
const syncInFlightByCaseId = new Map();

/**
 * Construye una fila de caché para la tabla `documents` a partir de un objeto de la API.
 * Mantiene el content HTML ya cacheado localmente si existe.
 * @param {Object} doc - Objeto documento de la API
 * @param {Map<number, Object>} existingById - Mapa de documentos ya en cache por id
 */
function buildDocumentCacheRow(doc, existingById = new Map()) {
    return {
        id: doc.id,
        name: doc.name,
        suit_case_id: doc.suit_case_id || null,
        user_id: doc.user_id || null,
        // Preserva contenido HTML ya cacheado; syncDown no envía el contenido del documento.
        content: existingById.get(Number(doc.id))?.content ?? null,
        is_locked: doc.is_locked ? 1 : 0,
        locked_by: doc.locked_by || null,
        locker_name: doc.locker?.name || null,
        created_at: doc.created_at || null,
        updated_at: doc.updated_at || null,
        latest_version_number: doc.latest_version?.version_number || null,
        latest_version_created_by: doc.latest_version?.created_by || null,
        latest_version_creator_name: doc.latest_version?.creator?.name || null,
        latest_version_creator_tag: doc.latest_version?.creator?.tag || null,
        data_json: JSON.stringify(doc),
        synced_at: new Date().toISOString(),
    };
}

/**
 * Construye una fila de caché para la tabla `events` a partir de un objeto de la API.
 */
function buildEventCacheRow(event) {
    return {
        id: event.id,
        agenda_id: event.agenda_id || null,
        case_id: event.case_id || null,
        suit_case_id: event.suit_case_id || null,
        event_type_id: event.event_type_id || 1,
        title: event.title || null,
        description: event.description || null,
        starts_at: event.starts_at || null,
        is_all_day: event.is_all_day ? 1 : 0,
        data_json: JSON.stringify(event),
        synced_at: new Date().toISOString(),
    };
}

/**
 * Construye una fila de caché para la tabla `clients` a partir de un objeto de la API.
 */
function buildClientCacheRow(client) {
    return {
        id: client.id,
        first_name: client.first_name || null,
        last_name: client.last_name || null,
        identification_number: client.identification_number || null,
        email: client.email || null,
        phone: client.phone || null,
        address: client.address || null,
        type: client.type || 'person',
        gender: client.gender || 'X',
        status: client.status || 'active',
        financial_status: client.financial_status || null,
        notes: client.notes || null,
        data_json: JSON.stringify(client),
        synced_at: new Date().toISOString(),
    };
}

function buildTipoExpedienteCacheRow(tipo) {
    return {
        id: tipo.id,
        case_type_id: tipo.case_type_id || null,
        title: tipo.title || tipo.titulo || null,
        details: tipo.details || tipo.detalles || null,
        data_json: JSON.stringify(tipo),
        synced_at: new Date().toISOString(),
    };
}

function buildCaseTipoExpedientePivotRow(caseId, tipoExpedienteId) {
    return {
        suit_case_id: Number(caseId),
        tipo_expediente_id: Number(tipoExpedienteId),
    };
}

/**
 * Normaliza arrays de colecciones que la API puede devolver con diferentes estructuras.
 */
function normalizeArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

/**
 * Clasifica las entidades del caso como al-día, stale o sin cache.
 *
 * @param {Object} serverTimestamps - Timestamps del servidor per-entity
 * @param {Object} localMeta - Meta local de case_sync_meta { entity: { last_server } }
 * @returns {{ upToDate: string[], stale: string[], noCache: boolean }}
 */
function classifyEntities(serverTimestamps, localMeta) {
    const entities = ['case', 'partes', 'gastos', 'honorarios', 'documentos', 'eventos', 'clientes', 'multimedia', 'archivos'];
    const upToDate = [];
    const stale = [];

    // Si no hay ninguna entry local para este caso, no hay cache en absoluto.
    const hasAnyLocalMeta = Object.keys(localMeta).length > 0;
    if (!hasAnyLocalMeta) {
        return { upToDate: [], stale: entities, noCache: true };
    }

    for (const entity of entities) {
        const serverTs = serverTimestamps[entity];
        const localEntry = localMeta[entity];
        const localTs = localEntry?.last_server;

        // Si el servidor dice que esta entidad nunca fue modificada, está al día.
        if (!serverTs) {
            upToDate.push(entity);
            continue;
        }

        // Si no tenemos timestamp local para esta entidad, es stale.
        if (!localTs) {
            stale.push(entity);
            continue;
        }

        // Comparar timestamps: si el servidor es más nuevo, está stale.
        if (isServerUpToDate(serverTs, localTs)) {
            upToDate.push(entity);
        } else {
            stale.push(entity);
        }
    }

    return { upToDate, stale, noCache: false };
}

/**
 * Encuentra el timestamp más antiguo entre las entidades stale para usarlo como
 * punto de partida del syncDown. Así la API nos trae todo lo modificado desde
 * la fecha en que dejamos de estar sincronizados.
 *
 * @param {string[]} staleEntities - Entidades desactualizadas
 * @param {Object} localMeta - Meta local { entity: { last_server } }
 * @returns {string} - Fecha a usar en syncDown (ISO o EPOCH_DATE)
 */
function findOldestStaleTimestamp(staleEntities, localMeta) {
    let oldestMs = null;
    let oldestTs = null;

    for (const entity of staleEntities) {
        const localTs = localMeta[entity]?.last_server;
        if (!localTs) continue;

        const ms = parseTimestampToMs(localTs);
        if (ms === null) continue;

        if (oldestMs === null || ms < oldestMs) {
            oldestMs = ms;
            oldestTs = localTs;
        }
    }

    // Si no encontramos ningún timestamp local entre los stale (cache parcial vacía),
    // usamos epoch para traer todo.
    return oldestTs || EPOCH_DATE;
}

/**
 * Persiste los datos de syncDown en SQLite por entidad.
 * Cada entidad tiene su propio builder y lógica de upsert.
 * Los errores por entidad son tolerados — se loguean pero no interrumpen las demás.
 *
 * @param {number} caseId
 * @param {Object} syncDownPayload - Respuesta del endpoint syncDown
 */
async function persistSyncDownData(caseId, syncDownPayload) {
    const api = window.electronAPI;
    if (!api) return;

    const tasks = [];
    const hasTipoExpedientesPayload = Object.prototype.hasOwnProperty.call(syncDownPayload, 'tipo_expedientes');
    const tipoExpedientes = hasTipoExpedientesPayload
        ? normalizeArray(syncDownPayload.tipo_expedientes)
        : [];

    if (hasTipoExpedientesPayload) {
        tasks.push(
            (async () => {
                await api.db.upsertMany('tipo_expedientes', tipoExpedientes.map(buildTipoExpedienteCacheRow));
                await api.db.deleteWhere('case_tipo_expediente', { suit_case_id: caseId });
                await api.db.upsertMany(
                    'case_tipo_expediente',
                    tipoExpedientes.map((tipo) => buildCaseTipoExpedientePivotRow(caseId, tipo.id)),
                );
            })()
        );
    }

    // Caso principal — si el delta trae metadata del expediente, la devolvemos fresca
    // y persistimos una versión mergeada con las relaciones ya cacheadas.
    if (syncDownPayload.case || hasTipoExpedientesPayload) {
        tasks.push(
            (async () => {
                const existingRow = await api.db.getById('cases', caseId);
                const cachedCase = existingRow ? JSON.parse(existingRow.data_json) : {};
                const mergedCase = {
                    ...cachedCase,
                    ...syncDownPayload.case,
                    tipo_expedientes: hasTipoExpedientesPayload ? tipoExpedientes : (syncDownPayload.case?.tipo_expedientes || cachedCase.tipo_expedientes || []),
                    linkedTipoExpedientes: hasTipoExpedientesPayload ? tipoExpedientes : (syncDownPayload.case?.linkedTipoExpedientes || cachedCase.linkedTipoExpedientes || []),
                    // Optional chaining: la API no siempre devuelve una clave 'case' en el payload
                    // de syncDown (ej: cuando solo vienen tipo_expedientes). Sin ?. se tiraría
                    // un TypeError que silenciaría todo el bloque y descartaría los tipo_expedientes.
                    linkedParticipants: syncDownPayload.case?.linkedParticipants || cachedCase.linkedParticipants || [],
                    linkedClients: syncDownPayload.case?.linkedClients || cachedCase.linkedClients || [],
                    linkedParties: syncDownPayload.case?.linkedParties || cachedCase.linkedParties || [],
                };

                await api.db.upsertMany('cases', [buildCaseCacheRow(mergedCase)]);
                syncDownPayload.case = mergedCase;
            })()
        );
    }

    // Honorarios
    const honorarios = normalizeArray(syncDownPayload.honorarios);
    if (honorarios.length > 0) {
        tasks.push(
            api.db.upsertMany('honorarios', honorarios.map(buildHonorarioCacheRow))
                .catch((err) => logger.warn('persist honorarios failed', { caseId, error: err?.message }))
        );
    }

    // Gastos
    const gastos = normalizeArray(syncDownPayload.gastos);
    if (gastos.length > 0) {
        tasks.push(
            api.db.upsertMany('gasto_suit_cases', gastos.map(buildGastoCacheRow))
                .catch((err) => logger.warn('persist gastos failed', { caseId, error: err?.message }))
        );
    }

    // Entregas — se reciben anidadas dentro de honorarios si los trae el server,
    // o como array propio si el syncDown las separa. Toleramos ambos formatos.
    const entregas = normalizeArray(syncDownPayload.entregas);
    if (entregas.length > 0) {
        tasks.push(
            api.db.upsertMany('entregas', entregas.map(buildEntregaCacheRow))
                .catch((err) => logger.warn('persist entregas failed', { caseId, error: err?.message }))
        );
    }

    // Partes — upsert en directorio global `partes` + reemplazar pivot `parte_caso` para este caso.
    const partes = normalizeArray(syncDownPayload.partes);
    if (partes.length > 0) {
        tasks.push(
            (async () => {
                try {
                    const parteRows = partes.map(buildParteCacheRow).filter(Boolean);
                    if (parteRows.length > 0) {
                        await api.db.upsertMany('partes', parteRows);
                    }
                    // Reemplazar pivot de forma atómica scoped al caso (evita afectar otros casos).
                    await api.db.deleteWhere('parte_caso', { suit_case_id: caseId });
                    const pivotRows = partes.map((p) => buildParteCasoRow(p.id, caseId));
                    if (pivotRows.length > 0) {
                        await api.db.upsertMany('parte_caso', pivotRows);
                    }
                } catch (err) {
                    logger.warn('persist partes failed', { caseId, error: err?.message });
                }
            })()
        );
    }

    // Documentos — preserva content HTML ya cacheado localmente.
    const documentos = normalizeArray(syncDownPayload.documentos);
    if (documentos.length > 0) {
        tasks.push(
            (async () => {
                try {
                    const existingRows = await api.db.getAll('documents');
                    const existingById = new Map(existingRows.map((r) => [Number(r.id), r]));
                    const rows = documentos.map((d) => buildDocumentCacheRow(d, existingById));
                    await api.db.upsertMany('documents', rows);
                } catch (err) {
                    logger.warn('persist documentos failed', { caseId, error: err?.message });
                }
            })()
        );
    }

    // Eventos — upsert idempotente por PK, compatible con agendaMonthSync.
    const eventos = normalizeArray(syncDownPayload.eventos);
    if (eventos.length > 0) {
        tasks.push(
            api.db.upsertMany('events', eventos.map(buildEventCacheRow))
                .catch((err) => logger.warn('persist eventos failed', { caseId, error: err?.message }))
        );
    }

    // Clientes — upsert en directorio global de clientes + tabla pivot case_client scoped al caso.
    // La pivot se reemplaza atómicamente para reflejar el estado actual de asociación del servidor.
    const clientes = normalizeArray(syncDownPayload.clientes);
    tasks.push(
        (async () => {
            try {
                if (clientes.length > 0) {
                    await api.db.upsertMany('clients', clientes.map(buildClientCacheRow));
                }
                // Reemplazar pivot scoped al caso (igual que parte_caso).
                await api.db.deleteWhere('case_client', { suit_case_id: caseId });
                const pivotRows = clientes.map((c) => ({ suit_case_id: caseId, client_id: c.id }));
                if (pivotRows.length > 0) {
                    await api.db.upsertMany('case_client', pivotRows);
                }
            } catch (err) {
                logger.warn('persist clientes failed', { caseId, error: err?.message });
            }
        })()
    );

    // Multimedia
    const multimedia = normalizeArray(syncDownPayload.multimedia);
    if (multimedia.length > 0) {
        const rows = multimedia.map(buildMultimediaCacheRow).filter(Boolean);
        tasks.push(
            api.db.upsertMany('multimedia', rows)
                .catch((err) => logger.warn('persist multimedia failed', { caseId, error: err?.message }))
        );
    }

    // Archivos (files)
    const archivos = normalizeArray(syncDownPayload.archivos);
    if (archivos.length > 0) {
        const rows = archivos.map(buildFileCacheRow).filter(Boolean);
        tasks.push(
            api.db.upsertMany('files', rows)
                .catch((err) => logger.warn('persist archivos failed', { caseId, error: err?.message }))
        );
    }

    await Promise.all(tasks);
}

/**
 * Actualiza case_sync_meta con los timestamps del servidor para cada entidad.
 * Solo actualiza las entidades que el servidor reporta con timestamp (no null).
 *
 * @param {number} caseId
 * @param {Object} serverTimestamps - Timestamps del servidor per-entity
 */
async function updateCaseSyncMeta(caseId, serverTimestamps) {
    const api = window.electronAPI;
    if (!api) return;

    const now = new Date().toISOString();
    const entities = ['partes', 'gastos', 'honorarios', 'documentos', 'eventos', 'clientes', 'multimedia', 'archivos', 'case'];
    const entries = [];

    for (const entity of entities) {
        const serverTs = serverTimestamps[entity];
        // Guardamos aunque sea null — indica que la entidad fue consultada y estaba vacía.
        entries.push({ entity, lastSync: now, lastServer: serverTs || null });
    }

    try {
        await api.sync.setCaseMetaBatch(caseId, entries);
    } catch (err) {
        logger.warn('updateCaseSyncMeta failed', { caseId, error: err?.message });
    }
}

/**
 * Sincroniza los sub-recursos de un caso individual usando el endpoint per-entity last-modified
 * y syncDown si hay cambios.
 *
 * Flujo:
 * 1. GET /cases/{id}/last-modified → serverTimestamps
 * 2. Lee case_sync_meta local → localMeta
 * 3. Clasifica entidades en upToDate / stale / noCache
 * 4. Si todo al día → retorna { changed: false }
 * 5. Si hay stale → getCaseSyncDown(caseId, oldestStaleDate) → payload
 * 6. Persiste en SQLite en background (fire-and-forget)
 * 7. Actualiza case_sync_meta
 * 8. Retorna { changed: true, data: payload }
 *
 * @param {number} caseId
 * @returns {Promise<{ changed: boolean, data: Object|null, staleEntities: string[] }>}
 */
export async function syncCaseDown(caseId) {
    // Deduplicación: si ya hay un sync en curso para este caso, reusar la misma Promise.
    if (syncInFlightByCaseId.has(caseId)) {
        logger.info('sync already in flight, deduplicating', { caseId });
        return syncInFlightByCaseId.get(caseId);
    }

    const syncPromise = (async () => {
        logger.info('sync start', { caseId });

        if (!window.electronAPI) {
            logger.warn('electronAPI not available, skipping', { caseId });
            return { changed: false, data: null, staleEntities: [] };
        }

        try {
            // 1. Obtener timestamps del servidor
            const serverTimestamps = await getCaseLastModified(caseId);
            if (!serverTimestamps) {
                logger.warn('could not fetch last-modified, skipping sync', { caseId });
                return { changed: false, data: null, staleEntities: [] };
            }

            // 2. Leer meta local
            const localMeta = await window.electronAPI.sync.getCaseMeta(caseId);

            // 3. Clasificar entidades
            const { upToDate, stale, noCache } = classifyEntities(serverTimestamps, localMeta);
            logger.info('classification', { caseId, upToDate: upToDate.length, stale: stale.length, noCache });

            // 4. Todo al día → no hacer nada
            if (stale.length === 0) {
                logger.info('all entities up-to-date, using cache', { caseId });
                return { changed: false, data: null, staleEntities: [] };
            }

            // 5. Determinar la fecha de corte para syncDown
            // noCache → traemos todo desde epoch; stale parcial → desde el más viejo de los stale.
            const sinceDate = noCache ? EPOCH_DATE : findOldestStaleTimestamp(stale, localMeta);
            logger.info('fetching syncDown', { caseId, sinceDate, staleCount: stale.length });

            const syncDownData = await getCaseSyncDown(caseId, sinceDate);
            if (!syncDownData) {
                logger.warn('syncDown returned null, skipping persist', { caseId });
                return { changed: false, data: null, staleEntities: stale };
            }

            // Inyectar flag is_new para que el frontend pueda identificar items nuevos.
            ['documentos', 'eventos', 'multimedia', 'archivos'].forEach((key) => {
                if (syncDownData[key] && Array.isArray(syncDownData[key])) {
                    syncDownData[key].forEach((item) => {
                        item.is_new = true;
                    });
                }
            });

            // 7. Persistimos antes de resolver para que overview y agenda del caso
            // lean una cache coherente apenas termina el chequeo de frescura.
            await persistSyncDownData(caseId, syncDownData);
            logger.info('persist complete', { caseId });

            // 7. Actualizar case_sync_meta con los timestamps del servidor
            await updateCaseSyncMeta(caseId, serverTimestamps);

            logger.info('sync complete', { caseId, changed: true });
            return { changed: true, data: syncDownData, staleEntities: stale };
        } catch (err) {
            logger.warn('sync failed', { caseId, error: err?.message });
            return { changed: false, data: null, staleEntities: [] };
        }
    })().finally(() => {
        syncInFlightByCaseId.delete(caseId);
    });

    syncInFlightByCaseId.set(caseId, syncPromise);
    return syncPromise;
}

/**
 * Limpia la case_sync_meta de un caso (útil al cerrar sesión o al resetear cache).
 * @param {number} caseId
 */
export async function clearCaseSyncDownMeta(caseId) {
    if (!window.electronAPI) return;
    try {
        await window.electronAPI.sync.clearCaseMeta(caseId);
    } catch (err) {
        logger.warn('clearCaseSyncDownMeta failed', { caseId, error: err?.message });
    }
}
