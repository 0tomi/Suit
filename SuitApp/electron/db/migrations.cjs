const {
    EVENT_NOTIFICATION_SCHEDULED,
    EVENT_NOTIFICATION_PENDING_READ,
    buildEventDateFromParts,
    parseJsonSafe,
} = require('./shared.cjs');
const { getConfigValue, setConfigValue } = require('./configStore.cjs');
const { getLogger } = require('../logService.cjs');

const logger = getLogger('db:migrations');

function runTolerantMigrationSql(dbInstance, sql, version, label) {
    try {
        dbInstance.exec(sql);
    } catch (err) {
        logger.warn('Non-blocking migration step failed', {
            version,
            label,
            sql,
            error: err?.message || String(err),
        });
    }
}

function runMigrations(dbInstance) {
    const version = parseInt(getConfigValue(dbInstance, 'schema_version') || '0', 10);

    if (version < 1) {
        const alterStatements = [
            'ALTER TABLE documents ADD COLUMN updated_at TEXT',
            'ALTER TABLE documents ADD COLUMN created_at TEXT',
            'ALTER TABLE documents ADD COLUMN user_id INTEGER',
            'ALTER TABLE documents ADD COLUMN latest_version_number INTEGER',
            'ALTER TABLE documents ADD COLUMN latest_version_created_by INTEGER',
            'ALTER TABLE documents ADD COLUMN latest_version_creator_name TEXT',
            'ALTER TABLE documents ADD COLUMN latest_version_creator_tag TEXT',
            'ALTER TABLE documents ADD COLUMN locker_name TEXT',
            'ALTER TABLE documents ADD COLUMN data_json TEXT',
        ];
        for (const sql of alterStatements) {
            runTolerantMigrationSql(dbInstance, sql, 1, 'alter-documents');
        }
        runTolerantMigrationSql(dbInstance, 'DELETE FROM documents', 1, 'clear-documents-cache');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'documents'", 1, 'clear-documents-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '1');
    }
    if (version < 2) {
        runTolerantMigrationSql(dbInstance, 'DELETE FROM documents', 2, 'clear-documents-cache');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'documents'", 2, 'clear-documents-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '2');
    }
    if (version < 3) {
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS agendas (
                id           INTEGER PRIMARY KEY,
                name         TEXT,
                color        TEXT,
                suit_case_id INTEGER,
                user_id      INTEGER,
                data_json    TEXT,
                synced_at    TEXT
            )
        `);
        setConfigValue(dbInstance, 'schema_version', '3');
    }
    if (version < 4) {
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS event_types (
                id        INTEGER PRIMARY KEY,
                name      TEXT,
                color     TEXT,
                data_json TEXT,
                synced_at TEXT
            );
            CREATE TABLE IF NOT EXISTS event_notifications (
                event_id               INTEGER,
                user_id                INTEGER,
                when_to_notify_minutes INTEGER,
                data_json              TEXT,
                synced_at              TEXT,
                PRIMARY KEY (event_id, user_id)
            );
        `);
        runTolerantMigrationSql(dbInstance, 'ALTER TABLE events ADD COLUMN event_type_id INTEGER DEFAULT 1', 4, 'add-events-event-type-id');
        setConfigValue(dbInstance, 'schema_version', '4');
    }
    if (version < 5) {
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS case_types (
                id          INTEGER PRIMARY KEY,
                name        TEXT,
                description TEXT,
                data_json   TEXT,
                synced_at   TEXT
            );
        `);
        setConfigValue(dbInstance, 'schema_version', '5');
    }
    if (version < 6) {
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS notification_deliveries (
                event_id     INTEGER NOT NULL,
                user_id      INTEGER NOT NULL,
                notify_at    TEXT NOT NULL,
                kind         TEXT NOT NULL,
                status       TEXT NOT NULL,
                payload_json TEXT,
                shown_at     TEXT,
                clicked_at   TEXT,
                updated_at   TEXT,
                PRIMARY KEY (event_id, user_id, notify_at, kind)
            )
        `);
        setConfigValue(dbInstance, 'schema_version', '6');
    }
    if (version < 7) {
        runTolerantMigrationSql(dbInstance, 'ALTER TABLE case_types ADD COLUMN eventColor TEXT', 7, 'add-case-types-event-color');
        setConfigValue(dbInstance, 'schema_version', '7');
    }
    if (version < 8) {
        runTolerantMigrationSql(dbInstance, 'ALTER TABLE cases ADD COLUMN case_type_id INTEGER', 8, 'add-cases-case-type-id');
        runTolerantMigrationSql(dbInstance, 'ALTER TABLE cases ADD COLUMN updated_at TEXT', 8, 'add-cases-updated-at');
        runTolerantMigrationSql(dbInstance, 'DELETE FROM cases', 8, 'clear-cases-cache');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'cases'", 8, 'clear-cases-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '8');
    }
    if (version < 9) {
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS templates (
                id                   INTEGER PRIMARY KEY,
                title                TEXT,
                template_category_id INTEGER,
                data_json            TEXT,
                synced_at            TEXT
            );
            CREATE TABLE IF NOT EXISTS template_categories (
                id          INTEGER PRIMARY KEY,
                name        TEXT,
                description TEXT,
                data_json   TEXT,
                synced_at   TEXT
            );
        `);
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'templates'", 9, 'clear-templates-sync-meta');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'template_categories'", 9, 'clear-template-categories-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '9');
    }
    if (version < 10) {
        runTolerantMigrationSql(dbInstance, 'ALTER TABLE events ADD COLUMN suit_case_id INTEGER', 10, 'add-events-suit-case-id');
        runTolerantMigrationSql(dbInstance, 'UPDATE events SET suit_case_id = case_id WHERE suit_case_id IS NULL', 10, 'backfill-events-suit-case-id');
        setConfigValue(dbInstance, 'schema_version', '10');
    }
    if (version < 11) {
        const columns = dbInstance.prepare('PRAGMA table_info(event_notifications)').all();
        const columnNames = new Set(columns.map((column) => column.name));

        if (columnNames.has('when_to_notify_minutes')) {
            dbInstance.exec('ALTER TABLE event_notifications RENAME TO event_notifications_legacy_v11');
            dbInstance.exec(`
                CREATE TABLE event_notifications (
                    event_id        INTEGER,
                    user_id         INTEGER,
                    notify_at       TEXT,
                    last_updated_at TEXT,
                    status          TEXT NOT NULL DEFAULT 'scheduled',
                    handled_at      TEXT,
                    data_json       TEXT,
                    synced_at       TEXT,
                    PRIMARY KEY (event_id, user_id)
                )
            `);

            const legacyRows = dbInstance.prepare(`
                SELECT
                    event_notifications_legacy_v11.event_id,
                    event_notifications_legacy_v11.user_id,
                    event_notifications_legacy_v11.when_to_notify_minutes,
                    event_notifications_legacy_v11.data_json,
                    event_notifications_legacy_v11.synced_at,
                    events.date,
                    events.time
                FROM event_notifications_legacy_v11
                LEFT JOIN events ON events.id = event_notifications_legacy_v11.event_id
            `).all();

            const insertStmt = dbInstance.prepare(`
                INSERT OR REPLACE INTO event_notifications (
                    event_id,
                    user_id,
                    notify_at,
                    last_updated_at,
                    status,
                    handled_at,
                    data_json,
                    synced_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `);

            const insertMany = dbInstance.transaction((rowsToInsert) => {
                for (const row of rowsToInsert) {
                    insertStmt.run(
                        row.event_id,
                        row.user_id,
                        row.notify_at,
                        row.last_updated_at,
                        row.status,
                        row.handled_at,
                        row.data_json,
                        row.synced_at,
                    );
                }
            });

            const migratedRows = [];
            const now = new Date();
            const nowIso = now.toISOString();

            for (const row of legacyRows) {
                const eventDate = buildEventDateFromParts(row.date, row.time);
                const minutes = Number(row.when_to_notify_minutes);
                if (!eventDate || !Number.isFinite(minutes)) continue;

                const notifyAt = new Date(eventDate.getTime() - (minutes * 60 * 1000));
                if (Number.isNaN(notifyAt.getTime())) continue;

                const status = notifyAt <= now
                    ? EVENT_NOTIFICATION_PENDING_READ
                    : EVENT_NOTIFICATION_SCHEDULED;
                const handledAt = status === EVENT_NOTIFICATION_SCHEDULED ? null : nowIso;
                const legacyPayload = parseJsonSafe(row.data_json) || {};

                migratedRows.push({
                    event_id: row.event_id,
                    user_id: row.user_id,
                    notify_at: notifyAt.toISOString(),
                    last_updated_at: row.synced_at || nowIso,
                    status,
                    handled_at: handledAt,
                    data_json: JSON.stringify({
                        ...legacyPayload,
                        notify_at: notifyAt.toISOString(),
                        status,
                    }),
                    synced_at: row.synced_at || nowIso,
                });
            }

            if (migratedRows.length > 0) {
                insertMany(migratedRows);
            }

            dbInstance.exec('DROP TABLE event_notifications_legacy_v11');
        } else {
            runTolerantMigrationSql(dbInstance, 'ALTER TABLE event_notifications ADD COLUMN notify_at TEXT', 11, 'add-event-notifications-notify-at');
            runTolerantMigrationSql(dbInstance, 'ALTER TABLE event_notifications ADD COLUMN last_updated_at TEXT', 11, 'add-event-notifications-last-updated-at');
            runTolerantMigrationSql(
                dbInstance,
                `ALTER TABLE event_notifications ADD COLUMN status TEXT NOT NULL DEFAULT '${EVENT_NOTIFICATION_SCHEDULED}'`,
                11,
                'add-event-notifications-status'
            );
            runTolerantMigrationSql(dbInstance, 'ALTER TABLE event_notifications ADD COLUMN handled_at TEXT', 11, 'add-event-notifications-handled-at');
        }

        setConfigValue(dbInstance, 'schema_version', '11');
    }
    if (version < 12) {
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS event_outbox (
                local_event_id            INTEGER PRIMARY KEY,
                remote_event_id           INTEGER,
                event_payload_json        TEXT NOT NULL,
                notification_payload_json TEXT,
                status                    TEXT NOT NULL,
                retry_count               INTEGER NOT NULL DEFAULT 0,
                last_error                TEXT,
                created_at                TEXT NOT NULL,
                updated_at                TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_event_outbox_status_created
                ON event_outbox (status, created_at);
        `);
        setConfigValue(dbInstance, 'schema_version', '12');
    }
    if (version < 13) {
        // Migración a campos unificados starts_at + is_all_day (API ISO 8601).
        // Se parte de cero: la API es fuente de verdad y repopulará los datos.
        dbInstance.exec(`
            DROP TABLE IF EXISTS event_notifications;
            DROP TABLE IF EXISTS event_outbox;
            DROP INDEX IF EXISTS idx_events_agenda_date;
            DROP TABLE IF EXISTS events;

            CREATE TABLE events (
                id            INTEGER PRIMARY KEY,
                agenda_id     INTEGER,
                case_id       INTEGER,
                suit_case_id  INTEGER,
                event_type_id INTEGER DEFAULT 1,
                title         TEXT,
                description   TEXT,
                starts_at     TEXT,
                is_all_day    INTEGER DEFAULT 0,
                data_json     TEXT,
                synced_at     TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_events_agenda_starts_at
                ON events (agenda_id, starts_at);

            CREATE TABLE event_notifications (
                event_id        INTEGER,
                user_id         INTEGER,
                notify_at       TEXT,
                last_updated_at TEXT,
                status          TEXT NOT NULL DEFAULT 'scheduled',
                handled_at      TEXT,
                data_json       TEXT,
                synced_at       TEXT,
                PRIMARY KEY (event_id, user_id)
            );

            CREATE TABLE event_outbox (
                local_event_id            INTEGER PRIMARY KEY,
                remote_event_id           INTEGER,
                event_payload_json        TEXT NOT NULL,
                notification_payload_json TEXT,
                status                    TEXT NOT NULL,
                retry_count               INTEGER NOT NULL DEFAULT 0,
                last_error                TEXT,
                created_at                TEXT NOT NULL,
                updated_at                TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS idx_event_outbox_status_created
                ON event_outbox (status, created_at);
        `);
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource LIKE 'events%'", 13, 'clear-events-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '13');
    }
    if (version < 14) {
        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS deadlines (
                id            INTEGER PRIMARY KEY,
                title         TEXT,
                type          TEXT,
                suit_case_id  INTEGER,
                client_id     INTEGER,
                due_date      TEXT,
                priority      TEXT DEFAULT 'media',
                status        TEXT DEFAULT 'pending',
                assigned_to   INTEGER,
                data_json     TEXT,
                synced_at     TEXT
            );

            CREATE INDEX IF NOT EXISTS idx_deadlines_due_date
                ON deadlines (due_date);
            CREATE INDEX IF NOT EXISTS idx_deadlines_status
                ON deadlines (status, due_date);

            CREATE TABLE IF NOT EXISTS deadline_types (
                id          INTEGER PRIMARY KEY,
                name        TEXT,
                description TEXT,
                color       TEXT,
                data_json   TEXT,
                synced_at   TEXT
            );
        `);
        setConfigValue(dbInstance, 'schema_version', '14');
    }
    if (version < 15) {
        // Alinea la tabla deadlines con la API real de /vencimientos.
        // Elimina campos inexistentes (type, client_id, assigned_to) y agrega los reales
        // (event_id, description, notify_at). Corrige defaults de priority y status.
        // Elimina deadline_types (no hay endpoints en la API para eso).
        // Como deadlines es cache de la API, se parte de cero y se re-sincroniza.
        dbInstance.exec(`
            DROP TABLE IF EXISTS deadlines;
            CREATE TABLE deadlines (
                id            INTEGER PRIMARY KEY,
                event_id      INTEGER,
                suit_case_id  INTEGER,
                title         TEXT,
                description   TEXT,
                due_date      TEXT,
                priority      TEXT DEFAULT 'Normal',
                status        TEXT DEFAULT 'Pendiente',
                notify_at     TEXT,
                data_json     TEXT,
                synced_at     TEXT
            );
            CREATE INDEX IF NOT EXISTS idx_deadlines_due_date
                ON deadlines (due_date);
            CREATE INDEX IF NOT EXISTS idx_deadlines_status
                ON deadlines (status, due_date);
            DROP TABLE IF EXISTS deadline_types;
        `);
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource LIKE 'deadlines%'", 15, 'clear-deadlines-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '15');
    }
    if (version < 16) {
        // Agrega columnas obligatorias nuevas a cases (breaking change de la API).
        // Crea 10 tablas nuevas: catálogos (radicaciones, tipo_expedientes, roles,
        // tipo_pagos, gastos_catalogo), módulo transaccional (partes, parte_caso,
        // honorarios, entregas, gasto_suit_cases).
        runTolerantMigrationSql(dbInstance, 'ALTER TABLE cases ADD COLUMN nro_expediente TEXT', 16, 'add-cases-nro-expediente');
        runTolerantMigrationSql(dbInstance, 'ALTER TABLE cases ADD COLUMN radicacion_id INTEGER', 16, 'add-cases-radicacion-id');

        dbInstance.exec(`
            CREATE TABLE IF NOT EXISTS radicaciones (
                id        INTEGER PRIMARY KEY,
                name      TEXT,
                data_json TEXT,
                synced_at TEXT
            );
            CREATE TABLE IF NOT EXISTS tipo_expedientes (
                id           INTEGER PRIMARY KEY,
                case_type_id INTEGER,
                title        TEXT,
                details      TEXT,
                data_json    TEXT,
                synced_at    TEXT
            );
            CREATE TABLE IF NOT EXISTS roles (
                id        INTEGER PRIMARY KEY,
                titulo    TEXT,
                data_json TEXT,
                synced_at TEXT
            );
            CREATE TABLE IF NOT EXISTS tipo_pagos (
                id        INTEGER PRIMARY KEY,
                name      TEXT,
                data_json TEXT,
                synced_at TEXT
            );
            CREATE TABLE IF NOT EXISTS gastos_catalogo (
                id        INTEGER PRIMARY KEY,
                titulo    TEXT,
                detalles  TEXT,
                data_json TEXT,
                synced_at TEXT
            );
            CREATE TABLE IF NOT EXISTS partes (
                id        INTEGER PRIMARY KEY,
                nombre    TEXT,
                apellido  TEXT,
                email     TEXT,
                telefono  TEXT,
                rol_id    INTEGER,
                data_json TEXT,
                synced_at TEXT
            );
            CREATE TABLE IF NOT EXISTS parte_caso (
                parte_id     INTEGER,
                suit_case_id INTEGER,
                PRIMARY KEY (parte_id, suit_case_id)
            );
            CREATE TABLE IF NOT EXISTS honorarios (
                id             INTEGER PRIMARY KEY,
                suit_case_id   INTEGER,
                client_id      INTEGER,
                monto          REAL,
                detalles       TEXT,
                pagado         INTEGER DEFAULT 0,
                total_entregas REAL DEFAULT 0,
                data_json      TEXT,
                synced_at      TEXT
            );
            CREATE TABLE IF NOT EXISTS entregas (
                id           INTEGER PRIMARY KEY,
                honorario_id INTEGER,
                tipo_pago_id INTEGER,
                monto        REAL,
                nota         TEXT,
                data_json    TEXT,
                synced_at    TEXT
            );
            CREATE TABLE IF NOT EXISTS gasto_suit_cases (
                id           INTEGER PRIMARY KEY,
                gasto_id     INTEGER,
                suit_case_id INTEGER,
                monto        REAL,
                client_ids   TEXT,
                data_json    TEXT,
                synced_at    TEXT
            );
        `);
        setConfigValue(dbInstance, 'schema_version', '16');
    }
    if (version < 17) {
        // Migración v17: tablas case_sync_meta, multimedia, files
        // case_sync_meta: almacena timestamps per-entity por caso para sync incremental
        // multimedia/files: metadatos de archivos subidos a la API (contenido binario se descarga on-demand)
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS case_sync_meta (
                suit_case_id INTEGER NOT NULL,
                entity       TEXT NOT NULL,
                last_sync    TEXT,
                last_server  TEXT,
                PRIMARY KEY (suit_case_id, entity)
            )
        `, 17, 'create-case-sync-meta');
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS multimedia (
                id           INTEGER PRIMARY KEY,
                suit_case_id INTEGER,
                filename     TEXT,
                mime_type    TEXT,
                size         INTEGER,
                deleted_at   TEXT,
                updated_at   TEXT,
                data_json    TEXT,
                synced_at    TEXT
            )
        `, 17, 'create-multimedia');
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS files (
                id           INTEGER PRIMARY KEY,
                suit_case_id INTEGER,
                filename     TEXT,
                mime_type    TEXT,
                size         INTEGER,
                deleted_at   TEXT,
                updated_at   TEXT,
                data_json    TEXT,
                synced_at    TEXT
            )
        `, 17, 'create-files');
        setConfigValue(dbInstance, 'schema_version', '17');
    }
    if (version < 18) {
        // Migración v18: tabla case_client para la relación caso↔cliente.
        // Elimina la necesidad de llamar a GET /cases/{id}/clients desde el dashboard
        // por cada caso activo. Se puebla desde caseSyncDownService cuando syncDown trae clientes.
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS case_client (
                suit_case_id INTEGER NOT NULL,
                client_id    INTEGER NOT NULL,
                PRIMARY KEY (suit_case_id, client_id)
            )
        `, 18, 'create-case-client');
        setConfigValue(dbInstance, 'schema_version', '18');
    }
    if (version < 19) {
        // Migración v19: Biblioteca de archivos públicos.
        // Tres tablas nuevas: public_file_catalogs (agrupaciones), public_files (metadatos de archivos),
        // public_file_permissions (permisos granulares por usuario sobre cada archivo).
        // El contenido binario de los archivos NO se cachea — se descarga on-demand vía IPC.
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS public_file_catalogs (
                id          INTEGER PRIMARY KEY,
                name        TEXT,
                description TEXT,
                created_at  TEXT,
                updated_at  TEXT,
                synced_at   TEXT
            )
        `, 19, 'create-public-file-catalogs');
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS public_files (
                id                     INTEGER PRIMARY KEY,
                uuid                   TEXT,
                user_id                INTEGER,
                public_file_catalog_id INTEGER,
                name                   TEXT,
                path                   TEXT,
                mime_type              TEXT,
                size                   INTEGER,
                hash                   TEXT,
                created_at             TEXT,
                updated_at             TEXT,
                deleted_at             TEXT,
                synced_at              TEXT
            )
        `, 19, 'create-public-files');
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS public_file_permissions (
                public_file_id INTEGER NOT NULL,
                user_id        INTEGER NOT NULL,
                can_update     INTEGER DEFAULT 0,
                can_delete     INTEGER DEFAULT 0,
                created_at     TEXT,
                updated_at     TEXT,
                PRIMARY KEY (public_file_id, user_id)
            )
        `, 19, 'create-public-file-permissions');
        setConfigValue(dbInstance, 'schema_version', '19');
    }

    if (version < 20) {
        // Agrega campo is_owner_or_admin calculado por el backend por sesión
        runTolerantMigrationSql(dbInstance,
            'ALTER TABLE public_files ADD COLUMN is_owner_or_admin INTEGER DEFAULT 0',
            20, 'public-files-add-is-owner-or-admin'
        );
        setConfigValue(dbInstance, 'schema_version', '20');
    }

    if (version < 21) {
        // Elimina is_owner_or_admin del cache: es un campo inferible (user.role === 'admin' || file.user_id === user.id)
        // que no tiene sentido persistir en SQLite ya que cambia por sesión/usuario.
        runTolerantMigrationSql(dbInstance,
            'ALTER TABLE public_files DROP COLUMN is_owner_or_admin',
            21, 'public-files-drop-is-owner-or-admin'
        );
        setConfigValue(dbInstance, 'schema_version', '21');
    }

    if (version < 22) {
        // Migración v22: tablas de catálogos judiciales nuevos (jurisdicciones, dependencias_judiciales).
        // Además limpia el caché de radicaciones porque el campo cambió de `nombre_lugar` a `tipo`,
        // forzando un re-sync completo desde la API con el mapeo correcto.
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS jurisdicciones (
                id        INTEGER PRIMARY KEY,
                nombre    TEXT,
                data_json TEXT,
                synced_at TEXT
            )
        `, 22, 'create-jurisdicciones');
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS dependencias_judiciales (
                id              INTEGER PRIMARY KEY,
                jurisdiccion_id INTEGER,
                competencia_id  INTEGER,
                nombre_juzgado  TEXT,
                data_json       TEXT,
                synced_at       TEXT
            )
        `, 22, 'create-dependencias-judiciales');
        runTolerantMigrationSql(dbInstance, 'DELETE FROM radicaciones', 22, 'clear-radicaciones-cache');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'radicaciones'", 22, 'clear-radicaciones-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '22');

                // Migración v22: agrega campo status a la tabla documents.
        // Valor por defecto 'Borrador' según la implementación de la API.
        runTolerantMigrationSql(dbInstance,
            "ALTER TABLE documents ADD COLUMN status TEXT DEFAULT 'Borrador'",
            22, 'documents-add-status'
        );
        setConfigValue(dbInstance, 'schema_version', '22');
    }

    if (version < 23) {
        // Migración v23: agrega dependencia_id a la tabla cases.
        // La API ahora devuelve este campo en los endpoints de casos (sincronización offline).
        // Se limpia el caché de casos para que el próximo sync traiga los datos con el nuevo campo.
        runTolerantMigrationSql(dbInstance,
            'ALTER TABLE cases ADD COLUMN dependencia_id INTEGER',
            23, 'add-cases-dependencia-id'
        );
        runTolerantMigrationSql(dbInstance, 'DELETE FROM cases', 23, 'clear-cases-cache');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'cases'", 23, 'clear-cases-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '23');
    }

    if (version < 24) {
        // Migración v24: tabla competencias (fueros judiciales).
        // Cacheada localmente para evitar llamadas a la API al filtrar dependencias por jurisdicción.
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS competencias (
                id        INTEGER PRIMARY KEY,
                fuero     TEXT,
                data_json TEXT,
                synced_at TEXT
            )
        `, 24, 'create-competencias');
        setConfigValue(dbInstance, 'schema_version', '24');
    }

    if (version < 25) {
        // Migración v25: agrega radicacion_id a dependencias_judiciales.
        // Se limpia el caché para forzar un re-sync con la nueva estructura de la API.
        runTolerantMigrationSql(dbInstance,
            'ALTER TABLE dependencias_judiciales ADD COLUMN radicacion_id INTEGER',
            25, 'add-dependencias-radicacion-id'
        );
        runTolerantMigrationSql(dbInstance, 'DELETE FROM dependencias_judiciales', 25, 'clear-dependencias-cache');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'dependencias_judiciales'", 25, 'clear-dependencias-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '25');
    }

    if (version < 26) {
        // Asegurar que la tabla documents tenga todas las columnas necesarias.
        // La v22 falló para algunos usuarios porque se coló en un bloque que ya habían pasado.
        const existingColumns = new Set(
            dbInstance.prepare('PRAGMA table_info(documents)').all().map(c => c.name)
        );

        const columnsToEnsure = [
            { name: 'status', type: "TEXT DEFAULT 'Borrador'" },
            { name: 'data_json', type: 'TEXT' },
            { name: 'user_id', type: 'INTEGER' },
            { name: 'created_at', type: 'TEXT' },
            { name: 'updated_at', type: 'TEXT' },
            { name: 'locker_name', type: 'TEXT' },
            { name: 'latest_version_number', type: 'INTEGER' },
            { name: 'latest_version_created_by', type: 'INTEGER' },
            { name: 'latest_version_creator_name', type: 'TEXT' },
            { name: 'latest_version_creator_tag', type: 'TEXT' },
        ];

        for (const col of columnsToEnsure) {
            if (!existingColumns.has(col.name)) {
                logger.info(`Adding missing column "${col.name}" to documents table (v26)`);
                runTolerantMigrationSql(dbInstance,
                    `ALTER TABLE documents ADD COLUMN ${col.name} ${col.type}`,
                    26, `documents-add-${col.name}-v26`
                );
            } else {
                logger.info(`Column "${col.name}" already exists in documents table, skipping (v26)`);
            }
        }

        // Limpiamos cache de documentos para sincronizar de nuevo con la estructura completa
        runTolerantMigrationSql(dbInstance, 'DELETE FROM documents', 26, 'clear-documents-cache-v26');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'documents'", 26, 'clear-documents-sync-meta-v26');

        setConfigValue(dbInstance, 'schema_version', '26');
    }

    if (version < 27) {
        // Migración v27: sistema de Requisitos para Plantillas.
        // requisitos: catálogo de campos mandatorios tipados (client, user, case, etc.).
        // plantilla_requisitos: relación M:N entre plantillas y sus requisitos, con
        //   id_campo como identificador único del campo en el frontend.
        // Los requisitos se cachean una vez al inicio (seed-once) y se leen desde SQLite.
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS requisitos (
                id         INTEGER PRIMARY KEY,
                type       TEXT,
                title      TEXT,
                deleted_at TEXT,
                updated_at TEXT,
                synced_at  TEXT
            )
        `, 27, 'create-requisitos');
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS plantilla_requisitos (
                id           INTEGER PRIMARY KEY,
                template_id  INTEGER,
                requisito_id INTEGER,
                id_campo     TEXT,
                deleted_at   TEXT,
                synced_at    TEXT
            )
        `, 27, 'create-plantilla-requisitos');
        runTolerantMigrationSql(dbInstance, `
            CREATE INDEX IF NOT EXISTS idx_plantilla_requisitos_template
                ON plantilla_requisitos (template_id)
        `, 27, 'idx-plantilla-requisitos-template');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource = 'requisitos'", 27, 'clear-requisitos-sync-meta');
        runTolerantMigrationSql(dbInstance, "DELETE FROM sync_meta WHERE resource LIKE 'template_requirements:%'", 27, 'clear-template-requirements-sync-meta');
        setConfigValue(dbInstance, 'schema_version', '27');
    }

    if (version < 28) {
        // Migración v28: id_campo en plantilla_requisitos cambia de TEXT a INTEGER.
        // Los placeholders en el cuerpo HTML de plantillas son numéricos (#1#, #2#, #n#).
        // SQLite no soporta ALTER COLUMN, por lo que se recrea la tabla completa.
        // Al ser caché pura de la API, no hay pérdida de datos: el próximo sync la repopula.
        runTolerantMigrationSql(dbInstance,
            'DROP TABLE IF EXISTS plantilla_requisitos',
            28, 'drop-plantilla-requisitos'
        );
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE plantilla_requisitos (
                id           INTEGER PRIMARY KEY,
                template_id  INTEGER,
                requisito_id INTEGER,
                id_campo     INTEGER,
                deleted_at   TEXT,
                synced_at    TEXT
            )
        `, 28, 'recreate-plantilla-requisitos-integer-id-campo');
        runTolerantMigrationSql(dbInstance, `
            CREATE INDEX IF NOT EXISTS idx_plantilla_requisitos_template
                ON plantilla_requisitos (template_id)
        `, 28, 'idx-plantilla-requisitos-template-v28');
        runTolerantMigrationSql(dbInstance,
            "DELETE FROM sync_meta WHERE resource LIKE 'template_requirements:%'",
            28, 'clear-template-requirements-sync-meta-v28'
        );
        setConfigValue(dbInstance, 'schema_version', '28');
    }

    if (version < 29) {
        // Migración v29: agrega género a la caché local de clientes para reflejar el contrato actual de la API.
        runTolerantMigrationSql(dbInstance, "ALTER TABLE clients ADD COLUMN gender TEXT DEFAULT 'X'", 29, 'add-clients-gender');
        setConfigValue(dbInstance, 'schema_version', '29');
    }

    if (version < 30) {
        // Migración v30: agrega NEntidad a plantilla_requisitos.
        // NEntidad distingue múltiples instancias del mismo tipo de entidad en una plantilla
        // (ej: cliente 1 vs cliente 2). Valor por defecto 1 para mantener compatibilidad.
        // Se limpia el caché de requisitos para refetch desde la API con el nuevo campo.
        runTolerantMigrationSql(dbInstance,
            'ALTER TABLE plantilla_requisitos ADD COLUMN NEntidad INTEGER DEFAULT 1',
            30, 'add-plantilla-requisitos-NEntidad'
        );
        runTolerantMigrationSql(dbInstance,
            "DELETE FROM sync_meta WHERE resource LIKE 'template_requirements:%'",
            30, 'clear-template-requirements-sync-meta-v30'
        );
        setConfigValue(dbInstance, 'schema_version', '30');
    }

    if (version < 31) {
        // Migración v31: agrega campo `note` (TEXT, nullable) a plantilla_requisitos.
        // Permite al diseñador de la plantilla adjuntar una nota por campo que orienta
        // al usuario al momento de usar la plantilla (ej: "Indicar tribunal de origen").
        // Se limpia el caché de requisitos para que el próximo uso fuerce un re-fetch
        // desde la API que ya incluye el campo note en la respuesta.
        runTolerantMigrationSql(dbInstance,
            'ALTER TABLE plantilla_requisitos ADD COLUMN note TEXT',
            31, 'add-plantilla-requisitos-note'
        );
        runTolerantMigrationSql(dbInstance,
            "DELETE FROM sync_meta WHERE resource LIKE 'template_requirements:%'",
            31, 'clear-template-requirements-sync-meta-v31'
        );
        setConfigValue(dbInstance, 'schema_version', '31');
    }

    if (version < 32) {
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS document_versions (
                id             INTEGER PRIMARY KEY,
                document_id    INTEGER NOT NULL,
                version_number INTEGER,
                mime_type      TEXT,
                size           INTEGER,
                created_by     INTEGER,
                creator_name   TEXT,
                creator_tag    TEXT,
                created_at     TEXT,
                updated_at     TEXT,
                content        TEXT,
                data_json      TEXT,
                synced_at      TEXT
            )
        `, 32, 'create-document-versions');
        runTolerantMigrationSql(dbInstance, `
            CREATE INDEX IF NOT EXISTS idx_document_versions_document
                ON document_versions (document_id)
        `, 32, 'idx-document-versions-document');
        setConfigValue(dbInstance, 'schema_version', '32');
    }

    if (version < 33) {
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS document_query_cache (
                id                TEXT PRIMARY KEY,
                cache_key         TEXT NOT NULL,
                mode              TEXT NOT NULL,
                page              INTEGER NOT NULL DEFAULT 1,
                params_json       TEXT,
                document_ids_json TEXT NOT NULL,
                total_pages       INTEGER,
                total_documents   INTEGER,
                per_page          INTEGER,
                cached_at         TEXT NOT NULL,
                synced_at         TEXT
            )
        `, 33, 'create-document-query-cache');
        runTolerantMigrationSql(dbInstance, `
            CREATE INDEX IF NOT EXISTS idx_document_query_cache_lookup
                ON document_query_cache (cache_key, page)
        `, 33, 'idx-document-query-cache-lookup');
        setConfigValue(dbInstance, 'schema_version', '33');
    }

    if (version < 34) {
        runTolerantMigrationSql(dbInstance, `
            CREATE TABLE IF NOT EXISTS case_tipo_expediente (
                suit_case_id       INTEGER NOT NULL,
                tipo_expediente_id INTEGER NOT NULL,
                PRIMARY KEY (suit_case_id, tipo_expediente_id)
            )
        `, 34, 'create-case-tipo-expediente');
        setConfigValue(dbInstance, 'schema_version', '34');
    }
}

module.exports = {
    runMigrations,
};
