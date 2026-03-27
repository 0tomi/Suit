const { getConfig } = require('./database.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('documents:listing:api');

function getApiConfig() {
    const host = getConfig('api_host') || 'localhost';
    const port = getConfig('api_port') || '8000';
    const token = getConfig('auth_token');

    if (!token) {
        const error = new Error('No hay token de autenticación disponible para documentos.');
        logger.error('missing auth token for documents api request', { host, port });
        throw error;
    }

    return {
        baseUrl: `http://${host}:${port}/api`,
        token,
    };
}

async function requestDocumentsApi({ path, query, responseType = 'json' }) {
    const { baseUrl, token } = getApiConfig();
    const response = await performHttpRequest({
        url: `${baseUrl}${path}`,
        method: 'GET',
        query,
        responseType,
        headers: {
            Accept: responseType === 'json' ? 'application/json' : '*/*',
            Authorization: `Bearer ${token}`,
        },
    });

    if (!response.ok) {
        logger.warn('documents api request failed', {
            path,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
    }

    return response;
}

function getDocumentsPageFromApi(params = {}) {
    const normalizedParams = typeof params === 'object' && params !== null
        ? params
        : { page: Number(params) || 1 };

    return requestDocumentsApi({
        path: '/documents',
        query: normalizedParams,
    });
}

function getDocumentsTotalPagesFromApi() {
    return requestDocumentsApi({
        path: '/documents/total-pages',
    });
}

function getFilteredDocumentsPageFromApi(params = {}) {
    return requestDocumentsApi({
        path: '/documents/paged-filtered',
        query: params,
    });
}

function getFilteredDocumentsTotalPagesFromApi(params = {}) {
    return requestDocumentsApi({
        path: '/documents/total-pages-filtered',
        query: params,
    });
}

function searchDocumentsFromApi(params = {}) {
    return requestDocumentsApi({
        path: '/documents/search',
        query: params,
    });
}

function getDocumentsLastModifiedFromApi() {
    return requestDocumentsApi({
        path: '/documents/last-modified',
    });
}

module.exports = {
    getDocumentsLastModifiedFromApi,
    getDocumentsPageFromApi,
    getDocumentsTotalPagesFromApi,
    getFilteredDocumentsPageFromApi,
    getFilteredDocumentsTotalPagesFromApi,
    searchDocumentsFromApi,
};
