import { createLogger } from './logService.js';

const logger = createLogger('document-listing-backend-service');

function getBackend() {
    const backend = window.electronAPI?.documents;
    if (!backend?.getListingPage) {
        throw new Error('El backend de listado de documentos no está disponible en este entorno.');
    }
    return backend;
}

export async function getDocumentListingPage(options = {}) {
    try {
        return await getBackend().getListingPage(options);
    } catch (error) {
        void logger.error('getDocumentListingPage failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function invalidateDocumentListingCache() {
    const backend = window.electronAPI?.documents;
    if (!backend?.invalidateListingCache) return { ok: false };

    try {
        return await backend.invalidateListingCache();
    } catch (error) {
        void logger.warn('invalidateDocumentListingCache failed', {
            error: error?.message || String(error),
        });
        return { ok: false, error: error?.message || String(error) };
    }
}
