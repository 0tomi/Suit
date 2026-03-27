const { getConfig } = require('./database.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('partes:api');

/**
 * Resuelve la configuración mínima para consumir SuitAPI desde el proceso principal.
 */
function getApiConfig() {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');

    if (!token) {
        const error = new Error('No hay token de autenticación disponible para partes.');
        logger.error('missing auth token for partes api request', { host, port });
        throw error;
    }

    return {
        baseUrl: `http://${host}:${port}/api`,
        token,
    };
}

/**
 * Ejecuta una request de partes hacia la API usando el proxy HTTP del main process.
 */
async function requestPartesApi({ path, method = 'GET', query, body, responseType = 'json' }) {
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
        logger.warn('partes api request failed', {
            path,
            method,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
    }

    return response;
}

function listPartesFromApi(params = {}) {
    return requestPartesApi({
        path: '/partes',
        method: 'GET',
        query: params,
    });
}

function getParteFromApi(id) {
    return requestPartesApi({
        path: `/partes/${id}`,
        method: 'GET',
    });
}

function createParteInApi(payload) {
    return requestPartesApi({
        path: '/partes',
        method: 'POST',
        body: payload,
    });
}

function updateParteInApi(id, payload) {
    return requestPartesApi({
        path: `/partes/${id}`,
        method: 'PUT',
        body: payload,
    });
}

function deleteParteInApi(id) {
    return requestPartesApi({
        path: `/partes/${id}`,
        method: 'DELETE',
    });
}

function getPartesLastModifiedFromApi() {
    return requestPartesApi({
        path: '/partes/last-modified',
        method: 'GET',
    });
}

function getPartesDeltaFromApi(since) {
    return requestPartesApi({
        path: '/partes/sync',
        method: 'GET',
        query: { since },
    });
}

function listCasePartesFromApi(caseId) {
    return requestPartesApi({
        path: `/suit-cases/${caseId}/partes`,
        method: 'GET',
    });
}

function linkParteToCaseInApi(caseId, parteId) {
    return requestPartesApi({
        path: `/suit-cases/${caseId}/partes`,
        method: 'POST',
        body: { parte_id: parteId },
    });
}

function unlinkParteFromCaseInApi(caseId, parteId) {
    return requestPartesApi({
        path: `/suit-cases/${caseId}/partes/${parteId}`,
        method: 'DELETE',
    });
}

module.exports = {
    listPartesFromApi,
    getParteFromApi,
    createParteInApi,
    updateParteInApi,
    deleteParteInApi,
    getPartesLastModifiedFromApi,
    getPartesDeltaFromApi,
    listCasePartesFromApi,
    linkParteToCaseInApi,
    unlinkParteFromCaseInApi,
};
