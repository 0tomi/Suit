const {
    getAll,
    getById,
    upsertMany,
    deleteById,
    getSyncMeta,
    setSyncMeta,
} = require('./database.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('clients:repository');

function extractClientPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.id != null) return payload;
    if (payload.data && typeof payload.data === 'object') return payload.data;
    if (payload.client && typeof payload.client === 'object') return payload.client;
    return null;
}

function hydrateClientRow(row) {
    if (!row || typeof row !== 'object') return null;
    if (!row.data_json) return row;

    try {
        const full = JSON.parse(row.data_json);
        return { ...row, ...full };
    } catch (error) {
        logger.warn('failed to parse client row data_json', {
            clientId: row.id,
            error: error?.message || String(error),
        });
        return row;
    }
}

/**
 * Convierte el cliente remoto a una fila apta para SQLite.
 * Si llega una respuesta parcial, reutiliza el snapshot previo para no perder datos.
 */
function buildClientCacheRow(client, existingClient = null) {
    const normalized = extractClientPayload(client);
    const fallback = hydrateClientRow(extractClientPayload(existingClient) || existingClient || null);
    const clientId = Number(normalized?.id ?? fallback?.id);

    if (!Number.isInteger(clientId) || clientId < 1) {
        logger.error('cannot build client cache row without valid id', {
            providedClient: client,
            existingClient,
        });
        throw new Error('No se pudo construir la fila de caché de cliente sin un id válido.');
    }

    const merged = {
        ...(fallback || {}),
        ...(normalized || {}),
        id: clientId,
    };

    return {
        id: clientId,
        first_name: merged.first_name ?? null,
        last_name: merged.last_name ?? null,
        identification_number: merged.identification_number ?? null,
        email: merged.email ?? null,
        phone: merged.phone ?? null,
        address: merged.address ?? null,
        type: merged.type ?? 'person',
        gender: merged.gender ?? 'X',
        status: merged.status ?? 'active',
        financial_status: merged.financial_status ?? null,
        notes: merged.notes ?? null,
        data_json: JSON.stringify(merged),
        synced_at: new Date().toISOString(),
    };
}

function listCachedClients() {
    return getAll('clients').map(hydrateClientRow);
}

function getCachedClientById(id) {
    return hydrateClientRow(getById('clients', id));
}

function upsertCachedClients(clients) {
    if (!Array.isArray(clients) || clients.length === 0) return;

    const rows = clients.map((client) => {
        const existing = getCachedClientById(client?.id);
        return buildClientCacheRow(client, existing);
    });

    upsertMany('clients', rows);
}

function deleteCachedClientById(id) {
    deleteById('clients', id);
}

function deleteCachedClientsByIds(ids = []) {
    for (const id of ids) {
        deleteCachedClientById(id);
    }
}

function reconcileFullClientSet(clients) {
    const currentRows = getAll('clients');
    const serverIds = new Set();
    const rows = clients.map((client) => {
        const row = buildClientCacheRow(client, getById('clients', client.id));
        serverIds.add(Number(row.id));
        return row;
    });

    if (rows.length > 0) {
        upsertMany('clients', rows);
    }

    const deletedIds = currentRows
        .map((row) => Number(row.id))
        .filter((clientId) => !serverIds.has(clientId));

    if (deletedIds.length > 0) {
        deleteCachedClientsByIds(deletedIds);
    }
}

function getClientsSyncMeta() {
    return getSyncMeta('clients');
}

function setClientsSyncMeta(lastSync, lastServer) {
    setSyncMeta('clients', lastSync, lastServer);
}

module.exports = {
    extractClientPayload,
    buildClientCacheRow,
    hydrateClientRow,
    listCachedClients,
    getCachedClientById,
    upsertCachedClients,
    deleteCachedClientById,
    deleteCachedClientsByIds,
    reconcileFullClientSet,
    getClientsSyncMeta,
    setClientsSyncMeta,
};
