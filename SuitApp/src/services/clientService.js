/**
 * clientService.js — bridge del renderer hacia el backend interno de clientes.
 */
import { createLogger } from './logService.js';

const logger = createLogger('client-service');
const ALLOWED_CLIENT_TYPES = new Set(['person', 'company']);
const ALLOWED_CLIENT_GENDERS = new Set(['M', 'F', 'X']);

class ClientPayloadValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'ClientPayloadValidationError';
        this.details = details;
    }
}

/**
 * Normaliza un texto requerido y registra un error si llega vacío o con tipo inválido.
 */
function normalizeRequiredText(value, field, failures) {
    if (typeof value !== 'string') {
        failures.push({ field, reason: 'expected_string', receivedType: typeof value });
        return null;
    }

    const normalized = value.trim();
    if (!normalized) {
        failures.push({ field, reason: 'empty_required' });
        return null;
    }

    return normalized;
}

/**
 * Normaliza un texto opcional sin convertirlo silenciosamente a `null`.
 * Si queda vacío, el campo se omite del payload; si llega con tipo inválido, se registra el fallo.
 */
function normalizeOptionalText(value, field, failures) {
    if (value == null) return undefined;
    if (typeof value !== 'string') {
        failures.push({ field, reason: 'expected_string_or_nullish', receivedType: typeof value });
        return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
}

/**
 * Valida un valor enumerado del contrato de clientes y registra exactamente qué falló.
 */
function normalizeEnum(value, field, allowedValues, failures, transform = (current) => current.trim()) {
    if (typeof value !== 'string') {
        failures.push({ field, reason: 'expected_string', receivedType: typeof value });
        return null;
    }

    const normalized = transform(value);
    if (!allowedValues.has(normalized)) {
        failures.push({ field, reason: 'invalid_value', receivedValue: value, allowedValues: Array.from(allowedValues) });
        return null;
    }

    return normalized;
}

/**
 * Construye un error de validación con detalle suficiente para logs y UI.
 */
function buildPayloadValidationError(failures) {
    const fields = failures.map((failure) => failure.field).join(', ');
    return new ClientPayloadValidationError(
        `El payload de cliente es inválido. Revisá: ${fields}.`,
        failures,
    );
}

/**
 * Registra en el logger qué campos impidieron construir el payload antes de llamar a la API.
 */
function logPayloadValidationError(action, clientData, error) {
    logger.error(`client payload validation failed during ${action}`, {
        error: error.message,
        failedFields: error.details ?? [],
        providedFields: Object.keys(clientData || {}),
    });
}

/**
 * Ejecuta una mutación de clientes evitando requests defectuosas y devolviendo un error consumible por la UI.
 */
async function executeClientMutation(action, endpoint, method, clientData) {
    try {
        const payload = buildClientApiPayload(clientData);
        const clientsApi = window.electronAPI?.clients;
        if (!clientsApi) {
            logger.error('clients backend is unavailable in renderer', { action, endpoint, method });
            return {
                ok: false,
                status: 0,
                data: null,
                error: 'El backend interno de clientes no está disponible.',
            };
        }

        if (action === 'create') {
            return await clientsApi.create(payload);
        }

        const numericId = Number(endpoint);
        if (!Number.isInteger(numericId) || numericId < 1) {
            logger.error('invalid client id for mutation', { action, endpoint });
            return {
                ok: false,
                status: 422,
                data: null,
                error: 'El id de cliente es inválido.',
            };
        }

        return await clientsApi.update(numericId, payload);
    } catch (error) {
        if (error instanceof ClientPayloadValidationError) {
            logPayloadValidationError(action, clientData, error);
            return {
                ok: false,
                status: 422,
                data: null,
                error: error.message,
            };
        }
        throw error;
    }
}

/**
 * Adapta el payload del formulario al contrato actual de la API de clientes.
 * Centralizarlo evita que cada UI tenga que recordar campos opcionales, trims y defaults.
 */
export function buildClientApiPayload(clientData = {}) {
    const failures = [];

    const payload = {
        first_name: normalizeRequiredText(clientData.first_name, 'first_name', failures),
        last_name: normalizeRequiredText(clientData.last_name, 'last_name', failures),
        type: normalizeEnum(clientData.type, 'type', ALLOWED_CLIENT_TYPES, failures),
        gender: normalizeEnum(clientData.gender, 'gender', ALLOWED_CLIENT_GENDERS, failures, (value) => value.trim().toUpperCase()),
        identification_number: normalizeOptionalText(clientData.identification_number, 'identification_number', failures),
        email: normalizeOptionalText(clientData.email, 'email', failures),
        phone: normalizeOptionalText(clientData.phone, 'phone', failures),
        address: normalizeOptionalText(clientData.address, 'address', failures),
        notes: normalizeOptionalText(clientData.notes, 'notes', failures),
    };

    if (failures.length > 0) {
        throw buildPayloadValidationError(failures);
    }

    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function getClientsBackendOrThrow(action) {
    const clientsApi = window.electronAPI?.clients;
    if (!clientsApi) {
        const error = new Error('El backend interno de clientes no está disponible.');
        void logger.error(`clients backend unavailable during ${action}`);
        throw error;
    }
    return clientsApi;
}

/**
 * Lista clientes con filtros opcionales.
 */
export async function getClients({ refresh = false } = {}) {
    const clientsApi = getClientsBackendOrThrow('list');
    return await clientsApi.list({ refresh });
}

/**
 * Obtiene un cliente individual con sus asociaciones.
 */
export async function getClient(id) {
    const clientsApi = getClientsBackendOrThrow('get');
    return await clientsApi.get(Number(id));
}

/**
 * Crea un cliente nuevo.
 */
export async function createClient(clientData) {
    return await executeClientMutation('create', '/clients', 'POST', clientData);
}

/**
 * Actualiza un cliente existente.
 */
export async function updateClient(id, clientData) {
    return await executeClientMutation('update', id, 'PUT', clientData);
}

/**
 * Elimina un cliente (soft delete).
 */
export async function deleteClient(id) {
    try {
        const clientsApi = getClientsBackendOrThrow('delete');
        return await clientsApi.delete(Number(id));
    } catch (error) {
        void logger.error('delete client failed before backend call', {
            clientId: id,
            error: error?.message || String(error),
        });
        return {
            ok: false,
            status: 0,
            data: null,
            error: error?.message || 'No se pudo eliminar el cliente.',
        };
    }
}

/**
 * Obtiene la fecha de última modificación global de clientes.
 */
export async function getClientsLastModified() {
    const clientsApi = getClientsBackendOrThrow('lastModified');
    return await clientsApi.getLastModified();
}
