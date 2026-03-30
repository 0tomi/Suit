import { createLogger } from './logService.js';

const logger = createLogger('clients-listing-backend-service');

function getBackend() {
    const backend = window.electronAPI?.clients;
    if (!backend?.getListingPage || !backend?.invalidateListingCache) {
        throw new Error('El backend de listado de clientes no está disponible en este entorno.');
    }

    return backend;
}

export async function getClientsListingPage(options = {}) {
    try {
        return await getBackend().getListingPage(options);
    } catch (error) {
        void logger.error('getClientsListingPage failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function invalidateClientsListingCache() {
    try {
        return await getBackend().invalidateListingCache();
    } catch (error) {
        void logger.warn('invalidateClientsListingCache failed', {
            error: error?.message || String(error),
        });
        return { ok: false, error: error?.message || String(error) };
    }
}
