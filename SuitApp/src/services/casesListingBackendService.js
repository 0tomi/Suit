import { createLogger } from './logService.js';

const logger = createLogger('cases-listing-backend-service');

function getBackend() {
    const backend = window.electronAPI?.cases;
    if (!backend?.getListingPage || !backend?.invalidateListingCache) {
        throw new Error('El backend de listado de casos no está disponible en este entorno.');
    }

    return backend;
}

export async function getCasesListingPage(options = {}) {
    try {
        return await getBackend().getListingPage(options);
    } catch (error) {
        void logger.error('getCasesListingPage failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function invalidateCasesListingCache() {
    try {
        return await getBackend().invalidateListingCache();
    } catch (error) {
        void logger.warn('invalidateCasesListingCache failed', {
            error: error?.message || String(error),
        });
        return { ok: false, error: error?.message || String(error) };
    }
}
