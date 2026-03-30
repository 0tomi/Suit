const { getConfig } = require('./database.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('templates:api');

function getApiConfig() {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');

    if (!token) {
        const error = new Error('No hay token de autenticación disponible para templates.');
        logger.error('missing auth token for templates api request', { host, port });
        throw error;
    }

    return {
        baseUrl: `http://${host}:${port}/api`,
        token,
    };
}

async function requestTemplatesApi({ path, method = 'GET', query, body, responseType = 'json' }) {
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
        logger.warn('templates api request failed', {
            path,
            method,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
    }

    return response;
}

function listTemplatesFromApi(params = {}) {
    return requestTemplatesApi({
        path: '/templates',
        method: 'GET',
        query: params,
    });
}

function listTemplatesByCategoryFromApi(categoryId, params = {}) {
    return requestTemplatesApi({
        path: `/template-categories/${categoryId}/templates-list`,
        method: 'GET',
        query: params,
    });
}

function getTemplatesLastModifiedFromApi() {
    return requestTemplatesApi({
        path: '/templates/last-modified',
        method: 'GET',
    });
}

module.exports = {
    getTemplatesLastModifiedFromApi,
    listTemplatesByCategoryFromApi,
    listTemplatesFromApi,
};
