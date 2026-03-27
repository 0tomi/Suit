const {
    getBitacoraPageFromApi,
    clearBitacoraInApi,
    cleanupBitacoraInApi,
} = require('./bitacoraApi.cjs');
const { getConfig } = require('./database.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('bitacora:service');
const ALLOWED_ENTITY_TYPES = new Set([
    'case',
    'client',
    'document',
    'agenda',
    'event',
    'user',
    'multimedia',
    'file',
    'role',
    'jurisdiction',
    'competency',
    'judicial_dependency',
    'tax',
    'fee',
    'delivery',
    'radicacion',
    'tombstone',
]);
const ALLOWED_SORTS = new Set(['newest', 'oldest']);
const DEFAULT_PER_PAGE = 30;

function parseJsonSafely(value) {
    if (!value || typeof value !== 'string') return null;

    try {
        return JSON.parse(value);
    } catch (error) {
        logger.error('failed to parse auth_user config while checking bitacora access', {
            error: error?.message || String(error),
        });
        return null;
    }
}

function getCurrentUser() {
    const payload = parseJsonSafely(getConfig('auth_user'));
    return payload && typeof payload === 'object' ? payload : null;
}

/**
 * La API ya protege la bitácora, pero validamos el rol acá para fallar antes del request
 * y dejar el motivo explícito en logs si el renderer intenta acceder fuera del panel admin.
 */
function ensureAdminAccess(action) {
    const currentUser = getCurrentUser();
    if (currentUser?.role === 'admin') {
        return currentUser;
    }

    logger.warn('bitacora access denied for non-admin user', {
        action,
        userId: currentUser?.id ?? null,
        role: currentUser?.role ?? null,
    });
    throw new Error('Solo los administradores pueden acceder a la bitácora.');
}

function normalizePositiveInteger(value, field) {
    const normalized = Number(value);
    if (!Number.isInteger(normalized) || normalized < 1) {
        throw new Error(`"${field}" debe ser un entero positivo.`);
    }
    return normalized;
}

function normalizeListOptions(options = {}) {
    const normalized = {};

    if (options.entityType != null && options.entityType !== '' && options.entityType !== 'all') {
        if (typeof options.entityType !== 'string' || !ALLOWED_ENTITY_TYPES.has(options.entityType)) {
            throw new Error('El filtro de entidad para la bitácora es inválido.');
        }
        normalized.entity_type = options.entityType;
    }

    if (options.sort != null && options.sort !== '') {
        if (typeof options.sort !== 'string' || !ALLOWED_SORTS.has(options.sort)) {
            throw new Error('El orden para la bitácora es inválido.');
        }
        normalized.sort = options.sort;
    }

    if (options.page != null) {
        normalized.page = normalizePositiveInteger(options.page, 'page');
    }

    return normalized;
}

function extractCollection(payload) {
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload)) return payload;
    return null;
}

function extractPaginationMeta(payload) {
    return {
        currentPage:
            Number(payload?.meta?.current_page)
            || Number(payload?.current_page)
            || 1,
        lastPage:
            Number(payload?.meta?.last_page)
            || Number(payload?.last_page)
            || 1,
        total:
            Number(payload?.meta?.total)
            || Number(payload?.total)
            || 0,
        perPage:
            Number(payload?.meta?.per_page)
            || Number(payload?.per_page)
            || DEFAULT_PER_PAGE,
    };
}

function normalizeUserSummary(rawUser, entryId) {
    if (rawUser == null) {
        logger.warn('bitacora entry arrived without user payload', { entryId });
        return null;
    }

    if (typeof rawUser !== 'object') {
        logger.warn('bitacora entry arrived with invalid user payload', {
            entryId,
            receivedType: typeof rawUser,
        });
        return null;
    }

    return {
        id: rawUser.id ?? null,
        name: typeof rawUser.name === 'string' ? rawUser.name.trim() : '',
        lastName: typeof rawUser.last_name === 'string' ? rawUser.last_name.trim() : '',
    };
}

function normalizeEntityPayload(rawData, entryId) {
    if (rawData === null) {
        return null;
    }

    if (!rawData || typeof rawData !== 'object') {
        logger.warn('bitacora entry arrived with invalid entity data payload', {
            entryId,
            receivedType: typeof rawData,
        });
        return null;
    }

    const rawAttributes = rawData.attributes;
    if (rawAttributes != null && typeof rawAttributes !== 'object') {
        logger.warn('bitacora entity attributes payload is invalid', {
            entryId,
            receivedType: typeof rawAttributes,
        });
    }

    return {
        id: rawData.id ?? null,
        name: typeof rawData.name === 'string' ? rawData.name.trim() : '',
        attributes: rawAttributes && typeof rawAttributes === 'object' ? rawAttributes : {},
    };
}

function normalizeEntityInfo(rawEntityInfo, entryId) {
    if (!rawEntityInfo || typeof rawEntityInfo !== 'object') {
        logger.warn('bitacora entry arrived without entity_info payload', { entryId });
        return {
            id: null,
            type: null,
            name: '',
            data: null,
        };
    }

    const entityType = typeof rawEntityInfo.type === 'string' ? rawEntityInfo.type.trim() : null;
    if (entityType && !ALLOWED_ENTITY_TYPES.has(entityType)) {
        logger.warn('bitacora entry arrived with unknown entity type', {
            entryId,
            entityType,
        });
    }

    const normalizedData = normalizeEntityPayload(rawEntityInfo.data, entryId);
    const fallbackName = normalizedData?.name || '';

    return {
        id: rawEntityInfo.id ?? normalizedData?.id ?? null,
        type: entityType,
        name: fallbackName,
        data: normalizedData,
    };
}

/**
 * Normaliza cada fila para que el renderer no tenga que lidiar con el shape crudo de Laravel.
 */
function normalizeBitacoraEntry(rawEntry, index) {
    if (!rawEntry || typeof rawEntry !== 'object') {
        logger.warn('bitacora entry payload is not an object', {
            index,
            receivedType: typeof rawEntry,
        });
        return null;
    }

    const entryId = rawEntry.id ?? `row-${index}`;
    return {
        id: rawEntry.id ?? null,
        action: typeof rawEntry.action === 'string' ? rawEntry.action.trim() : '',
        createdAt: typeof rawEntry.created_at === 'string' ? rawEntry.created_at : '',
        user: normalizeUserSummary(rawEntry.user, entryId),
        entityInfo: normalizeEntityInfo(rawEntry.entity_info, entryId),
    };
}

async function listBitacora(options = {}) {
    ensureAdminAccess('list');
    const query = normalizeListOptions(options);
    const response = await getBitacoraPageFromApi(query);

    if (!response.ok) {
        logger.error('bitacora page request failed', {
            status: response.status,
            error: response.error || null,
            data: response.data,
            query,
        });
        throw new Error(response.data?.message || response.error || 'No se pudo obtener la bitácora desde la API.');
    }

    const rows = extractCollection(response.data);
    if (!rows) {
        logger.error('bitacora page response did not include a valid collection payload', {
            data: response.data,
            query,
        });
        throw new Error('La API devolvió una respuesta inválida para la bitácora.');
    }

    const items = rows
        .map((row, index) => normalizeBitacoraEntry(row, index))
        .filter(Boolean);
    const pagination = extractPaginationMeta(response.data);

    return {
        items,
        pagination,
        appliedFilters: {
            entityType: query.entity_type ?? 'all',
            sort: query.sort ?? 'newest',
            page: query.page ?? 1,
        },
    };
}

async function clearBitacora() {
    ensureAdminAccess('clear');
    const response = await clearBitacoraInApi();

    if (!response.ok) {
        logger.error('bitacora clear request failed', {
            status: response.status,
            error: response.error || null,
            data: response.data,
        });
    }

    return response;
}

async function cleanupBitacora(days) {
    ensureAdminAccess('cleanup');
    const normalizedDays = normalizePositiveInteger(days, 'days');
    const response = await cleanupBitacoraInApi(normalizedDays);

    if (!response.ok) {
        logger.error('bitacora cleanup request failed', {
            status: response.status,
            error: response.error || null,
            data: response.data,
            days: normalizedDays,
        });
    }

    return response;
}

module.exports = {
    listBitacora,
    clearBitacora,
    cleanupBitacora,
};
