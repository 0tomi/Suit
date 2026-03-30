import { createLogger } from './logService.js';

const logger = createLogger('partes-listing-backend-service');

function getBackend() {
    const backend = window.electronAPI?.partes;
    if (!backend?.getListingPage || !backend?.invalidateListingCache) {
        throw new Error('El backend de listado de partes no está disponible en este entorno.');
    }
    return backend;
}

export async function getPartesListingPage(options = {}) {
    try {
        return await getBackend().getListingPage(options);
    } catch (error) {
        void logger.error('getPartesListingPage failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function invalidatePartesListingCache() {
    try {
        return await getBackend().invalidateListingCache();
    } catch (error) {
        void logger.warn('invalidatePartesListingCache failed', {
            error: error?.message || String(error),
        });
        return { ok: false, error: error?.message || String(error) };
    }
}
