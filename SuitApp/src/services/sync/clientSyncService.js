import { syncResource } from './syncCore.js';
import { getClients } from '../clientService.js';
import { extractMetadataCollection, summarizePayload } from '../metadata/metadataCacheUtils.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:clients');

export function buildClientCacheRow(client) {
    return {
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        identification_number: client.identification_number,
        email: client.email,
        phone: client.phone,
        address: client.address,
        type: client.type,
        status: client.status,
        notes: client.notes,
        data_json: JSON.stringify(client),
        synced_at: new Date().toISOString(),
    };
}

export async function syncClients() {
    return await syncResource('clients', '/clients/last-modified', fetchAndCacheClients);
}

async function fetchAndCacheClients() {
    logger.info('fetch start (paginated)');
    let allClients = [];
    let page = 1;
    let hasMore = true;

    while (hasMore) {
        logger.info(`fetching page ${page}`);
        const result = await getClients({ page });
        logger.info(`page ${page} response`, { payload: summarizePayload(result) });
        
        if (!result || !result.data) {
            logger.warn(`page ${page} returned empty or without data`);
            break;
        }

        // Backend responses differ depending on pagination structure
        const currentData = extractMetadataCollection(result.data, 'clients') || [];
        logger.info(`page ${page} extracted items`, { count: currentData.length });
        
        allClients = allClients.concat(currentData);

        // Check if there are more pages based on Laravel pagination meta
        const meta = result.meta || (result.data && result.data.meta);
        if (meta && meta.current_page < meta.last_page) {
            page++;
        } else {
            hasMore = false;
        }
    }

    const rows = allClients.map(buildClientCacheRow);
    logger.info('mapped rows', { rowCount: rows.length });

    await window.electronAPI.db.clearTable('clients');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('clients', rows);
    } else {
        logger.warn('API returned 0 rows across all pages; cache cleared');
    }
}

export default { syncClients };
