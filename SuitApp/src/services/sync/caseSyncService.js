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

    // La API no devuelve tipo_expedientes en GET /cases/open.
    // Antes de limpiar la tabla, preservamos los que ya teníamos cacheados
    // (guardados en data_json al crear/editar el caso) para no perderlos en cada sync.
    const existingRows = await window.electronAPI.db.getAll('cases').catch(() => []);
    const tiposByCase = new Map();
    for (const row of (existingRows || [])) {
        if (!row.data_json) continue;
        try {
            const parsed = JSON.parse(row.data_json);
            const tipos = parsed?.linkedTipoExpedientes;
            if (Array.isArray(tipos) && tipos.length > 0) {
                tiposByCase.set(String(row.id), tipos);
            }
        } catch { /* ignorar filas con data_json inválido */ }
    }

    const rows = items.map((item) => {
        const row = buildCaseCacheRow(item);
        if (!row) return null;
        const tipos = tiposByCase.get(String(row.id));
        if (!tipos) return row;
        // Mergear tipos preservados en data_json para que CaseDetailTabContent los lea
        try {
            const merged = { ...JSON.parse(row.data_json), linkedTipoExpedientes: tipos };
            return { ...row, data_json: JSON.stringify(merged) };
        } catch { return row; }
    }).filter(Boolean);

    logger.info('mapped rows', { rowCount: rows.length });

    await window.electronAPI.db.clearTable('cases');
    if (rows.length > 0) {
        await window.electronAPI.db.upsertMany('cases', rows);
    } else {
        logger.warn('API returned 0 rows; cache cleared');
    }
}

export default { syncCases };
