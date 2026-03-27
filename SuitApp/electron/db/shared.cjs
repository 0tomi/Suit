const { buildLocalDateFromStartsAt } = require('../dateTimeAdapter.cjs');
const { buildLocalDateTime } = require('../dateUtils.cjs');

const EVENT_NOTIFICATION_SCHEDULED = 'scheduled';
const EVENT_NOTIFICATION_PENDING_READ = 'pending_read';
const EVENT_NOTIFICATION_READ = 'read';
const GLOBAL_DB_FILENAME = 'suit_global.db';
const LEGACY_DB_BASENAME = 'suit_cache.db';
const GLOBAL_CONFIG_KEYS = new Set([
    'api_host',
    'api_port',
    'tray_hint_shown',
    'last_active_profile_id',
    'auth_token',
    'auth_user',
]);
const PROFILE_KIND_REMOTE = 'remote';

const TABLE_COLUMN_WHITELIST = Object.freeze({
    config: new Set([
        'key',
        'value',
    ]),
    users: new Set([
        'id',
        'name',
        'email',
        'role',
        'tag',
        'synced_at',
    ]),
    cases: new Set([
        'id',
        'title',
        'case_type',
        'case_type_id',
        'status',
        'owner_tag',
        'start_date',
        'end_date',
        'details',
        'nro_expediente',
        'radicacion_id',
        'dependencia_id',
        'updated_at',
        'data_json',
        'synced_at',
    ]),
    events: new Set([
        'id',
        'agenda_id',
        'case_id',
        'suit_case_id',
        'event_type_id',
        'title',
        'description',
        'starts_at',
        'is_all_day',
        'data_json',
        'synced_at',
    ]),
    agendas: new Set([
        'id',
        'name',
        'color',
        'suit_case_id',
        'user_id',
        'data_json',
        'synced_at',
    ]),
    documents: new Set([
        'id',
        'name',
        'suit_case_id',
        'content',
        'is_locked',
        'locked_by',
        'synced_at',
        'updated_at',
        'created_at',
        'user_id',
        'latest_version_number',
        'latest_version_created_by',
        'latest_version_creator_name',
        'latest_version_creator_tag',
        'locker_name',
        'status',
        'data_json',
    ]),
    document_versions: new Set([
        'id',
        'document_id',
        'version_number',
        'mime_type',
        'size',
        'created_by',
        'creator_name',
        'creator_tag',
        'created_at',
        'updated_at',
        'content',
        'data_json',
        'synced_at',
    ]),
    document_query_cache: new Set([
        'id',
        'cache_key',
        'mode',
        'page',
        'params_json',
        'document_ids_json',
        'total_pages',
        'total_documents',
        'per_page',
        'cached_at',
        'synced_at',
    ]),
    clients: new Set([
        'id',
        'first_name',
        'last_name',
        'identification_number',
        'email',
        'phone',
        'address',
        'type',
        'gender',
        'status',
        'notes',
        'data_json',
        'synced_at',
    ]),
    templates: new Set([
        'id',
        'title',
        'template_category_id',
        'data_json',
        'synced_at',
    ]),
    template_categories: new Set([
        'id',
        'name',
        'description',
        'data_json',
        'synced_at',
    ]),
    requisitos: new Set([
        'id',
        'type',
        'title',
        'deleted_at',
        'updated_at',
        'synced_at',
    ]),
    plantilla_requisitos: new Set([
        'id',
        'template_id',
        'requisito_id',
        'id_campo',
        'NEntidad',
        'note',
        'deleted_at',
        'synced_at',
    ]),
    sync_meta: new Set([
        'resource',
        'last_sync',
        'last_server',
    ]),
    event_types: new Set([
        'id',
        'name',
        'color',
        'data_json',
        'synced_at',
    ]),
    event_notifications: new Set([
        'event_id',
        'user_id',
        'notify_at',
        'last_updated_at',
        'status',
        'handled_at',
        'data_json',
        'synced_at',
    ]),
    event_outbox: new Set([
        'local_event_id',
        'remote_event_id',
        'event_payload_json',
        'notification_payload_json',
        'status',
        'retry_count',
        'last_error',
        'created_at',
        'updated_at',
    ]),
    notification_deliveries: new Set([
        'event_id',
        'user_id',
        'notify_at',
        'kind',
        'status',
        'payload_json',
        'shown_at',
        'clicked_at',
        'updated_at',
    ]),
    case_types: new Set([
        'id',
        'name',
        'description',
        'eventColor',
        'data_json',
        'synced_at',
    ]),
    deadlines: new Set([
        'id',
        'event_id',
        'suit_case_id',
        'title',
        'description',
        'due_date',
        'priority',
        'status',
        'notify_at',
        'data_json',
        'synced_at',
    ]),
    deadline_types: new Set([
        'id',
        'name',
        'description',
        'color',
        'data_json',
        'synced_at',
    ]),
    radicaciones: new Set([
        'id',
        'name',
        'data_json',
        'synced_at',
    ]),
    jurisdicciones: new Set([
        'id',
        'nombre',
        'data_json',
        'synced_at',
    ]),
    competencias: new Set([
        'id',
        'fuero',
        'data_json',
        'synced_at',
    ]),
    dependencias_judiciales: new Set([
        'id',
        'jurisdiccion_id',
        'competencia_id',
        'radicacion_id',
        'nombre_juzgado',
        'data_json',
        'synced_at',
    ]),
    tipo_expedientes: new Set([
        'id',
        'case_type_id',
        'title',
        'details',
        'data_json',
        'synced_at',
    ]),
    roles: new Set([
        'id',
        'titulo',
        'data_json',
        'synced_at',
    ]),
    tipo_pagos: new Set([
        'id',
        'name',
        'data_json',
        'synced_at',
    ]),
    gastos_catalogo: new Set([
        'id',
        'titulo',
        'detalles',
        'data_json',
        'synced_at',
    ]),
    partes: new Set([
        'id',
        'nombre',
        'apellido',
        'email',
        'telefono',
        'rol_id',
        'data_json',
        'synced_at',
    ]),
    parte_caso: new Set([
        'parte_id',
        'suit_case_id',
    ]),
    honorarios: new Set([
        'id',
        'suit_case_id',
        'client_id',
        'monto',
        'detalles',
        'pagado',
        'total_entregas',
        'data_json',
        'synced_at',
    ]),
    entregas: new Set([
        'id',
        'honorario_id',
        'tipo_pago_id',
        'monto',
        'nota',
        'data_json',
        'synced_at',
    ]),
    gasto_suit_cases: new Set([
        'id',
        'gasto_id',
        'suit_case_id',
        'monto',
        'client_ids',
        'data_json',
        'synced_at',
    ]),
    case_sync_meta: new Set([
        'suit_case_id',
        'entity',
        'last_sync',
        'last_server',
    ]),
    multimedia: new Set([
        'id',
        'suit_case_id',
        'filename',
        'mime_type',
        'size',
        'deleted_at',
        'updated_at',
        'data_json',
        'synced_at',
    ]),
    files: new Set([
        'id',
        'suit_case_id',
        'filename',
        'mime_type',
        'size',
        'deleted_at',
        'updated_at',
        'data_json',
        'synced_at',
    ]),
    case_client: new Set([
        'suit_case_id',
        'client_id',
    ]),
    case_tipo_expediente: new Set([
        'suit_case_id',
        'tipo_expediente_id',
    ]),
    public_file_catalogs: new Set([
        'id',
        'name',
        'description',
        'created_at',
        'updated_at',
        'synced_at',
    ]),
    public_files: new Set([
        'id',
        'uuid',
        'user_id',
        'public_file_catalog_id',
        'name',
        'path',
        'mime_type',
        'size',
        'hash',
        'created_at',
        'updated_at',
        'deleted_at',
        'synced_at',
    ]),
    public_file_permissions: new Set([
        'public_file_id',
        'user_id',
        'can_update',
        'can_delete',
        'created_at',
        'updated_at',
    ]),
});

const TABLE_NAME_PATTERN = /^[a-z_]+$/;
const COLUMN_NAME_PATTERN = /^[A-Za-z_][A-Za-z0-9_]*$/;

// Acepta tanto (startsAt) como la firma legacy (date, time) usada en migración v11.
function buildEventDateFromParts(startsAtOrDate, time) {
    if (time !== undefined) {
        // Llamada legacy desde migración v11: (date, time)
        return buildLocalDateTime(startsAtOrDate, time);
    }
    return buildLocalDateFromStartsAt(startsAtOrDate);
}

function parseJsonSafe(value) {
    if (!value) return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

function assertAllowedTable(table) {
    if (typeof table !== 'string' || !TABLE_NAME_PATTERN.test(table) || !TABLE_COLUMN_WHITELIST[table]) {
        throw new Error(`Invalid table "${String(table)}"`);
    }

    return table;
}

function assertAllowedColumns(table, columns) {
    const allowedColumns = TABLE_COLUMN_WHITELIST[table];
    for (const column of columns) {
        if (typeof column !== 'string' || !COLUMN_NAME_PATTERN.test(column) || !allowedColumns.has(column)) {
            throw new Error(`Invalid column "${String(column)}" for table "${table}"`);
        }
    }
}

module.exports = {
    EVENT_NOTIFICATION_SCHEDULED,
    EVENT_NOTIFICATION_PENDING_READ,
    EVENT_NOTIFICATION_READ,
    GLOBAL_DB_FILENAME,
    LEGACY_DB_BASENAME,
    GLOBAL_CONFIG_KEYS,
    PROFILE_KIND_REMOTE,
    TABLE_COLUMN_WHITELIST,
    buildEventDateFromParts,
    parseJsonSafe,
    assertAllowedTable,
    assertAllowedColumns,
};
