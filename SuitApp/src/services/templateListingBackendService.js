import { createLogger } from './logService.js';

const logger = createLogger('template-listing-backend-service');

function getBackend() {
    const backend = window.electronAPI?.templates;
    if (!backend?.getListingPage) {
        throw new Error('El backend de listado de plantillas no está disponible en este entorno.');
    }
    return backend;
}

export async function getTemplateListingPage(options = {}) {
    try {
        return await getBackend().getListingPage(options);
    } catch (error) {
        void logger.error('getTemplateListingPage failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function invalidateTemplateListingCache() {
    const backend = window.electronAPI?.templates;
    if (!backend?.invalidateListingCache) return { ok: false };

    try {
        return await backend.invalidateListingCache();
    } catch (error) {
        void logger.warn('invalidateTemplateListingCache failed', {
            error: error?.message || String(error),
        });
        return { ok: false, error: error?.message || String(error) };
    }
}
