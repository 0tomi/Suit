import { createLogger } from '../logService.js';

const logger = createLogger('sync:partes');

export async function syncPartes() {
    const partesApi = window.electronAPI?.partes;
    if (!partesApi?.sync) {
        const error = new Error('El backend interno de partes no está disponible para sincronizar.');
        logger.error('partes sync backend unavailable');
        throw error;
    }

    const result = await partesApi.sync();
    if (!result?.ok) {
        logger.error('partes backend sync failed', result);
        throw new Error(result?.error || 'No se pudo sincronizar partes.');
    }

    logger.info('partes backend sync completed', {
        changed: result.changed,
        strategy: result.strategy,
        count: result.count,
        lastServer: result.lastServer,
    });

    return Boolean(result.changed);
}

export default { syncPartes };
