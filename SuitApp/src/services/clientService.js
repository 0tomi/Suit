/**
 * clientService.js — bridge del renderer hacia el backend interno de clientes.
 */
import { createLogger } from './logService.js';
import {
    buildClientApiPayload,
    ClientPayloadValidationError,
    logPayloadValidationError,
} from './personAdapters.js';

const logger = createLogger('client-service');

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
            logPayloadValidationError(action, 'client', clientData, error);
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
 * Obtiene la documentación de un cliente con triple paginación.
 */
export async function getClientDocuments(id, options = {}) {
    const clientsApi = getClientsBackendOrThrow('getDocuments');
    return await clientsApi.getDocuments(Number(id), options);
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

export { buildClientApiPayload } from './personAdapters.js';
