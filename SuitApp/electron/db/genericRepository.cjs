const {
    GLOBAL_CONFIG_KEYS,
    TABLE_COLUMN_WHITELIST,
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
    const safeTable = String(table);
    assertAllowedTable(safeTable);

    if (!rows || rows.length === 0) return;

    const whitelist = TABLE_COLUMN_WHITELIST[safeTable];
    if (!whitelist) {
        throw new Error(`No whitelist defined for table "${safeTable}"`);
    }

    // Filtramos las columnas basándonos en la whitelist.
    // Usamos las llaves de la primera fila pero filtradas.
    const columns = Object.keys(rows[0]).filter((col) => whitelist.has(col));

    if (columns.length === 0) {
        throw new Error(`No valid columns found for table "${safeTable}" in the provided data`);
    }

    // assertAllowedColumns(safeTable, columns); // No longer needed as columns are filtered by whitelist
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

/**
 * Devuelve el número de filas de una tabla sin serializar ningún dato.
 * Mucho más eficiente que getAll() cuando solo se necesita saber si la tabla está vacía.
 */
function count(dbInstance, table) {
    const safeTable = assertAllowedTable(table);
    if (!dbInstance) return 0;
    return dbInstance.prepare(`SELECT COUNT(*) AS cnt FROM ${safeTable}`).get()?.cnt ?? 0;
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
        'document_versions',
        'document_query_cache',
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
        'case_tipo_expediente',
        // Biblioteca de archivos públicos
        'public_file_catalogs',
        'public_files',
        'public_file_permissions',
        // Sistema de requisitos para plantillas
        'requisitos',
        'plantilla_requisitos',
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
            (SELECT COUNT(*) FROM deadlines WHERE suit_case_id = ?) as deadlinesCount,
            (SELECT COUNT(*) FROM events WHERE suit_case_id = ? 
             AND id NOT IN (SELECT event_id FROM deadlines WHERE event_id IS NOT NULL AND suit_case_id = ?)) as eventsCount
    `).get(normalizedCaseId, normalizedCaseId, normalizedCaseId) || {};

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

/**
 * Obtiene todos los vencimientos con información de la agenda asociada.
 */
function getAllDeadlinesEnriched(dbInstance) {
    if (!dbInstance) return [];
    return dbInstance.prepare(`
        SELECT 
            d.*,
            a.name AS agenda_name,
            a.color AS agenda_color,
            a.suit_case_id AS agenda_suit_case_id,
            u.name AS owner_name,
            u.id AS owner_id,
            c.title AS case_title
        FROM deadlines d
        -- Usamos json_extract porque el evento puede no estar en la cache local si el mes no se visitó,
        -- pero la info de la agenda SI está embebida en el data_json del vencimiento.
        LEFT JOIN agendas a ON json_extract(d.data_json, '$.event.agenda_id') = a.id
        LEFT JOIN users u ON a.user_id = u.id
        LEFT JOIN cases c ON d.suit_case_id = c.id
    `).all();
}

/**
 * Obtiene los requisitos de una plantilla como un JOIN entre plantilla_requisitos y requisitos.
 * Filtra filas con soft-delete en ambas tablas y ordena por id de relación (orden de definición).
 * @returns {Array<{id, id_campo, requisito_id, type, title}>}
 */
function getTemplateRequirements(dbInstance, templateId) {
    if (!dbInstance) return [];
    return dbInstance.prepare(`
        SELECT pr.id, pr.id_campo, pr.requisito_id,
               COALESCE(pr.NEntidad, 1) AS NEntidad,
               pr.note,
               r.type, r.title
        FROM plantilla_requisitos pr
        JOIN requisitos r ON r.id = pr.requisito_id
        WHERE pr.template_id = ?
          AND pr.deleted_at IS NULL
          AND r.deleted_at IS NULL
        ORDER BY pr.id ASC
    `).all(templateId) ?? [];
}

/**
 * Obtiene las dependencias judiciales enriquecidas con JOINs, filtradas por jurisdicción y radicación.
 */
function getEnrichedDependencies(dbInstance, jurisdiccionId, radicacionId) {
    if (!dbInstance) return [];

    let query = `
        SELECT 
            d.*,
            j.nombre AS jurisdiccion_nombre,
            c.fuero AS competencia_nombre,
            r.name AS radicacion_nombre
        FROM dependencias_judiciales d
        LEFT JOIN jurisdicciones j ON d.jurisdiccion_id = j.id
        LEFT JOIN competencias c ON d.competencia_id = c.id
        LEFT JOIN radicaciones r ON d.radicacion_id = r.id
        WHERE 1=1
    `;

    const params = [];

    if (jurisdiccionId) {
        query += ' AND d.jurisdiccion_id = ?';
        params.push(jurisdiccionId);
    }

    if (radicacionId) {
        query += ' AND d.radicacion_id = ?';
        params.push(radicacionId);
    }

    query += ' ORDER BY d.nombre_juzgado ASC';

    return dbInstance.prepare(query).all(...params);
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
    count,
    getById,
    deleteById,
    deleteWhere,
    clearTable,
    clearAllResourceTables,
    getCaseKpis,
    getCaseNextEvent,
    getAllDeadlinesEnriched,
    getEnrichedDependencies,
    getTemplateRequirements,
};
