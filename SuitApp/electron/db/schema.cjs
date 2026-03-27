const { getLogger } = require('../logService.cjs');

const logger = getLogger('db:schema');

function createGlobalTables(dbInstance) {
    dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS profiles (
            id                    INTEGER PRIMARY KEY AUTOINCREMENT,
            kind                  TEXT NOT NULL,
            remote_user_id        INTEGER,
            display_name          TEXT,
            tag                   TEXT,
            db_filename           TEXT NOT NULL UNIQUE,
            created_at            TEXT NOT NULL,
            last_used_at          TEXT,
            last_authenticated_at TEXT
        );

        CREATE UNIQUE INDEX IF NOT EXISTS idx_profiles_remote_user_id
            ON profiles (remote_user_id)
            WHERE remote_user_id IS NOT NULL;
    `);
}

function createTables(dbInstance) {
    dbInstance.exec(`
        CREATE TABLE IF NOT EXISTS config (
            key   TEXT PRIMARY KEY,
            value TEXT
        );

        CREATE TABLE IF NOT EXISTS users (
            id        INTEGER PRIMARY KEY,
            name      TEXT,
            email     TEXT,
            role      TEXT,
            tag       TEXT,
            synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS cases (
            id              INTEGER PRIMARY KEY,
            title           TEXT,
            case_type       TEXT,
            case_type_id    INTEGER,
            status          TEXT,
            owner_tag       TEXT,
            start_date      TEXT,
            end_date        TEXT,
            details         TEXT,
            nro_expediente  TEXT,
            radicacion_id   INTEGER,
            dependencia_id  INTEGER,
            updated_at      TEXT,
            data_json       TEXT,
            synced_at       TEXT
        );

        CREATE TABLE IF NOT EXISTS events (
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

        CREATE TABLE IF NOT EXISTS event_types (
            id        INTEGER PRIMARY KEY,
            name      TEXT,
            color     TEXT,
            data_json TEXT,
            synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS event_notifications (
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
        );

        CREATE TABLE IF NOT EXISTS agendas (
            id           INTEGER PRIMARY KEY,
            name         TEXT,
            color        TEXT,
            suit_case_id INTEGER,
            user_id      INTEGER,
            data_json    TEXT,
            synced_at    TEXT
        );

        CREATE TABLE IF NOT EXISTS documents (
            id                          INTEGER PRIMARY KEY,
            name                        TEXT,
            suit_case_id                INTEGER,
            user_id                     INTEGER,
            content                     TEXT,
            is_locked                   INTEGER DEFAULT 0,
            locked_by                   TEXT,
            locker_name                 TEXT,
            status                      TEXT DEFAULT 'Borrador',
            latest_version_number       INTEGER,
            latest_version_created_by  INTEGER,
            latest_version_creator_name TEXT,
            latest_version_creator_tag  TEXT,
            created_at                  TEXT,
            updated_at                  TEXT,
            data_json                   TEXT,
            synced_at                   TEXT
        );

        CREATE TABLE IF NOT EXISTS document_versions (
            id            INTEGER PRIMARY KEY,
            document_id   INTEGER NOT NULL,
            version_number INTEGER,
            mime_type     TEXT,
            size          INTEGER,
            created_by    INTEGER,
            creator_name  TEXT,
            creator_tag   TEXT,
            created_at    TEXT,
            updated_at    TEXT,
            content       TEXT,
            data_json     TEXT,
            synced_at     TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_document_versions_document
            ON document_versions (document_id);

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
        );

        CREATE INDEX IF NOT EXISTS idx_document_query_cache_lookup
            ON document_query_cache (cache_key, page);

        CREATE TABLE IF NOT EXISTS clients (
            id                    INTEGER PRIMARY KEY,
            first_name            TEXT,
            last_name             TEXT,
            identification_number TEXT,
            email                 TEXT,
            phone                 TEXT,
            address               TEXT,
            type                  TEXT DEFAULT 'person',
            gender                TEXT DEFAULT 'X',
            status                TEXT DEFAULT 'active',
            notes                 TEXT,
            data_json             TEXT,
            synced_at             TEXT
        );

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

        CREATE TABLE IF NOT EXISTS requisitos (
            id         INTEGER PRIMARY KEY,
            type       TEXT,
            title      TEXT,
            deleted_at TEXT,
            updated_at TEXT,
            synced_at  TEXT
        );

        CREATE TABLE IF NOT EXISTS plantilla_requisitos (
            id           INTEGER PRIMARY KEY,
            template_id  INTEGER,
            requisito_id INTEGER,
            id_campo     INTEGER,
            NEntidad     INTEGER DEFAULT 1,
            deleted_at   TEXT,
            synced_at    TEXT
        );

        CREATE INDEX IF NOT EXISTS idx_plantilla_requisitos_template
            ON plantilla_requisitos (template_id);

        CREATE TABLE IF NOT EXISTS sync_meta (
            resource    TEXT PRIMARY KEY,
            last_sync   TEXT,
            last_server TEXT
        );

        CREATE TABLE IF NOT EXISTS case_types (
            id          INTEGER PRIMARY KEY,
            name        TEXT,
            description TEXT,
            eventColor  TEXT,
            data_json   TEXT,
            synced_at   TEXT
        );

        CREATE TABLE IF NOT EXISTS deadlines (
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

        CREATE TABLE IF NOT EXISTS radicaciones (
            id        INTEGER PRIMARY KEY,
            name      TEXT,
            data_json TEXT,
            synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS jurisdicciones (
            id        INTEGER PRIMARY KEY,
            nombre    TEXT,
            data_json TEXT,
            synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS competencias (
            id        INTEGER PRIMARY KEY,
            fuero     TEXT,
            data_json TEXT,
            synced_at TEXT
        );

        CREATE TABLE IF NOT EXISTS dependencias_judiciales (
            id             INTEGER PRIMARY KEY,
            jurisdiccion_id INTEGER,
            competencia_id  INTEGER,
            radicacion_id   INTEGER,
            nombre_juzgado  TEXT,
            data_json       TEXT,
            synced_at       TEXT
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

        CREATE TABLE IF NOT EXISTS case_sync_meta (
            suit_case_id INTEGER NOT NULL,
            entity       TEXT NOT NULL,
            last_sync    TEXT,
            last_server  TEXT,
            PRIMARY KEY (suit_case_id, entity)
        );

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
        );

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
        );

        CREATE TABLE IF NOT EXISTS case_client (
            suit_case_id INTEGER NOT NULL,
            client_id    INTEGER NOT NULL,
            PRIMARY KEY (suit_case_id, client_id)
        );

        CREATE TABLE IF NOT EXISTS case_tipo_expediente (
            suit_case_id       INTEGER NOT NULL,
            tipo_expediente_id INTEGER NOT NULL,
            PRIMARY KEY (suit_case_id, tipo_expediente_id)
        );

        CREATE TABLE IF NOT EXISTS public_file_catalogs (
            id          INTEGER PRIMARY KEY,
            name        TEXT,
            description TEXT,
            created_at  TEXT,
            updated_at  TEXT,
            synced_at   TEXT
        );

        CREATE TABLE IF NOT EXISTS public_files (
            id                      INTEGER PRIMARY KEY,
            uuid                    TEXT,
            user_id                 INTEGER,
            public_file_catalog_id  INTEGER,
            name                    TEXT,
            path                    TEXT,
            mime_type               TEXT,
            size                    INTEGER,
            hash                    TEXT,
            created_at              TEXT,
            updated_at              TEXT,
            deleted_at              TEXT,
            synced_at               TEXT
        );

        CREATE TABLE IF NOT EXISTS public_file_permissions (
            public_file_id  INTEGER NOT NULL,
            user_id         INTEGER NOT NULL,
            can_update      INTEGER DEFAULT 0,
            can_delete      INTEGER DEFAULT 0,
            created_at      TEXT,
            updated_at      TEXT,
            PRIMARY KEY (public_file_id, user_id)
        );
    `);

    // Índices separados
    try {
        dbInstance.exec(`
            CREATE INDEX IF NOT EXISTS idx_events_agenda_starts_at
                ON events (agenda_id, starts_at);
            CREATE INDEX IF NOT EXISTS idx_deadlines_due_date
                ON deadlines (due_date);
            CREATE INDEX IF NOT EXISTS idx_deadlines_status
                ON deadlines (status, due_date);
        `);
    } catch (err) {
        logger.warn('Failed to create optional indexes during schema bootstrap', err);
    }
}

module.exports = {
    createGlobalTables,
    createTables,
};
