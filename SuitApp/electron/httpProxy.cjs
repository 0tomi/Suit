const { URL } = require('url');
const { getLogger } = require('./logService.cjs');
const { readCachedMedia, writeCachedMedia } = require('./mediaCache.cjs');

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);
const logger = getLogger('http-proxy');

function buildUrl(rawUrl, query = null) {
    const url = new URL(rawUrl);

    if (query && typeof query === 'object') {
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null) continue;
            url.searchParams.append(key, String(value));
        }
    }

    if (!['http:', 'https:'].includes(url.protocol)) {
        throw new Error(`Unsupported protocol for HTTP proxy: ${url.protocol}`);
    }

    return url.toString();
}

function normalizeHeaders(headers = {}) {
    const normalized = {};

    for (const [key, value] of Object.entries(headers)) {
        if (value === undefined || value === null) continue;
        normalized[key] = String(value);
    }

    return normalized;
}

function buildFormData(parts = []) {
    const formData = new FormData();

    for (const part of parts) {
        if (!part || !part.name) continue;

        if (part.kind === 'file') {
            const bytes = Buffer.isBuffer(part.bytes) || part.bytes instanceof Uint8Array
                ? part.bytes
                : (Array.isArray(part.bytes) ? Uint8Array.from(part.bytes) : new Uint8Array(part.bytes || []));
            const blob = new Blob([bytes], {
                type: part.mimeType || 'application/octet-stream',
            });
            formData.append(part.name, blob, part.filename || 'upload.bin');
            continue;
        }

        formData.append(part.name, String(part.value ?? ''));
    }

    return formData;
}

function buildRequestBody(body) {
    if (!body || body.kind === 'none') {
        return undefined;
    }

    if (body.kind === 'json') {
        return JSON.stringify(body.value ?? null);
    }

    if (body.kind === 'form-data') {
        return buildFormData(body.parts);
    }

    throw new Error(`Unsupported request body kind: ${body.kind}`);
}

async function parseResponse(response, responseType = 'json') {
    if (responseType === 'text') {
        return await response.text();
    }

    // Soporte para descarga de archivos binarios (multimedia, files descifrados).
    // Los bytes viajan como Array<number> a través de IPC (structured clone no permite Buffer).
    if (responseType === 'binary') {
        const buffer = await response.arrayBuffer();
        return {
            bytes: Array.from(new Uint8Array(buffer)),
            mimeType: response.headers.get('content-type') || 'application/octet-stream',
            size: buffer.byteLength,
        };
    }

    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
        return await response.json();
    }

    return null;
}


async function performHttpRequest(request = {}) {
    const method = String(request.method || 'GET').toUpperCase();
    const headers = normalizeHeaders(request.headers);
    const url = buildUrl(request.url, request.query);
    const timeoutMs = Number(request.timeoutMs) > 0 ? Number(request.timeoutMs) : 0;
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timeoutId = controller
        ? setTimeout(() => controller.abort(), timeoutMs)
        : null;
    const shouldUseMediaCache = (
        method === 'GET'
        && request.responseType === 'arraybuffer'
        && request.cache?.enabled
        && request.cache?.group
        && request.cache?.key
        && request.cache?.profileId
    );

    try {
        if (shouldUseMediaCache) {
            const cachedEntry = readCachedMedia(request.cache);
            if (cachedEntry) {
                return {
                    ok: true,
                    status: 200,
                    data: cachedEntry.data,
                    headers: {
                        'content-type': cachedEntry.contentType,
                        'x-suitapp-cache': 'hit',
                    },
                };
            }
        }

        const options = {
            method,
            headers,
            signal: controller?.signal,
        };

        if (!BODYLESS_METHODS.has(method)) {
            const body = buildRequestBody(request.body);
            if (body !== undefined) {
                options.body = body;
            }

            if (request.body?.kind === 'form-data') {
                delete options.headers['Content-Type'];
                delete options.headers['content-type'];
            }
        }

        const response = await fetch(url, options);
        const data = await parseResponse(response, request.responseType);
        const responseHeaders = Object.fromEntries(response.headers.entries());

        if (response.ok && shouldUseMediaCache && (Array.isArray(data) || data instanceof Uint8Array)) {
            const cacheStored = writeCachedMedia({
                ...request.cache,
                bytes: data,
                contentType: response.headers.get('content-type'),
            });
            if (!cacheStored) {
                logger.warn(`No se pudo guardar la respuesta en caché para ${request.url}`);
            }
        }

        return {
            ok: response.ok,
            status: response.status,
            data,
            headers: shouldUseMediaCache
                ? {
                    ...responseHeaders,
                    'x-suitapp-cache': 'miss',
                }
                : responseHeaders,
        };
    } catch (error) {
        return {
            ok: false,
            status: 0,
            data: null,
            headers: {},
            error: error?.message || String(error),
        };
    } finally {
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    }
}

module.exports = {
    performHttpRequest,
};
