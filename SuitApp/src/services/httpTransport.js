import { isElectron } from '../utils/platform.js';

const BODYLESS_METHODS = new Set(['GET', 'HEAD']);

async function serializeFormData(formData) {
    const parts = [];

    for (const [name, value] of formData.entries()) {
        if (value instanceof Blob) {
            const bytes = new Uint8Array(await value.arrayBuffer());
            parts.push({
                kind: 'file',
                name,
                filename: value.name || 'upload.bin',
                mimeType: value.type || 'application/octet-stream',
                bytes,
            });
            continue;
        }

        parts.push({
            kind: 'field',
            name,
            value: String(value ?? ''),
        });
    }

    return {
        kind: 'form-data',
        parts,
    };
}

async function serializeRequestBody(body) {
    if (body === undefined || body === null) {
        return { kind: 'none' };
    }

    if (body instanceof FormData) {
        return await serializeFormData(body);
    }

    return {
        kind: 'json',
        value: body,
    };
}

async function parseResponse(response, responseType = 'json') {
    if (responseType === 'text') {
        return await response.text();
    }

    // Soporte para descarga de archivos binarios (multimedia, files descifrados).
    // Se convierte a Array<number> para poder serializar a través de IPC.
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


function buildUrl(rawUrl, query = null) {
    const url = new URL(rawUrl);

    if (query && typeof query === 'object') {
        for (const [key, value] of Object.entries(query)) {
            if (value === undefined || value === null) continue;
            url.searchParams.append(key, String(value));
        }
    }

    return url.toString();
}

async function performBrowserRequest({
    url,
    method = 'GET',
    headers = {},
    query,
    responseType = 'json',
    body,
    timeoutMs = 0,
}) {
    const controller = timeoutMs > 0 ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

    try {
        const requestUrl = buildUrl(url, query);
        const options = {
            method,
            headers: { ...headers },
            signal: controller?.signal,
        };

        if (!BODYLESS_METHODS.has(method) && body !== undefined) {
            options.body = body instanceof FormData ? body : JSON.stringify(body);
        }

        const response = await fetch(requestUrl, options);
        const data = await parseResponse(response, responseType);

        return {
            ok: response.ok,
            status: response.status,
            data,
            headers: Object.fromEntries(response.headers.entries()),
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

export async function performHttpRequest(request) {
    if (isElectron() && window.electronAPI?.http?.request) {
        const serializedBody = await serializeRequestBody(request.body);
        const ipcResponseType = request.responseType === 'blob' ? 'arraybuffer' : request.responseType;
        
        const response = await window.electronAPI.http.request({
            ...request,
            body: serializedBody,
            responseType: ipcResponseType
        });

        if (response.ok && request.responseType === 'blob' && response.data) {
            // response.data ya es Uint8Array gracias a la optimización en httpProxy.cjs
            response.data = new Blob([response.data], { 
                type: response.headers?.['content-type'] || 'application/octet-stream' 
            });
        }

        return response;
    }

    return await performBrowserRequest(request);
}

