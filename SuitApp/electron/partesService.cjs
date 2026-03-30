const {
    getParteFromApi,
    createParteInApi,
    updateParteInApi,
    deleteParteInApi,
    getPartesLastModifiedFromApi,
    listCasePartesFromApi,
    linkParteToCaseInApi,
    unlinkParteFromCaseInApi,
} = require('./partesApi.cjs');
const {
    extractPartePayload,
    listCachedPartes,
    getCachedParteById,
    upsertCachedPartes,
    deleteCachedParteById,
    replaceCasePartes,
    linkParteToCaseCache,
    unlinkParteFromCaseCache,
} = require('./partesRepository.cjs');
const { syncPartesCache } = require('./partesSyncService.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('partes:service');

class PartePayloadValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'PartePayloadValidationError';
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

function normalizeOptionalEmail(value, field, failures) {
    const normalized = normalizeOptionalText(value, field, failures);
    if (normalized === undefined) return undefined;

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(normalized)) {
        failures.push({ field, reason: 'invalid_email_format', receivedValue: value });
        return undefined;
    }

    return normalized;
}

function validatePartePayload(parteData = {}) {
    const failures = [];
    const payload = {
        nombre: normalizeRequiredText(parteData.nombre, 'nombre', failures),
        apellido: normalizeRequiredText(parteData.apellido, 'apellido', failures),
        identificacion: normalizeOptionalText(parteData.identificacion, 'identificacion', failures),
        email: normalizeOptionalEmail(parteData.email, 'email', failures),
        telefono: normalizeOptionalText(parteData.telefono, 'telefono', failures),
        direccion: normalizeOptionalText(parteData.direccion, 'direccion', failures),
        genero: normalizeOptionalText(parteData.genero, 'genero', failures)?.toUpperCase(),
        notas: normalizeOptionalText(parteData.notas, 'notas', failures),
        rol_id: (() => {
            try {
                return normalizePositiveInteger(parteData.rol_id, 'rol_id');
            } catch (error) {
                failures.push({ field: 'rol_id', reason: 'invalid_positive_integer', receivedValue: parteData.rol_id });
                return null;
            }
        })(),
    };

    if (failures.length > 0) {
        throw new PartePayloadValidationError(
            `El payload de parte es inválido. Revisá: ${failures.map((failure) => failure.field).join(', ')}.`,
            failures,
        );
    }

    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

function toMutationErrorResponse(error, action, parteData) {
    if (error instanceof PartePayloadValidationError) {
        logger.error(`parte payload validation failed during ${action}`, {
            error: error.message,
            failedFields: error.details,
            providedFields: Object.keys(parteData || {}),
        });
        return {
            ok: false,
            status: 422,
            data: null,
            error: error.message,
        };
    }

    logger.error(`parte ${action} failed before response`, {
        error: error?.message || String(error),
        parteData,
    });
    throw error;
}

function extractCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (!payload || typeof payload !== 'object') return [];
    if (Array.isArray(payload.partes)) return payload.partes;
    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    return [];
}

function hasRecognizedCollectionShape(payload) {
    return Array.isArray(payload)
        || Array.isArray(payload?.partes)
        || Array.isArray(payload?.data)
        || Array.isArray(payload?.items);
}

function extractLastModified(payload) {
    if (typeof payload === 'string') return payload;
    if (!payload || typeof payload !== 'object') return null;
    return payload.last_modified ?? payload.lastModified ?? null;
}

async function listPartes({ refresh = false } = {}) {
    if (refresh) {
        await syncPartesCache();
    }
    return listCachedPartes();
}

async function getParte(id) {
    const normalizedId = normalizePositiveInteger(id, 'id');
    const cachedParte = getCachedParteById(normalizedId);
    if (cachedParte) {
        return cachedParte;
    }

    logger.info('parte not found in cache, fetching from api', { parteId: normalizedId });
    const response = await getParteFromApi(normalizedId);
    if (!response.ok) {
        logger.error('get parte from api failed', {
            parteId: normalizedId,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        throw new Error(`No se pudo obtener la parte ${normalizedId} desde la API.`);
    }

    const parte = extractPartePayload(response.data) || response.data;
    if (!parte || typeof parte !== 'object') {
        logger.error('get parte response did not include a valid parte payload', {
            parteId: normalizedId,
            data: response.data,
        });
        throw new Error(`La API devolvió una respuesta inválida para la parte ${normalizedId}.`);
    }

    upsertCachedPartes([parte]);
    return getCachedParteById(normalizedId);
}

async function createParte(parteData) {
    try {
        const payload = validatePartePayload(parteData);
        const response = await createParteInApi(payload);
        if (!response.ok) {
            logger.error('create parte api request failed', {
                status: response.status,
                error: response.error || null,
                data: response.data,
            });
            return response;
        }

        const createdParte = extractPartePayload(response.data);
        if (!createdParte) {
            logger.error('create parte response missing created parte payload', {
                data: response.data,
            });
            return {
                ok: false,
                status: 502,
                data: response.data,
                error: 'La API devolvió una respuesta inválida al crear la parte.',
            };
        }

        upsertCachedPartes([createdParte]);
        return response;
    } catch (error) {
        return toMutationErrorResponse(error, 'create', parteData);
    }
}

async function updateParte(id, parteData) {
    try {
        const normalizedId = normalizePositiveInteger(id, 'id');
        const payload = validatePartePayload(parteData);
        const response = await updateParteInApi(normalizedId, payload);
        if (!response.ok) {
            logger.error('update parte api request failed', {
                parteId: normalizedId,
                status: response.status,
                error: response.error || null,
                data: response.data,
            });
            return response;
        }

        const updatedParte = extractPartePayload(response.data) || { ...payload, id: normalizedId };
        upsertCachedPartes([updatedParte]);
        return response;
    } catch (error) {
        return toMutationErrorResponse(error, 'update', parteData);
    }
}

async function deleteParte(id) {
    const normalizedId = normalizePositiveInteger(id, 'id');
    const response = await deleteParteInApi(normalizedId);
    if (!response.ok) {
        logger.error('delete parte api request failed', {
            parteId: normalizedId,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        return response;
    }

    deleteCachedParteById(normalizedId);
    return response;
}

async function getPartesLastModified() {
    const response = await getPartesLastModifiedFromApi();
    if (!response.ok) {
        logger.error('get partes last-modified failed', {
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        throw new Error('No se pudo obtener last-modified de partes.');
    }
    return extractLastModified(response.data);
}

async function getPartesByCase(caseId) {
    const normalizedCaseId = normalizePositiveInteger(caseId, 'caseId');
    const response = await listCasePartesFromApi(normalizedCaseId);
    if (!response.ok) {
        logger.error('list case partes api request failed', {
            caseId: normalizedCaseId,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        throw new Error(`No se pudieron obtener las partes del caso ${normalizedCaseId}.`);
    }

    const partes = extractCollection(response.data);
    if (!hasRecognizedCollectionShape(response.data)) {
        logger.error('list case partes received invalid payload shape', {
            caseId: normalizedCaseId,
            data: response.data,
        });
        throw new Error(`La API devolvió una respuesta inválida para las partes del caso ${normalizedCaseId}.`);
    }

    replaceCasePartes(normalizedCaseId, partes);
    return partes;
}

async function linkParteToCase(caseId, parteId) {
    const normalizedCaseId = normalizePositiveInteger(caseId, 'caseId');
    const normalizedParteId = normalizePositiveInteger(parteId, 'parteId');
    const response = await linkParteToCaseInApi(normalizedCaseId, normalizedParteId);
    if (!response.ok) {
        logger.error('link parte to case api request failed', {
            caseId: normalizedCaseId,
            parteId: normalizedParteId,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        return response;
    }

    linkParteToCaseCache(normalizedCaseId, normalizedParteId);
    return response;
}

async function unlinkParteFromCase(caseId, parteId) {
    const normalizedCaseId = normalizePositiveInteger(caseId, 'caseId');
    const normalizedParteId = normalizePositiveInteger(parteId, 'parteId');
    const response = await unlinkParteFromCaseInApi(normalizedCaseId, normalizedParteId);
    if (!response.ok) {
        logger.error('unlink parte from case api request failed', {
            caseId: normalizedCaseId,
            parteId: normalizedParteId,
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
        return response;
    }

    unlinkParteFromCaseCache(normalizedCaseId, normalizedParteId);
    return response;
}

module.exports = {
    listPartes,
    getParte,
    createParte,
    updateParte,
    deleteParte,
    getPartesLastModified,
    syncPartes: syncPartesCache,
    getPartesByCase,
    linkParteToCase,
    unlinkParteFromCase,
};
