import { syncResource } from './syncCore.js';
import { getAllUsers } from '../userService.js';
import { extractMetadataCollection, summarizePayload } from '../metadata/metadataCacheUtils.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:users');

export async function syncUsers() {
    return await syncResource('users', '/users/last-modified', fetchAndCacheUsers);
}

async function fetchAndCacheUsers() {
    logger.info('fetch start');
    const users = await getAllUsers();
    
    logger.info('response received', { payload: summarizePayload(users) });

    const items = extractMetadataCollection(users, 'users') || [];
    logger.info('extracted items', { count: items.length });
    const rows = items.map(u => ({
        id: u.id,
        name: u.name,
        email: u.email,
        role: u.role,
        tag: u.tag,
        synced_at: new Date().toISOString(),
    }));
    logger.info('mapped rows', { rowCount: rows.length });

    await window.electronAPI.db.clearTable('users');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('users', rows);
    } else {
        logger.warn('API returned 0 rows; cache cleared');
    }
}

export default { syncUsers };
