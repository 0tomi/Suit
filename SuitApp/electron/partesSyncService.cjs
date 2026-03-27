const {
    listPartesFromApi,
    getPartesLastModifiedFromApi,
    getPartesDeltaFromApi,
} = require('./partesApi.cjs');
const {
    listCachedPartes,
    upsertCachedPartes,
    deleteCachedPartesByIds,
    reconcileFullParteSet,
    getPartesSyncMeta,
    setPartesSyncMeta,
} = require('./partesRepository.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('partes:sync');

function extractCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.partes)) return payload.partes;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    return [];
}

function extractPaginationMeta(payload) {
    if (!payload || typeof payload !== 'object') return null;
    return payload.meta || payload.data?.meta || null;
}

function hasRecognizedCollectionShape(payload) {
    return Array.isArray(payload)
        || Array.isArray(payload?.partes)
        || Array.isArray(payload?.data)
        || Array.isArray(payload?.items);
}

function extractLastModified(payload) {
    if (typeof payload === 'string') return payload;
    if (!payload || typeof payload !== 'object') return null;
    return payload.last_modified ?? payload.lastModified ?? null;
}

function isDeletedParte(parte) {
    return Boolean(parte?.deleted_at || parte?.deleted === true);
}

/**
 * Primera carga o fallback de sync: obtiene todas las páginas y reconcilia la caché local.
 */
async function performFullPartesSync() {
    logger.info('starting full partes sync');
    let page = 1;
    let hasMore = true;
    const allPartes = [];

    while (hasMore) {
        const response = await listPartesFromApi({ page });
        if (!response.ok) {
            logger.error('full partes sync page failed', {
                page,
                status: response.status,
                error: response.error || null,
                data: response.data,
            });
            throw new Error(`No se pudo sincronizar la página ${page} de partes.`);
        }

        const currentPageItems = extractCollection(response.data);
        if (!hasRecognizedCollectionShape(response.data)) {
            logger.error('full partes sync received invalid payload shape', {
                page,
                data: response.data,
            });
            throw new Error('La API devolvió un payload inválido durante la sincronización completa de partes.');
        }
        allPartes.push(...currentPageItems);

        const meta = extractPaginationMeta(response.data);
        hasMore = Boolean(meta && meta.current_page < meta.last_page);
        if (!meta) {
            hasMore = false;
        }
        page += 1;
    }

    reconcileFullParteSet(allPartes);
    logger.info('full partes sync completed', { rowCount: allPartes.length });
    return { changed: true, strategy: 'full', count: allPartes.length };
}

/**
 * Sync incremental: aplica solo altas, cambios y eliminaciones reportadas desde `since`.
 */
async function performDeltaPartesSync(since) {
    logger.info('starting delta partes sync', { since });
    const response = await getPartesDeltaFromApi(since);
    if (!response.ok) {
        logger.error('delta partes sync failed', {
            since,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        throw new Error('No se pudo sincronizar el delta de partes.');
    }

    const changedPartes = extractCollection(response.data);
    if (!hasRecognizedCollectionShape(response.data)) {
        logger.error('delta partes sync received invalid payload shape', {
            since,
            data: response.data,
        });
        throw new Error('La API devolvió un payload inválido durante el delta de partes.');
    }
    if (changedPartes.length === 0) {
        logger.info('delta partes sync returned no changes', { since });
        return { changed: false, strategy: 'delta', count: 0 };
    }

    const idsToDelete = [];
    const partesToUpsert = [];

    for (const parte of changedPartes) {
        if (isDeletedParte(parte)) {
            idsToDelete.push(Number(parte.id));
            continue;
        }
        partesToUpsert.push(parte);
    }

    if (partesToUpsert.length > 0) {
        upsertCachedPartes(partesToUpsert);
    }
    if (idsToDelete.length > 0) {
        deleteCachedPartesByIds(idsToDelete);
    }

    logger.info('delta partes sync applied', {
        changedCount: changedPartes.length,
        upsertCount: partesToUpsert.length,
        deleteCount: idsToDelete.length,
    });

    return { changed: true, strategy: 'delta', count: changedPartes.length };
}

/**
 * Decide entre no-op, sync incremental o recarga completa usando `last-modified`.
 */
async function syncPartesCache() {
    const cachedPartes = listCachedPartes();
    const syncMeta = getPartesSyncMeta();
    const lastModifiedResponse = await getPartesLastModifiedFromApi();

    if (!lastModifiedResponse.ok) {
        logger.error('partes last-modified request failed', {
            status: lastModifiedResponse.status,
            error: lastModifiedResponse.error || null,
            data: lastModifiedResponse.data,
        });
        throw new Error('No se pudo verificar la última modificación de partes.');
    }

    const lastServer = extractLastModified(lastModifiedResponse.data);
    if (lastServer == null) {
        logger.info('partes last-modified returned null; remote collection is empty', {
            cachedCount: cachedPartes.length,
            previousLastServer: syncMeta?.last_server ?? null,
        });

        if (cachedPartes.length > 0) {
            const localIds = cachedPartes
                .map((parte) => Number(parte.id))
                .filter((parteId) => Number.isInteger(parteId) && parteId > 0);

            if (localIds.length > 0) {
                deleteCachedPartesByIds(localIds);
                logger.info('cleared local partes cache because server reported an empty collection', {
                    deletedCount: localIds.length,
                });
            }
        }

        setPartesSyncMeta(new Date().toISOString(), null);
        return {
            ok: true,
            changed: cachedPartes.length > 0,
            strategy: 'empty-remote',
            count: 0,
            lastServer: null,
        };
    }

    let result;
    if (cachedPartes.length === 0 || !syncMeta?.last_server) {
        result = await performFullPartesSync();
    } else if (syncMeta.last_server === lastServer) {
        logger.info('partes cache is already up to date', { lastServer });
        result = { changed: false, strategy: 'noop', count: cachedPartes.length };
    } else {
        try {
            result = await performDeltaPartesSync(syncMeta.last_server);
        } catch (error) {
            logger.warn('delta partes sync failed, falling back to full sync', {
                lastServer,
                previousLastServer: syncMeta.last_server,
                error: error?.message || String(error),
            });
            result = await performFullPartesSync();
        }
    }

    setPartesSyncMeta(new Date().toISOString(), lastServer);
    return {
        ok: true,
        ...result,
        lastServer,
    };
}

module.exports = {
    syncPartesCache,
};
