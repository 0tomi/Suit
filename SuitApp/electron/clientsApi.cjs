const { getConfig } = require('./database.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('clients:api');

/**
 * Resuelve la configuración mínima para consumir SuitAPI desde el proceso principal.
 */
function getApiConfig() {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');

    if (!token) {
        const error = new Error('No hay token de autenticación disponible para clientes.');
        logger.error('missing auth token for clients api request', { host, port });
        throw error;
    }

    return {
        baseUrl: `http://${host}:${port}/api`,
        token,
    };
}

/**
 * Ejecuta una request de clientes hacia la API usando el proxy HTTP del main process.
 */
async function requestClientsApi({ path, method = 'GET', query, body, responseType = 'json' }) {
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
        logger.warn('clients api request failed', {
            path,
            method,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
    }

    return response;
}

function listClientsFromApi(params = {}) {
    return requestClientsApi({
        path: '/clients',
        method: 'GET',
        query: params,
    });
}

function getClientFromApi(id) {
    return requestClientsApi({
        path: `/clients/${id}`,
        method: 'GET',
    });
}

function createClientInApi(payload) {
    return requestClientsApi({
        path: '/clients',
        method: 'POST',
        body: payload,
    });
}

function updateClientInApi(id, payload) {
    return requestClientsApi({
        path: `/clients/${id}`,
        method: 'PUT',
        body: payload,
    });
}

function deleteClientInApi(id) {
    return requestClientsApi({
        path: `/clients/${id}`,
        method: 'DELETE',
    });
}

function getClientsLastModifiedFromApi() {
    return requestClientsApi({
        path: '/clients/last-modified',
        method: 'GET',
    });
}

function getClientsDeltaFromApi(since) {
    return requestClientsApi({
        path: '/clients/sync',
        method: 'GET',
        query: { since },
    });
}

module.exports = {
    listClientsFromApi,
    getClientFromApi,
    createClientInApi,
    updateClientInApi,
    deleteClientInApi,
    getClientsLastModifiedFromApi,
    getClientsDeltaFromApi,
};
