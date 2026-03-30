import { createLogger } from './logService.js';

const logger = createLogger('person-adapters');

export const ALLOWED_CLIENT_TYPES = new Set(['person', 'company']);
export const ALLOWED_CLIENT_GENDERS = new Set(['M', 'F', 'X']);

export const PERSON_FORM_INITIAL_VALUES = {
    first_name: '',
    last_name: '',
    identification_number: '',
    email: '',
    phone: '',
    address: '',
    type: 'person',
    gender: '',
    notes: '',
    rol_id: '',
};

export class ClientPayloadValidationError extends Error {
    constructor(message, details = []) {
        super(message);
        this.name = 'ClientPayloadValidationError';
        this.details = details;
    }
}

export class PartePayloadValidationError extends Error {
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

function normalizePositiveInteger(value, field, failures) {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized < 1) {
        failures.push({ field, reason: 'invalid_positive_integer', receivedValue: value });
        return null;
    }

    return normalized;
}

function buildPayloadValidationError(ErrorClass, entityLabel, failures) {
    const fields = failures.map((failure) => failure.field).join(', ');
    return new ErrorClass(
        `El payload de ${entityLabel} es inválido. Revisá: ${fields}.`,
        failures,
    );
}

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
        throw buildPayloadValidationError(ClientPayloadValidationError, 'cliente', failures);
    }

    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

export function buildParteApiPayload(parteData = {}) {
    const failures = [];
    const payload = {
        nombre: normalizeRequiredText(parteData.nombre ?? parteData.first_name, 'nombre', failures),
        apellido: normalizeRequiredText(parteData.apellido ?? parteData.last_name, 'apellido', failures),
        identificacion: normalizeOptionalText(
            parteData.identificacion ?? parteData.identification_number,
            'identificacion',
            failures,
        ),
        email: normalizeOptionalEmail(parteData.email, 'email', failures),
        telefono: normalizeOptionalText(parteData.telefono ?? parteData.phone, 'telefono', failures),
        direccion: normalizeOptionalText(parteData.direccion ?? parteData.address, 'direccion', failures),
        genero: normalizeEnum(
            parteData.genero ?? parteData.gender,
            'genero',
            ALLOWED_CLIENT_GENDERS,
            failures,
            (value) => value.trim().toUpperCase(),
        ),
        notas: normalizeOptionalText(parteData.notas ?? parteData.notes, 'notas', failures),
        rol_id: normalizePositiveInteger(parteData.rol_id, 'rol_id', failures),
    };

    if (failures.length > 0) {
        throw buildPayloadValidationError(PartePayloadValidationError, 'parte', failures);
    }

    return Object.fromEntries(Object.entries(payload).filter(([, value]) => value !== undefined));
}

export function extractEntityFromResponse(data, aliases = []) {
    if (!data || typeof data !== 'object') return null;
    if (data.id) return data;

    for (const alias of aliases) {
        if (data[alias] && typeof data[alias] === 'object') {
            return extractEntityFromResponse(data[alias], aliases);
        }
    }

    if (data.data && typeof data.data === 'object') {
        return extractEntityFromResponse(data.data, aliases);
    }

    return null;
}

export function buildPersonFormStateFromClient(client = {}) {
    return {
        ...PERSON_FORM_INITIAL_VALUES,
        first_name: client.first_name ?? '',
        last_name: client.last_name ?? '',
        identification_number: client.identification_number ?? '',
        email: client.email ?? '',
        phone: client.phone ?? '',
        address: client.address ?? '',
        type: client.type ?? 'person',
        gender: client.gender ?? '',
        notes: client.notes ?? '',
    };
}

export function buildPersonFormStateFromParte(parte = {}) {
    return {
        ...PERSON_FORM_INITIAL_VALUES,
        first_name: parte.nombre ?? '',
        last_name: parte.apellido ?? '',
        identification_number: parte.identificacion ?? '',
        email: parte.email ?? '',
        phone: parte.telefono ?? '',
        address: parte.direccion ?? '',
        gender: parte.genero ?? '',
        notes: parte.notas ?? '',
        rol_id: parte.rol_id != null ? String(parte.rol_id) : '',
    };
}

export function logPayloadValidationError(action, entity, payload, error) {
    logger.error(`${entity} payload validation failed during ${action}`, {
        error: error.message,
        failedFields: error.details ?? [],
        providedFields: Object.keys(payload || {}),
    });
}
