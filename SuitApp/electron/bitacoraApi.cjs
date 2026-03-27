const { getConfig } = require('./database.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('bitacora:api');

/**
 * Resuelve la configuración mínima para consumir la bitácora desde el main process.
 */
function getApiConfig() {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');

    if (!token) {
        const error = new Error('No hay token de autenticación disponible para la bitácora.');
        logger.error('missing auth token for bitacora api request', { host, port });
        throw error;
    }

    return {
        baseUrl: `http://${host}:${port}/api`,
        token,
    };
}

/**
 * Ejecuta una request de bitácora hacia la API usando el proxy HTTP del main process.
 */
async function requestBitacoraApi({ path, method = 'GET', query, body }) {
    const { baseUrl, token } = getApiConfig();
    const response = await performHttpRequest({
        url: `${baseUrl}${path}`,
        method,
        query,
        responseType: 'json',
        headers: {
            Accept: 'application/json',
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
        logger.warn('bitacora api request failed', {
            path,
            method,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
    }

    return response;
}

function getBitacoraPageFromApi(params = {}) {
    return requestBitacoraApi({
        path: '/bitacora',
        method: 'GET',
        query: params,
    });
}

function clearBitacoraInApi() {
    return requestBitacoraApi({
        path: '/bitacora/clear',
        method: 'DELETE',
    });
}

function cleanupBitacoraInApi(days) {
    return requestBitacoraApi({
        path: '/bitacora/cleanup',
        method: 'DELETE',
        body: { days },
    });
}

module.exports = {
    getBitacoraPageFromApi,
    clearBitacoraInApi,
    cleanupBitacoraInApi,
};
