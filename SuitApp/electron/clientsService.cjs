const {
    getClientFromApi,
    createClientInApi,
    updateClientInApi,
    deleteClientInApi,
    getClientsLastModifiedFromApi,
    getClientDocumentsFromApi,
} = require('./clientsApi.cjs');
const {
    extractClientPayload,
    listCachedClients,
    getCachedClientById,
    upsertCachedClients,
    deleteCachedClientById,
} = require('./clientsRepository.cjs');
const { syncClientsCache } = require('./clientsSyncService.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('clients:service');
const ALLOWED_CLIENT_TYPES = new Set(['person', 'company']);
const ALLOWED_CLIENT_GENDERS = new Set(['M', 'F', 'X']);

class ClientPayloadValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'ClientPayloadValidationError';
        this.details = details;
    }
}

function normalizePositiveInteger(value, field) {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized < 1) {
        throw new Error(`"${field}" debe ser un entero positivo.`);
    }
    return normalized;
}

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

function normalizeOptionalText(value, field, failures) {
    if (value == null) return undefined;
    if (typeof value !== 'string') {
        failures.push({ field, reason: 'expected_string_or_nullish', receivedType: typeof value });
        return undefined;
    }

    const normalized = value.trim();
    return normalized || undefined;
}

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

function validateClientPayload(clientData = {}) {
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
        throw new ClientPayloadValidationError(
            `El payload de cliente es inválido. Revisá: ${failures.map((failure) => failure.field).join(', ')}.`,
            failures,
        );
    }

    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function toMutationErrorResponse(error, action, clientData) {
    if (error instanceof ClientPayloadValidationError) {
        logger.error(`client payload validation failed during ${action}`, {
            error: error.message,
            failedFields: error.details,
            providedFields: Object.keys(clientData || {}),
        });
        return {
            ok: false,
            status: 422,
            data: null,
            error: error.message,
        };
    }

    logger.error(`client ${action} failed before response`, {
        error: error?.message || String(error),
        clientData,
    });
    throw error;
}

async function listClients({ refresh = false } = {}) {
    if (refresh) {
        await syncClientsCache();
    }
    return listCachedClients();
}

async function getClient(id) {
    const normalizedId = normalizePositiveInteger(id, 'id');
    const cachedClient = getCachedClientById(normalizedId);
    if (cachedClient) {
        return cachedClient;
    }

    logger.info('client not found in cache, fetching from api', { clientId: normalizedId });
    const response = await getClientFromApi(normalizedId);
    if (!response.ok) {
        logger.error('get client from api failed', {
            clientId: normalizedId,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        throw new Error(`No se pudo obtener el cliente ${normalizedId} desde la API.`);
    }

    const client = extractClientPayload(response.data) || response.data;
    if (!client || typeof client !== 'object') {
        logger.error('get client response did not include a valid client payload', {
            clientId: normalizedId,
            data: response.data,
        });
        throw new Error(`La API devolvió una respuesta inválida para el cliente ${normalizedId}.`);
    }

    upsertCachedClients([client]);
    return getCachedClientById(normalizedId);
}

async function createClient(clientData) {
    try {
        const payload = validateClientPayload(clientData);
        const response = await createClientInApi(payload);
        if (!response.ok) {
            logger.error('create client api request failed', {
                status: response.status,
                error: response.error || null,
                data: response.data,
            });
            return response;
        }

        const createdClient = extractClientPayload(response.data);
        if (!createdClient) {
            logger.error('create client response missing created client payload', {
                data: response.data,
            });
            return {
                ok: false,
                status: 502,
                data: response.data,
                error: 'La API devolvió una respuesta inválida al crear el cliente.',
            };
        }

        upsertCachedClients([createdClient]);
        return response;
    } catch (error) {
        return toMutationErrorResponse(error, 'create', clientData);
    }
}

async function updateClient(id, clientData) {
    try {
        const normalizedId = normalizePositiveInteger(id, 'id');
        const payload = validateClientPayload(clientData);
        const response = await updateClientInApi(normalizedId, payload);
        if (!response.ok) {
            logger.error('update client api request failed', {
                clientId: normalizedId,
                status: response.status,
                error: response.error || null,
                data: response.data,
            });
            return response;
        }

        const updatedClient = extractClientPayload(response.data) || { ...payload, id: normalizedId };
        upsertCachedClients([updatedClient]);
        return response;
    } catch (error) {
        return toMutationErrorResponse(error, 'update', clientData);
    }
}

async function deleteClient(id) {
    const normalizedId = normalizePositiveInteger(id, 'id');
    const response = await deleteClientInApi(normalizedId);
    if (!response.ok) {
        logger.error('delete client api request failed', {
            clientId: normalizedId,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        return response;
    }

    deleteCachedClientById(normalizedId);
    return response;
}

async function getClientsLastModified() {
    const response = await getClientsLastModifiedFromApi();
    if (!response.ok) {
        logger.error('get clients last-modified failed', {
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        throw new Error('No se pudo obtener last-modified de clientes.');
    }
    return response.data?.last_modified || null;
}

function normalizePagingValue(value, fieldName) {
    if (value === undefined || value === null || value === '') return 1;
    return normalizePositiveInteger(value, fieldName);
}

async function getClientDocuments(clientId, paging = {}) {
    const normalizedClientId = normalizePositiveInteger(clientId, 'clientId');
    const normalizedPaging = {
        page_personal: normalizePagingValue(paging.page_personal, 'page_personal'),
        page_cases: normalizePagingValue(paging.page_cases, 'page_cases'),
        page_case_docs: normalizePagingValue(paging.page_case_docs, 'page_case_docs'),
    };

    const response = await getClientDocumentsFromApi(normalizedClientId, normalizedPaging);
    if (!response.ok) {
        logger.error('get client documents from api failed', {
            clientId: normalizedClientId,
            paging: normalizedPaging,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        throw new Error(`No se pudo obtener la documentación del cliente ${normalizedClientId}.`);
    }

    return response.data;
}

module.exports = {
    listClients,
    getClient,
    createClient,
    updateClient,
    deleteClient,
    getClientsLastModified,
    getClientDocuments,
    syncClients: syncClientsCache,
};
