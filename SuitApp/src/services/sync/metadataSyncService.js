import { syncResource } from './syncCore.js';
import { apiGet } from '../api.js';
import {
    createAuditLogger,
    extractMetadataCollection,
    replaceCachedRows,
    summarizePayload,
} from '../metadata/metadataCacheUtils.js';

// ─── Catálogos nuevos ──────────────────────────────────────────────────────────

export async function syncRadicaciones() {
    return await syncResource('radicaciones', null, fetchAndCacheSimpleCatalog({
        endpoint: '/radicaciones',
        table: 'radicaciones',
        buildRow: (item) => ({
            id: item.id,
            // La API devuelve el campo como `nombre_lugar`
            name: item.nombre_lugar || null,
            data_json: JSON.stringify(item),
            synced_at: new Date().toISOString(),
        }),
    }));
}

export async function syncTipoExpedientes() {
    return await syncResource('tipo_expedientes', '/tipo-expedientes/last-modified', fetchAndCacheSimpleCatalog({
        endpoint: '/tipo-expedientes',
        table: 'tipo_expedientes',
        buildRow: (item) => ({
            id: item.id,
            case_type_id: item.case_type_id || null,
            // La API devuelve `titulo` y `detalles`
            title: item.titulo || null,
            details: item.detalles || null,
            data_json: JSON.stringify(item),
            synced_at: new Date().toISOString(),
        }),
    }));
}

export async function syncRoles() {
    return await syncResource('roles', null, fetchAndCacheSimpleCatalog({
        endpoint: '/roles',
        table: 'roles',
        buildRow: (item) => ({
            id: item.id,
            titulo: item.titulo,
            data_json: JSON.stringify(item),
            synced_at: new Date().toISOString(),
        }),
    }));
}

export async function syncTipoPagos() {
    return await syncResource('tipo_pagos', null, fetchAndCacheSimpleCatalog({
        endpoint: '/tipo-pagos',
        table: 'tipo_pagos',
        buildRow: (item) => ({
            id: item.id,
            // La API devuelve el campo como `titulo`
            name: item.titulo || null,
            data_json: JSON.stringify(item),
            synced_at: new Date().toISOString(),
        }),
    }));
}

export async function syncGastosCatalogo() {
    return await syncResource('gastos_catalogo', '/gastos/last-modified', fetchAndCacheSimpleCatalog({
        endpoint: '/gastos',
        table: 'gastos_catalogo',
        buildRow: (item) => ({
            id: item.id,
            titulo: item.titulo || item.name || null,
            detalles: item.detalles || item.description || null,
            data_json: JSON.stringify(item),
            synced_at: new Date().toISOString(),
        }),
    }));
}

export async function syncPartes() {
    return await syncResource('partes', null, fetchAndCacheSimpleCatalog({
        endpoint: '/partes',
        table: 'partes',
        buildRow: (item) => ({
            id: item.id,
            nombre: item.nombre,
            apellido: item.apellido,
            email: item.email || null,
            telefono: item.telefono || null,
            rol_id: item.rol_id || null,
            data_json: JSON.stringify(item),
            synced_at: new Date().toISOString(),
        }),
    }));
}

/**
 * Factoría genérica para catálogos simples: fetch completo + replace en SQLite.
 * Devuelve una función compatible con la firma de fetchFn de syncResource.
 */
function fetchAndCacheSimpleCatalog({ endpoint, table, buildRow }) {
    return async function () {
        const logger = createAuditLogger(table);
        logger.info('fetch start');
        const result = await apiGet(endpoint);

        if (!result?.ok) {
            logger.error('request failed', {
                status: result?.status ?? null,
                error: result?.error ?? null,
                payload: summarizePayload(result?.data),
            });
            throw new Error(`No se pudo sincronizar ${table}.`);
        }

        logger.info('response received', {
            status: result.status,
            payload: summarizePayload(result.data),
        });

        const items = extractMetadataCollection(result.data, table);
        if (!items) {
            logger.error('invalid payload shape', {
                status: result.status,
                payload: summarizePayload(result.data),
            });
            throw new Error(`Respuesta inválida al sincronizar ${table}.`);
        }

        const rows = items.map(buildRow);
        logger.info('mapped rows', { rowCount: rows.length });

        await replaceCachedRows(table, rows, { logger });
        return true;
    };
}

export async function syncCaseTypes() {
    return await syncResource('case_types', null, fetchAndCacheCaseTypes);
}

export async function syncEventTypes() {
    return await syncResource('event_types', null, fetchAndCacheEventTypes);
}

function buildCaseTypeCacheRow(caseType, { includeEventColor = true } = {}) {
    const row = {
        id: caseType.id,
        name: caseType.name,
        description: caseType.description || null,
        data_json: JSON.stringify(caseType),
        synced_at: new Date().toISOString(),
    };

    if (includeEventColor) {
        row.eventColor = caseType.eventColor || null;
    }

    return row;
}

function buildEventTypeCacheRow(eventType) {
    return {
        id: eventType.id,
        name: eventType.name,
        color: eventType.color || null,
        data_json: JSON.stringify(eventType),
        synced_at: new Date().toISOString(),
    };
}

async function fetchAndCacheCaseTypes() {
    const logger = createAuditLogger('case_types');
    logger.info('fetch start');
    const result = await apiGet('/case-types');

    if (!result?.ok) {
        logger.error('request failed', {
            status: result?.status ?? null,
            error: result?.error ?? null,
            payload: summarizePayload(result?.data),
        });
        throw new Error('No se pudo sincronizar case_types.');
    }

    logger.info('response received', {
        status: result.status,
        payload: summarizePayload(result.data),
    });

    const caseTypes = extractMetadataCollection(result.data, 'case_types');
    if (!caseTypes) {
        logger.error('invalid payload shape', {
            status: result.status,
            payload: summarizePayload(result.data),
        });
        throw new Error('Respuesta inválida al sincronizar case_types.');
    }

    const rows = caseTypes.map((caseType) => buildCaseTypeCacheRow(caseType, { includeEventColor: true }));
    const fallbackRows = caseTypes.map((caseType) => buildCaseTypeCacheRow(caseType, { includeEventColor: false }));

    logger.info('mapped rows', { rowCount: rows.length });

    await replaceCachedRows('case_types', rows, {
        logger,
        fallbackRows,
    });
    return true;
}

async function fetchAndCacheEventTypes() {
    const logger = createAuditLogger('event_types');
    logger.info('fetch start');
    const result = await apiGet('/event-types');

    if (!result?.ok) {
        logger.error('request failed', {
            status: result?.status ?? null,
            error: result?.error ?? null,
            payload: summarizePayload(result?.data),
        });
        throw new Error('No se pudo sincronizar event_types.');
    }

    logger.info('response received', {
        status: result.status,
        payload: summarizePayload(result.data),
    });

    const eventTypes = extractMetadataCollection(result.data, 'event_types');
    if (!eventTypes) {
        logger.error('invalid payload shape', {
            status: result.status,
            payload: summarizePayload(result.data),
        });
        throw new Error('Respuesta inválida al sincronizar event_types.');
    }

    const rows = eventTypes.map(buildEventTypeCacheRow);
    logger.info('mapped rows', { rowCount: rows.length });

    await replaceCachedRows('event_types', rows, { logger });
    return true;
}

export default { syncCaseTypes, syncEventTypes };
