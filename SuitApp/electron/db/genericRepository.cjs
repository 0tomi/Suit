const {
    GLOBAL_CONFIG_KEYS,
    assertAllowedColumns,
    assertAllowedTable,
} = require('./shared.cjs');
const {
    getConfigValue,
    setConfigValue,
    deleteConfigValue,
    getAllConfigValues,
} = require('./configStore.cjs');
const { getLogger } = require('../logService.cjs');

const logger = getLogger('db:generic-repository');

function getConfigDb(globalDb, activeProfileDb, key) {
    return GLOBAL_CONFIG_KEYS.has(key) ? globalDb : activeProfileDb;
}

function getConfig(globalDb, activeProfileDb, key) {
    return getConfigValue(getConfigDb(globalDb, activeProfileDb, key), key);
}

function setConfig(globalDb, activeProfileDb, key, value) {
    const targetDb = getConfigDb(globalDb, activeProfileDb, key);
    if (!targetDb) {
        throw new Error(`Cannot set config "${key}" without an active profile.`);
    }
    setConfigValue(targetDb, key, value);
}

function deleteConfig(globalDb, activeProfileDb, key) {
    deleteConfigValue(getConfigDb(globalDb, activeProfileDb, key), key);
}

function getAllConfig(globalDb, activeProfileDb) {
    return {
        ...getAllConfigValues(globalDb),
        ...getAllConfigValues(activeProfileDb),
    };
}

function getSyncMeta(dbInstance, resource) {
    if (!dbInstance) return null;
    return dbInstance.prepare('SELECT * FROM sync_meta WHERE resource = ?').get(resource) || null;
}

function setSyncMeta(dbInstance, resource, lastSync, lastServer) {
    if (!dbInstance) return;
    dbInstance.prepare(
        'INSERT OR REPLACE INTO sync_meta (resource, last_sync, last_server) VALUES (?, ?, ?)'
    ).run(resource, lastSync, lastServer);
}

function upsertMany(dbInstance, table, rows) {
    const safeTable = assertAllowedTable(table);
    if (!rows || rows.length === 0) return;

    const columns = Object.keys(rows[0]);
    if (columns.length === 0) return;

    assertAllowedColumns(safeTable, columns);
    if (!dbInstance) return;

    const placeholders = columns.map(() => '?').join(', ');
    const columnList = columns.join(', ');
    const stmt = dbInstance.prepare(
        `INSERT OR REPLACE INTO ${safeTable} (${columnList}) VALUES (${placeholders})`
    );

    const insertMany = dbInstance.transaction((items) => {
        for (const item of items) {
            stmt.run(...columns.map((col) => item[col] ?? null));
        }
    });

    insertMany(rows);
}

function getAll(dbInstance, table) {
    const safeTable = assertAllowedTable(table);
    if (!dbInstance) return [];
    return dbInstance.prepare(`SELECT * FROM ${safeTable}`).all();
}

function getById(dbInstance, table, id) {
    const safeTable = assertAllowedTable(table);
    if (!dbInstance) return null;
    return dbInstance.prepare(`SELECT * FROM ${safeTable} WHERE id = ?`).get(id) || null;
}

function deleteById(dbInstance, table, id) {
    const safeTable = assertAllowedTable(table);
    if (!dbInstance) return;
    dbInstance.prepare(`DELETE FROM ${safeTable} WHERE id = ?`).run(id);
}

/**
 * Elimina filas de una tabla donde las columnas coincidan con el objeto `conditions`.
 * Todas las claves son validadas contra el whitelist antes de construir la query.
 * Diseñado para limpiar tablas con PK compuesta (ej: parte_caso).
 */
function deleteWhere(dbInstance, table, conditions) {
    const safeTable = assertAllowedTable(table);
    if (!dbInstance || !conditions || Object.keys(conditions).length === 0) return;

    const columns = Object.keys(conditions);
    assertAllowedColumns(safeTable, columns);

    const whereClauses = columns.map((col) => `${col} = ?`).join(' AND ');
    const values = columns.map((col) => conditions[col]);
    dbInstance.prepare(`DELETE FROM ${safeTable} WHERE ${whereClauses}`).run(...values);
}

function clearTable(dbInstance, table) {
    const safeTable = assertAllowedTable(table);
    if (!dbInstance) return;
    dbInstance.prepare(`DELETE FROM ${safeTable}`).run();
}

/**
 * Obtiene todos los timestamps per-entity de un caso desde case_sync_meta.
 * @returns {Object} Mapa { entity: { last_sync, last_server } }
 */
function getCaseSyncMeta(dbInstance, caseId) {
    if (!dbInstance) return {};
    const rows = dbInstance.prepare(
        'SELECT entity, last_sync, last_server FROM case_sync_meta WHERE suit_case_id = ?'
    ).all(caseId);
    const result = {};
    for (const row of rows) {
        result[row.entity] = { last_sync: row.last_sync, last_server: row.last_server };
    }
    return result;
}

/**
 * Actualiza o inserta un timestamp per-entity para un caso.
 */
function setCaseSyncMeta(dbInstance, caseId, entity, lastSync, lastServer) {
    if (!dbInstance) return;
    dbInstance.prepare(
        'INSERT OR REPLACE INTO case_sync_meta (suit_case_id, entity, last_sync, last_server) VALUES (?, ?, ?, ?)'
    ).run(caseId, entity, lastSync, lastServer);
}

/**
 * Actualiza múltiples timestamps per-entity en una transacción.
 * @param {Array<{ entity: string, lastSync: string, lastServer: string }>} entries
 */
function setCaseSyncMetaBatch(dbInstance, caseId, entries) {
    if (!dbInstance || !entries || entries.length === 0) return;
    const stmt = dbInstance.prepare(
        'INSERT OR REPLACE INTO case_sync_meta (suit_case_id, entity, last_sync, last_server) VALUES (?, ?, ?, ?)'
    );
    const batch = dbInstance.transaction((items) => {
        for (const { entity, lastSync, lastServer } of items) {
            stmt.run(caseId, entity, lastSync, lastServer);
        }
    });
    batch(entries);
}

/**
 * Limpia toda la sync_meta de un caso (ej: al cerrar sesión o eliminar caso de cache).
 */
function clearCaseSyncMeta(dbInstance, caseId) {
    if (!dbInstance) return;
    dbInstance.prepare('DELETE FROM case_sync_meta WHERE suit_case_id = ?').run(caseId);
}

function clearAllResourceTables(dbInstance) {
    if (!dbInstance) return;

    const resourceTables = [
        'users',
        'events',
        'cases',
        'documents',
        'clients',
        'agendas',
        'deadlines',
        'event_types',
        'event_notifications',
        'event_outbox',
        'notification_deliveries',
        'case_types',
        'templates',
        'template_categories',
        'sync_meta',
        // Catálogos y módulos transaccionales nuevos
        'radicaciones',
        'tipo_expedientes',
        'roles',
        'tipo_pagos',
        'gastos_catalogo',
        'partes',
        'parte_caso',
        'honorarios',
        'entregas',
        'gasto_suit_cases',
        // Sync per-caso y multimedia/files
        'case_sync_meta',
        'multimedia',
        'files',
        // Biblioteca de archivos públicos
        'public_file_catalogs',
        'public_files',
        'public_file_permissions',
    ];

    const clearTransaction = dbInstance.transaction(() => {
        for (const table of resourceTables) {
            dbInstance.prepare(`DELETE FROM ${table}`).run();
        }
    });

    try {
        clearTransaction();
    } catch (err) {
        logger.error('Failed to clear resource tables', err);
        throw err;
    }
}

/**
 * Resume los KPI del detalle de caso usando la caché local ya hidratada.
 * La regla elegida es: tipo "Vencimiento" cuenta como vencimiento, el resto como evento.
 */
function getCaseKpis(dbInstance, caseId) {
    if (!dbInstance) {
        return {
            deadlinesCount: 0,
            eventsCount: 0,
            documentsCount: 0,
        };
    }

    const normalizedCaseId = Number(caseId);
    if (!Number.isInteger(normalizedCaseId) || normalizedCaseId < 1) {
        throw new Error(`Invalid caseId "${String(caseId)}"`);
    }

    const eventSummary = dbInstance.prepare(`
        SELECT
            COALESCE(SUM(CASE WHEN event_types.name = 'Vencimiento' THEN 1 ELSE 0 END), 0) AS deadlinesCount,
            COALESCE(SUM(CASE WHEN event_types.name = 'Vencimiento' THEN 0 ELSE 1 END), 0) AS eventsCount
        FROM events
        LEFT JOIN event_types ON event_types.id = events.event_type_id
        WHERE events.suit_case_id = ?
    `).get(normalizedCaseId) || {};

    const documentSummary = dbInstance.prepare(`
        SELECT COUNT(*) AS documentsCount
        FROM documents
        WHERE suit_case_id = ?
    `).get(normalizedCaseId) || {};

    return {
        deadlinesCount: Number(eventSummary.deadlinesCount || 0),
        eventsCount: Number(eventSummary.eventsCount || 0),
        documentsCount: Number(documentSummary.documentsCount || 0),
    };
}

/**
 * Devuelve el próximo evento del caso (starts_at > ahora), con el nombre del tipo.
 * Retorna null si no hay eventos futuros.
 */
function getCaseNextEvent(dbInstance, caseId) {
    if (!dbInstance) return null;

    const normalizedCaseId = Number(caseId);
    if (!Number.isInteger(normalizedCaseId) || normalizedCaseId < 1) {
        throw new Error(`Invalid caseId "${String(caseId)}"`);
    }

    // starts_at se guarda como naive local ("YYYY-MM-DDTHH:mm:ss"), sin zona horaria.
    // Construimos el "ahora" en el mismo formato para que la comparación lexicográfica funcione.
    const d = new Date();
    const pad = (n) => String(n).padStart(2, '0');
    const nowNaive = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;

    return dbInstance.prepare(`
        SELECT
            events.id,
            events.title,
            events.starts_at,
            event_types.name AS event_type_name
        FROM events
        LEFT JOIN event_types ON event_types.id = events.event_type_id
        WHERE events.suit_case_id = ?
          AND events.starts_at > ?
          AND (events.data_json IS NULL OR events.data_json NOT LIKE '%"pending_sync":true%')
        ORDER BY events.starts_at ASC
        LIMIT 1
    `).get(normalizedCaseId, nowNaive) ?? null;
}

module.exports = {
    getConfig,
    setConfig,
    deleteConfig,
    getAllConfig,
    getSyncMeta,
    setSyncMeta,
    getCaseSyncMeta,
    setCaseSyncMeta,
    setCaseSyncMetaBatch,
    clearCaseSyncMeta,
    upsertMany,
    getAll,
    getById,
    deleteById,
    deleteWhere,
    clearTable,
    clearAllResourceTables,
    getCaseKpis,
    getCaseNextEvent,
};
