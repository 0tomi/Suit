/**
 * api.js — Cliente HTTP centralizado para la API SuitAPI.
 *
 * Todas las llamadas a la API pasan por este módulo.
 * Se construye la URL base desde la configuración almacenada (SQLite vía Electron IPC)
 * o desde un fallback en memoria cuando se ejecuta en navegador puro (dev sin Electron).
 */

import { clearDedupedGetRequests, dedupeGetRequest } from '../utils/dedupeRequest.js';
import { createLogger } from './logService.js';
import { performHttpRequest } from './httpTransport.js';

let _apiBaseUrl = null;
let _authToken = null;
const apiStateListeners = new Set();
const DEFAULT_PROBE_TIMEOUT_MS = import.meta.env?.DEV ? 2500 : 5000;
const logger = createLogger('api-service');

function normalizeForStableSerialize(value) {
    if (Array.isArray(value)) {
        return value.map(normalizeForStableSerialize);
    }

    if (
        value &&
        typeof value === 'object' &&
        !(value instanceof Date) &&
        !(value instanceof Blob) &&
        !(value instanceof FormData)
    ) {
        const normalized = {};
        for (const key of Object.keys(value).sort()) {
            normalized[key] = normalizeForStableSerialize(value[key]);
        }
        return normalized;
    }

    return value;
}

function stableSerialize(value) {
    return JSON.stringify(normalizeForStableSerialize(value));
}

function getApiStateSnapshot() {
    return {
        apiBaseUrl: _apiBaseUrl,
        authToken: _authToken,
        hasAuthToken: Boolean(_authToken),
    };
}

function emitApiStateChange(type, payload = {}) {
    const snapshot = getApiStateSnapshot();

    for (const listener of apiStateListeners) {
        try {
            listener({
                type,
                ...payload,
                state: snapshot,
            });
        } catch (err) {
            // Error en callback de listener externo: no fatal, la app continúa normalmente
            void logger.warn('error notifying API state listener', err);
        }
    }
}

function buildGetRequestKey(endpoint, options) {
    return `GET|${_apiBaseUrl || 'no-base'}|${_authToken || 'no-token'}|${endpoint}|${stableSerialize(options)}`;
}

/**
 * Suscribe listeners reactivos para cambios de configuración API/token.
 * @param {(event: {type: string, state: {apiBaseUrl: string|null, authToken: string|null, hasAuthToken: boolean}}) => void} listener
 * @returns {() => void} Función de cleanup
 */
export function subscribeApiState(listener) {
    if (typeof listener !== 'function') {
        throw new Error('listener must be a function');
    }
    apiStateListeners.add(listener);
    return () => apiStateListeners.delete(listener);
}

/**
 * Retorna una snapshot del estado API actual.
 */
export function getApiState() {
    return getApiStateSnapshot();
}

/**
 * Configura la URL base de la API.
 * @param {string} host - IP o hostname del servidor
 * @param {string|number} port - Puerto del servidor
 */
export function setApiBase(host, port) {
    const nextBaseUrl = host && port ? `http://${host}:${port}/api` : null;
    if (_apiBaseUrl === nextBaseUrl) return;

    _apiBaseUrl = nextBaseUrl;
    emitApiStateChange('api-base-changed');
}

/**
 * Obtiene la URL base actual. Retorna null si no está configurada.
 */
export function getApiBase() {
    return _apiBaseUrl;
}

/**
 * Configura el token de autenticación para las peticiones.
 * @param {string|null} token
 */
export function setAuthToken(token, meta = {}) {
    const nextToken = token || null;
    if (_authToken === nextToken) return;

    _authToken = nextToken;
    emitApiStateChange('auth-token-changed', { reason: meta.reason || null });
}

/**
 * Obtiene el token actual.
 */
export function getAuthToken() {
    return _authToken;
}

export function clearApiRequestState() {
    clearDedupedGetRequests();
}

/**
 * Realiza una petición HTTP a la API.
 * @param {string} endpoint - Ruta relativa (ej: '/login', '/cases')
 * @param {object} options
 * @param {string} [options.method='GET']
 * @param {object} [options.body] - Body para POST/PUT
 * @param {boolean} [options.auth=true] - Si se incluye el token de auth
 * @param {object} [options.params] - Query params
 * @param {string} [options.responseType='json'] - Tipo de respuesta esperada: 'json', 'text' o 'blob'
 * @returns {Promise<{ok: boolean, status: number, data: any}>}
 */
export async function apiRequest(endpoint, {
    method = 'GET',
    body,
    auth = true,
    params,
    responseType = 'json',
    cache,
    timeoutMs = 0,
} = {}) {
    if (!_apiBaseUrl) {
        throw new Error('API base URL no configurada. Configure el servidor primero.');
    }

    const url = `${_apiBaseUrl}${endpoint}`;

    const headers = {
        'Accept': responseType === 'text'
            ? 'text/html, text/plain, */*'
            : responseType === 'binary'
                ? '*/*'
                : 'application/json',
    };

    // No establecer Content-Type para FormData — el browser lo hace solo con el boundary
    if (!(body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }

    if (auth && _authToken) {
        headers['Authorization'] = `Bearer ${_authToken}`;
    }

    const fetchOptions = { method, headers };

    if (body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
        fetchOptions.body = body instanceof FormData ? body : JSON.stringify(body);
    }

    try {
        const response = await performHttpRequest({
            url,
            method,
            headers,
            query: params,
            responseType,
            body: fetchOptions.body ? body : undefined,
            cache,
            timeoutMs,
        });

        if (response.status === 401 && auth) {
            // El token pudo haber expirado o sido revocado en otro cliente.
            setAuthToken(null, { reason: 'unauthorized' });
        }

        return response;
    } catch (error) {
        return {
            ok: false,
            status: 0,
            data: null,
            error: error.message,
        };
    }
}

/**
 * GET deduplicado para evitar solicitudes duplicadas (por ejemplo, StrictMode double mount).
 * @param {string} endpoint
 * @param {object} options
 * @param {boolean} [options.dedupe=true]
 * @param {string} [options.dedupeKey]
 */
export async function apiGet(endpoint, options = {}) {
    const { dedupe = true, dedupeKey, ...requestOptions } = options;
    const getOptions = { ...requestOptions, method: 'GET' };

    if (!dedupe) {
        return apiRequest(endpoint, getOptions);
    }

    const requestKey = dedupeKey || buildGetRequestKey(endpoint, requestOptions);
    return dedupeGetRequest(requestKey, () => apiRequest(endpoint, getOptions));
}

/**
 * Verifica si el servidor está accesible haciendo un GET liviano.
 * @param {string} host
 * @param {string|number} port
 * @returns {Promise<boolean>}
 */
export async function probeServer(host, port) {
    return probeServerWithOptions(host, port, {});
}

export async function probeServerWithOptions(host, port, { timeoutMs = DEFAULT_PROBE_TIMEOUT_MS } = {}) {
    try {
        const response = await performHttpRequest({
            url: `http://${host}:${port}/api/is_on`,
            method: 'GET',
            headers: { 'Accept': 'text/plain, application/json' },
            responseType: 'text',
            timeoutMs,
        });

        return response.ok;
    } catch (err) {
        void logger.warn(`probeServer failed to reach server at ${host}:${port}`, err.message);
        return false;
    }
}
