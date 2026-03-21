import { getOpenCases } from '../caseService.js';
import { syncResource } from './syncCore.js';
import { buildCaseCacheRow } from '../cache/caseCacheRow.js';
import { extractMetadataCollection, summarizePayload } from '../metadata/metadataCacheUtils.js';
import { createLogger } from '../logService.js';

const logger = createLogger('sync:cases');

export async function syncCases() {
    return await syncResource('cases', '/cases/last-modified', fetchAndCacheCases);
}

async function fetchAndCacheCases() {
    logger.info('fetch start');
    const cases = await getOpenCases();
    
    logger.info('response received', { payload: summarizePayload(cases) });

    const items = extractMetadataCollection(cases, 'cases') || [];
    logger.info('extracted items', { count: items.length });
    const rows = items.map(buildCaseCacheRow).filter(Boolean);
    logger.info('mapped rows', { rowCount: rows.length });

    await window.electronAPI.db.clearTable('cases');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('cases', rows);
    } else {
        logger.warn('API returned 0 rows; cache cleared');
    }
}

export default { syncCases };
