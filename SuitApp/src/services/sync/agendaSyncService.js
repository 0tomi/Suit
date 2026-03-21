import { syncResource } from './syncCore.js';
import { getAgendas } from '../agendaService.js';
import { extractMetadataCollection, summarizePayload } from '../metadata/metadataCacheUtils.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:agendas');

export async function syncAgendas() {
    return await syncResource('agendas', '/agendas/last-modified', fetchAndCacheAgendas);
}

async function fetchAndCacheAgendas() {
    logger.info('fetch start');
    const rawAgendas = await getAgendas();
    
    logger.info('response received', { payload: summarizePayload(rawAgendas) });
    
    const items = extractMetadataCollection(rawAgendas, 'agendas') || [];
    logger.info('extracted items', { count: items.length });
    const rows = items.map(a => ({
        id: a.id,
        name: a.name,
        color: a.color || null,
        suit_case_id: a.suit_case_id || null,
        user_id: a.user_id || null,
        data_json: JSON.stringify(a),
        synced_at: new Date().toISOString(),
    }));
    logger.info('mapped rows', { rowCount: rows.length });

    await window.electronAPI.db.clearTable('agendas');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('agendas', rows);
    } else {
        logger.warn('API returned 0 rows; cache cleared');
    }

    return true;
}

export default { syncAgendas };
