import { createLogger } from './logService.js';

const logger = createLogger('economia-listing-backend-service');

function getBackend() {
    const backend = window.electronAPI?.economia;
    if (!backend?.getHonorariosListingPage || !backend?.getGastosListingPage) {
        throw new Error('El backend de economía no está disponible en este entorno.');
    }
    return backend;
}

function normalizeListingResponse(payload) {
    const response = payload && typeof payload === 'object' ? payload : {};
    const items = Array.isArray(response.items) ? response.items : [];
    return {
        items,
        page: Number(response.page ?? 1) || 1,
        total: Number(response.total ?? response.totalDocuments ?? items.length) || 0,
        totalPages: Math.max(1, Number(response.totalPages ?? 1) || 1),
        perPage: Math.max(1, Number(response.perPage ?? 30) || 30),
        source: response.source || 'cache',
        appliedLocalFilters: Boolean(response.appliedLocalFilters),
    };
}

function normalizeStatsCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

export async function getHonorariosListingPage(options = {}) {
    try {
        const response = await getBackend().getHonorariosListingPage(options);
        return normalizeListingResponse(response);
    } catch (error) {
        void logger.error('getHonorariosListingPage failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function getGastosListingPage(options = {}) {
    try {
        const response = await getBackend().getGastosListingPage(options);
        return normalizeListingResponse(response);
    } catch (error) {
        void logger.error('getGastosListingPage failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function getHonorariosStats(options = {}) {
    try {
        const response = await getBackend().getHonorariosStats(options);
        return normalizeStatsCollection(response);
    } catch (error) {
        void logger.error('getHonorariosStats failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function getGastosStats(options = {}) {
    try {
        const response = await getBackend().getGastosStats(options);
        return normalizeStatsCollection(response);
    } catch (error) {
        void logger.error('getGastosStats failed', {
            error: error?.message || String(error),
            options,
        });
        throw error;
    }
}

export async function invalidateEconomiaListingCache() {
    const backend = window.electronAPI?.economia;
    if (!backend?.invalidateListingCache) return { ok: false };

    try {
        return await backend.invalidateListingCache();
    } catch (error) {
        void logger.warn('invalidateEconomiaListingCache failed', {
            error: error?.message || String(error),
        });
        return { ok: false, error: error?.message || String(error) };
    }
}
