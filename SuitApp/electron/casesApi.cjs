const { getConfig } = require('./database.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('cases:api');

function getApiConfig() {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');

    if (!token) {
        const error = new Error('No hay token de autenticación disponible para casos.');
        logger.error('missing auth token for cases api request', { host, port });
        throw error;
    }

    return {
        baseUrl: `http://${host}:${port}/api`,
        token,
    };
}

async function requestCasesApi({ path, method = 'GET', query, body, responseType = 'json' }) {
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
        logger.warn('cases api request failed', {
            path,
            method,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
    }

    return response;
}

function listCasesFromApi(params = {}) {
    return requestCasesApi({
        path: '/cases',
        method: 'GET',
        query: params,
    });
}

function searchCasesFromApi(params = {}) {
    return requestCasesApi({
        path: '/cases/search',
        method: 'GET',
        query: params,
    });
}

function getCasesLastModifiedFromApi() {
    return requestCasesApi({
        path: '/cases/last-modified',
        method: 'GET',
    });
}

module.exports = {
    getCasesLastModifiedFromApi,
    listCasesFromApi,
    searchCasesFromApi,
};
