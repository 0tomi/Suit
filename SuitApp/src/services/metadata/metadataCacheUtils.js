import { createLogger } from '../logService.js';

function getRowColumns(rows) {
    return rows[0] ? Object.keys(rows[0]) : [];
}

export function extractMetadataCollection(payload, resourceName = null) {
    if (Array.isArray(payload)) return payload;

    if (!payload || typeof payload !== 'object') {
        return null;
    }

    if (resourceName && Array.isArray(payload[resourceName])) {
        return payload[resourceName];
    }

    if (Array.isArray(payload.data)) return payload.data;
    if (Array.isArray(payload.items)) return payload.items;
    if (Array.isArray(payload.records)) return payload.records;
    if (Array.isArray(payload.case_types)) return payload.case_types;
    if (Array.isArray(payload.event_types)) return payload.event_types;

    return null;
}

export function summarizePayload(payload) {
    if (Array.isArray(payload)) {
        return { kind: 'array', length: payload.length };
    }

    if (!payload || typeof payload !== 'object') {
        return { kind: typeof payload, length: null };
    }

    return {
        kind: 'object',
        keys: Object.keys(payload).sort(),
    };
}

export function createAuditLogger(scope) {
    const logger = createLogger(`metadata-sync:${scope}`);

    return {
        info(message, details) {
            return logger.info(message, details);
        },
        warn(message, details) {
            return logger.warn(message, details);
        },
        error(message, details) {
            return logger.error(message, details);
        },
    };
}

export async function replaceCachedRows(table, rows, { logger, fallbackRows = null } = {}) {
    const primaryColumns = getRowColumns(rows);

    logger.info('replacing cache', {
        table,
        rowCount: rows.length,
        columns: primaryColumns,
    });

    await window.electronAPI.db.clearTable(table);

    if (rows.length === 0) {
        logger.warn('API returned 0 rows; cache cleared', { table });
        return [];
    }

    try {
        await window.electronAPI.db.upsertMany(table, rows);
        const persistedRows = await window.electronAPI.db.getAll(table);
        logger.info('cache persisted', {
            table,
            rowCount: persistedRows.length,
            columns: primaryColumns,
        });
        return persistedRows;
    } catch (error) {
        logger.error('primary upsert failed', {
            table,
            rowCount: rows.length,
            columns: primaryColumns,
            error: error?.message || String(error),
        });

        if (!fallbackRows || fallbackRows.length === 0) {
            throw error;
        }

        const fallbackColumns = getRowColumns(fallbackRows);
        logger.warn('retrying fallback upsert', {
            table,
            rowCount: fallbackRows.length,
            columns: fallbackColumns,
        });

        await window.electronAPI.db.clearTable(table);
        await window.electronAPI.db.upsertMany(table, fallbackRows);

        const persistedRows = await window.electronAPI.db.getAll(table);
        logger.info('fallback cache persisted', {
            table,
            rowCount: persistedRows.length,
            columns: fallbackColumns,
        });
        return persistedRows;
    }
}
