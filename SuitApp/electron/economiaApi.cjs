const { getConfig } = require('./database.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('economia:api');

function getApiConfig() {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');

    if (!token) {
        const error = new Error('No hay token de autenticación disponible para economía.');
        logger.error('missing auth token for economia api request', { host, port });
        throw error;
    }

    return {
        baseUrl: `http://${host}:${port}/api`,
        token,
    };
}

async function requestEconomiaApi({ path, method = 'GET', query, body, responseType = 'json' }) {
    const { baseUrl, token } = getApiConfig();
    const response = await performHttpRequest({
        url: `${baseUrl}${path}`,
        method,
        query,
        responseType,
        headers: {
            Accept: responseType === 'json' ? 'application/json' : '*/*',
            Authorization: `Bearer ${token}`,
            ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        },
        ...(body !== undefined
            ? {
                body: {
                    kind: 'json',
                    value: body,
                },
            }
            : {}),
    });

    if (!response.ok) {
        logger.warn('economia api request failed', {
            path,
            method,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
    }

    return response;
}

function listHonorariosByDateRangeFromApi(params = {}) {
    return requestEconomiaApi({
        path: '/honorarios/by-date-range',
        method: 'GET',
        query: params,
    });
}

function listGastosByDateRangeFromApi(params = {}) {
    return requestEconomiaApi({
        path: '/gasto-suit-cases/by-date-range',
        method: 'GET',
        query: params,
    });
}

function getHonorariosStatsFromApi(params = {}) {
    return requestEconomiaApi({
        path: '/honorarios/stats',
        method: 'GET',
        query: params,
    });
}

function getGastosStatsFromApi(params = {}) {
    return requestEconomiaApi({
        path: '/gasto-suit-cases/stats',
        method: 'GET',
        query: params,
    });
}

module.exports = {
    getGastosStatsFromApi,
    getHonorariosStatsFromApi,
    listGastosByDateRangeFromApi,
    listHonorariosByDateRangeFromApi,
};
