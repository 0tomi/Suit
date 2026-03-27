const {
    listClientsFromApi,
    getClientsLastModifiedFromApi,
    getClientsDeltaFromApi,
} = require('./clientsApi.cjs');
const {
    listCachedClients,
    upsertCachedClients,
    deleteCachedClientsByIds,
    reconcileFullClientSet,
    getClientsSyncMeta,
    setClientsSyncMeta,
} = require('./clientsRepository.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('clients:sync');

function extractCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.clients)) return payload.clients;
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
        || Array.isArray(payload?.clients)
        || Array.isArray(payload?.data)
        || Array.isArray(payload?.items);
}

function isDeletedClient(client) {
    return Boolean(client?.deleted_at || client?.deleted === true);
}

/**
 * Primera carga o fallback de sync: obtiene todas las páginas y reconcilia la caché local.
 */
async function performFullClientsSync() {
    logger.info('starting full clients sync');
    let page = 1;
    let hasMore = true;
    const allClients = [];

    while (hasMore) {
        const response = await listClientsFromApi({ page });
        if (!response.ok) {
            logger.error('full clients sync page failed', {
                page,
                status: response.status,
                error: response.error || null,
                data: response.data,
            });
            throw new Error(`No se pudo sincronizar la página ${page} de clientes.`);
        }

        const currentPageItems = extractCollection(response.data);
        if (!hasRecognizedCollectionShape(response.data)) {
            logger.error('full clients sync received invalid payload shape', {
                page,
                data: response.data,
            });
            throw new Error('La API devolvió un payload inválido durante la sincronización completa de clientes.');
        }
        allClients.push(...currentPageItems);

        const meta = extractPaginationMeta(response.data);
        hasMore = Boolean(meta && meta.current_page < meta.last_page);
        page += 1;
    }

    reconcileFullClientSet(allClients);
    logger.info('full clients sync completed', { rowCount: allClients.length });
    return { changed: true, strategy: 'full', count: allClients.length };
}

/**
 * Sync incremental: aplica solo altas, cambios y eliminaciones reportadas desde `since`.
 */
async function performDeltaClientsSync(since) {
    logger.info('starting delta clients sync', { since });
    const response = await getClientsDeltaFromApi(since);
    if (!response.ok) {
        logger.error('delta clients sync failed', {
            since,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        throw new Error('No se pudo sincronizar el delta de clientes.');
    }

    const changedClients = extractCollection(response.data);
    if (!hasRecognizedCollectionShape(response.data)) {
        logger.error('delta clients sync received invalid payload shape', {
            since,
            data: response.data,
        });
        throw new Error('La API devolvió un payload inválido durante el delta de clientes.');
    }
    if (changedClients.length === 0) {
        logger.info('delta clients sync returned no changes', { since });
        return { changed: false, strategy: 'delta', count: 0 };
    }

    const idsToDelete = [];
    const clientsToUpsert = [];

    for (const client of changedClients) {
        if (isDeletedClient(client)) {
            idsToDelete.push(Number(client.id));
            continue;
        }
        clientsToUpsert.push(client);
    }

    if (clientsToUpsert.length > 0) {
        upsertCachedClients(clientsToUpsert);
    }
    if (idsToDelete.length > 0) {
        deleteCachedClientsByIds(idsToDelete);
    }

    logger.info('delta clients sync applied', {
        changedCount: changedClients.length,
        upsertCount: clientsToUpsert.length,
        deleteCount: idsToDelete.length,
    });

    return { changed: true, strategy: 'delta', count: changedClients.length };
}

/**
 * Decide entre no-op, sync incremental o recarga completa usando `last-modified`.
 */
async function syncClientsCache() {
    const cachedClients = listCachedClients();
    const syncMeta = getClientsSyncMeta();
    const lastModifiedResponse = await getClientsLastModifiedFromApi();

    if (!lastModifiedResponse.ok) {
        logger.error('clients last-modified request failed', {
            status: lastModifiedResponse.status,
            error: lastModifiedResponse.error || null,
            data: lastModifiedResponse.data,
        });
        throw new Error('No se pudo verificar la última modificación de clientes.');
    }

    const lastServer = lastModifiedResponse.data?.last_modified;
    if (lastServer == null) {
        logger.info('clients last-modified returned null; remote collection is empty', {
            cachedCount: cachedClients.length,
            previousLastServer: syncMeta?.last_server ?? null,
        });

        if (cachedClients.length > 0) {
            const localIds = cachedClients
                .map((client) => Number(client.id))
                .filter((clientId) => Number.isInteger(clientId) && clientId > 0);

            if (localIds.length > 0) {
                deleteCachedClientsByIds(localIds);
                logger.info('cleared local clients cache because server reported an empty collection', {
                    deletedCount: localIds.length,
                });
            }
        }

        setClientsSyncMeta(new Date().toISOString(), null);
        return {
            ok: true,
            changed: cachedClients.length > 0,
            strategy: 'empty-remote',
            count: 0,
            lastServer: null,
        };
    }

    let result;
    if (cachedClients.length === 0 || !syncMeta?.last_server) {
        result = await performFullClientsSync();
    } else if (syncMeta.last_server === lastServer) {
        logger.info('clients cache is already up to date', { lastServer });
        result = { changed: false, strategy: 'noop', count: cachedClients.length };
    } else {
        try {
            result = await performDeltaClientsSync(syncMeta.last_server);
        } catch (error) {
            logger.warn('delta clients sync failed, falling back to full sync', {
                lastServer,
                previousLastServer: syncMeta.last_server,
                error: error?.message || String(error),
            });
            result = await performFullClientsSync();
        }
    }

    setClientsSyncMeta(new Date().toISOString(), lastServer);
    return {
        ok: true,
        ...result,
        lastServer,
    };
}

module.exports = {
    syncClientsCache,
};
