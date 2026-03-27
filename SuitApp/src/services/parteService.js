/**
 * parteService.js — bridge del renderer hacia el backend interno de partes.
 * Las Partes son personas involucradas en el proceso (jueces, peritos, testigos, etc.)
 * que NO son clientes del estudio.
 */
import { createLogger } from './logService.js';

const logger = createLogger('parte-service');

class PartePayloadValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'PartePayloadValidationError';
        this.details = details;
    }
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized)) {
        failures.push({ field, reason: 'invalid_email_format', receivedValue: value });
        return undefined;
    }

    return normalized;
}

function normalizePositiveInteger(value, field, failures) {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized < 1) {
        failures.push({ field, reason: 'invalid_positive_integer', receivedValue: value });
        return null;
    }
    return normalized;
}

function buildPayloadValidationError(failures) {
    const fields = failures.map((failure) => failure.field).join(', ');
    return new PartePayloadValidationError(
        `El payload de parte es inválido. Revisá: ${fields}.`,
        failures,
    );
}

function logPayloadValidationError(action, parteData, error) {
    logger.error(`parte payload validation failed during ${action}`, {
        error: error.message,
        failedFields: error.details ?? [],
        providedFields: Object.keys(parteData || {}),
    });
}

function getPartesBackendOrThrow(action) {
    const partesApi = window.electronAPI?.partes;
    if (!partesApi) {
        const error = new Error('El backend interno de partes no está disponible.');
        void logger.error(`partes backend unavailable during ${action}`);
        throw error;
    }
    return partesApi;
}

function buildParteApiPayload(parteData = {}) {
    const failures = [];
    const payload = {
        nombre: normalizeRequiredText(parteData.nombre, 'nombre', failures),
        apellido: normalizeRequiredText(parteData.apellido, 'apellido', failures),
        email: normalizeOptionalEmail(parteData.email, 'email', failures),
        telefono: normalizeOptionalText(parteData.telefono, 'telefono', failures),
        rol_id: normalizePositiveInteger(parteData.rol_id, 'rol_id', failures),
    };

    if (failures.length > 0) {
        throw buildPayloadValidationError(failures);
    }

    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

async function executeParteMutation(action, id, parteData) {
    try {
        const payload = buildParteApiPayload(parteData);
        const partesApi = getPartesBackendOrThrow(action);

        if (action === 'create') {
            return await partesApi.create(payload);
        }

        const numericId = Number(id);
        if (!Number.isInteger(numericId) || numericId < 1) {
            logger.error('invalid parte id for mutation', { action, id });
            return {
                ok: false,
                status: 422,
                data: null,
                error: 'El id de parte es inválido.',
            };
        }

        return await partesApi.update(numericId, payload);
    } catch (error) {
        if (error instanceof PartePayloadValidationError) {
            logPayloadValidationError(action, parteData, error);
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

export async function getPartes({ refresh = false } = {}) {
    const partesApi = getPartesBackendOrThrow('list');
    return await partesApi.list({ refresh });
}

export async function getParte(id) {
    const partesApi = getPartesBackendOrThrow('get');
    return await partesApi.get(Number(id));
}

export async function createParte(data) {
    return await executeParteMutation('create', null, data);
}

export async function updateParte(id, data) {
    return await executeParteMutation('update', id, data);
}

export async function deleteParte(id) {
    try {
        const partesApi = getPartesBackendOrThrow('delete');
        return await partesApi.delete(Number(id));
    } catch (error) {
        void logger.error('delete parte failed before backend call', {
            parteId: id,
            error: error?.message || String(error),
        });
        return {
            ok: false,
            status: 0,
            data: null,
            error: error?.message || 'No se pudo eliminar la parte.',
        };
    }
}

export async function getPartesLastModified() {
    const partesApi = getPartesBackendOrThrow('lastModified');
    return await partesApi.getLastModified();
}

/** Lista partes asociadas a un caso con su rol. */
export async function getPartesByCaso(caseId) {
    const partesApi = getPartesBackendOrThrow('listByCase');
    return await partesApi.listByCase(Number(caseId));
}

/** Asocia una parte existente al caso (idempotente). */
export async function linkParteToCaso(caseId, parteId) {
    try {
        const partesApi = getPartesBackendOrThrow('linkToCase');
        return await partesApi.linkToCase(Number(caseId), Number(parteId));
    } catch (error) {
        void logger.error('link parte to case failed before backend call', {
            caseId,
            parteId,
            error: error?.message || String(error),
        });
        return {
            ok: false,
            status: 0,
            data: null,
            error: error?.message || 'No se pudo vincular la parte al caso.',
        };
    }
}

/** Desasocia una parte del caso. */
export async function unlinkParteFromCaso(caseId, parteId) {
    try {
        const partesApi = getPartesBackendOrThrow('unlinkFromCase');
        return await partesApi.unlinkFromCase(Number(caseId), Number(parteId));
    } catch (error) {
        void logger.error('unlink parte from case failed before backend call', {
            caseId,
            parteId,
            error: error?.message || String(error),
        });
        return {
            ok: false,
            status: 0,
            data: null,
            error: error?.message || 'No se pudo desvincular la parte del caso.',
        };
    }
}
