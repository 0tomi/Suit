import { createLogger } from './logService.js';

const logger = createLogger('admin-bitacora-service');

export const BITACORA_ENTITY_TYPE_OPTIONS = [
    { value: 'all', label: 'Todas las entidades' },
    { value: 'case', label: 'Casos' },
    { value: 'client', label: 'Clientes' },
    { value: 'document', label: 'Documentos' },
    { value: 'agenda', label: 'Agendas' },
    { value: 'event', label: 'Eventos' },
    { value: 'user', label: 'Usuarios' },
    { value: 'multimedia', label: 'Multimedia' },
    { value: 'file', label: 'Archivos de caso' },
    { value: 'role', label: 'Roles' },
    { value: 'jurisdiction', label: 'Jurisdicciones' },
    { value: 'competency', label: 'Competencias' },
    { value: 'judicial_dependency', label: 'Dependencias judiciales' },
    { value: 'tax', label: 'Gastos / tasas' },
    { value: 'fee', label: 'Honorarios' },
    { value: 'delivery', label: 'Entregas' },
    { value: 'radicacion', label: 'Radicaciones' },
    { value: 'tombstone', label: 'Registros eliminados' },
];

export const BITACORA_ENTITY_TYPE_LABELS = Object.fromEntries(
    BITACORA_ENTITY_TYPE_OPTIONS
        .filter((option) => option.value !== 'all')
        .map((option) => [option.value, option.label]),
);

export const BITACORA_ACTION_LABELS = {
    created: 'Creación',
    updated: 'Actualización',
    deleted: 'Eliminación',
    viewed: 'Consulta',
    read: 'Consulta',
    downloaded: 'Descarga',
    restored: 'Restauración',
    archived: 'Archivo',
    unarchived: 'Desarchivo',
    shared: 'Compartido',
    unshared: 'Dejó de compartirse',
    assigned: 'Asignación',
    unassigned: 'Desasignación',
    opened: 'Apertura',
    closed: 'Cierre',
    reopened: 'Reapertura',
    locked: 'Bloqueo',
    unlocked: 'Desbloqueo',
    uploaded: 'Carga',
    photo_uploaded: 'Foto cargada',
    status_updated: 'Estado actualizado',
    name_updated: 'Nombre actualizado',
    participant_added: 'Participante agregado',
    participant_removed: 'Participante removido',
};

export const BITACORA_SORT_OPTIONS = [
    { value: 'newest', label: 'Más recientes primero' },
    { value: 'oldest', label: 'Más antiguos primero' },
];

const ACTION_TOKEN_LABELS = {
    created: 'creación',
    updated: 'actualización',
    deleted: 'eliminación',
    viewed: 'consulta',
    read: 'consulta',
    downloaded: 'descarga',
    restored: 'restauración',
    archived: 'archivo',
    unarchived: 'desarchivo',
    shared: 'compartido',
    unshared: 'dejó de compartirse',
    assigned: 'asignación',
    unassigned: 'desasignación',
    opened: 'apertura',
    closed: 'cierre',
    reopened: 'reapertura',
    locked: 'bloqueo',
    unlocked: 'desbloqueo',
    uploaded: 'carga',
    photo: 'foto',
    status: 'estado',
    name: 'nombre',
    participant: 'participante',
    added: 'agregado',
    removed: 'removido',
};

function capitalizeLabel(value) {
    if (!value) return '';
    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function resolveBitacoraActionLabel(action) {
    if (!action || typeof action !== 'string') {
        return 'Movimiento';
    }

    if (BITACORA_ACTION_LABELS[action]) {
        return BITACORA_ACTION_LABELS[action];
    }

    const normalized = action.trim().toLowerCase();
    if (!normalized) {
        return 'Movimiento';
    }

    const translated = normalized
        .split(/[_-]+/)
        .filter(Boolean)
        .map((token) => ACTION_TOKEN_LABELS[token] || token)
        .join(' ')
        .trim();

    return capitalizeLabel(translated || normalized);
}

function getBitacoraBackendOrThrow(action) {
    const bitacoraApi = window.electronAPI?.bitacora;
    if (!bitacoraApi) {
        const error = new Error('La bitácora no está disponible en este momento.');
        void logger.error(`bitacora backend unavailable during ${action}`);
        throw error;
    }
    return bitacoraApi;
}

function extractMessageFromBackendError(response, fallbackMessage) {
    return response?.data?.message || response?.error || fallbackMessage;
}

/**
 * La página espera un shape estable para no tener que adivinar la respuesta del servidor.
 */
function assertBitacoraPageShape(payload) {
    if (!payload || typeof payload !== 'object') {
        throw new Error('El servidor no devolvió datos de la bitácora.');
    }

    if (!Array.isArray(payload.items)) {
        throw new Error('No se pudo leer la lista de movimientos.');
    }

    if (!payload.pagination || typeof payload.pagination !== 'object') {
        throw new Error('No se pudo ordenar la lista de movimientos.');
    }

    return payload;
}

export async function getBitacoraPage({ entityType = 'all', sort = 'newest', page = 1 } = {}) {
    try {
        const bitacoraApi = getBitacoraBackendOrThrow('list');
        const payload = await bitacoraApi.list({ entityType, sort, page });
        return assertBitacoraPageShape(payload);
    } catch (error) {
        void logger.error('failed to load bitacora page', {
            entityType,
            sort,
            page,
            error: error?.message || String(error),
        });
        throw error;
    }
}

export async function clearBitacora() {
    try {
        const bitacoraApi = getBitacoraBackendOrThrow('clear');
        const response = await bitacoraApi.clear();
        if (!response?.ok) {
            throw new Error(extractMessageFromBackendError(response, 'No se pudo limpiar la bitácora.'));
        }
        return response.data ?? true;
    } catch (error) {
        void logger.error('failed to clear bitacora', {
            error: error?.message || String(error),
        });
        throw error;
    }
}

export async function cleanupBitacora(days) {
    try {
        const bitacoraApi = getBitacoraBackendOrThrow('cleanup');
        const response = await bitacoraApi.cleanup(days);
        if (!response?.ok) {
            throw new Error(extractMessageFromBackendError(response, 'No se pudo ejecutar el mantenimiento de la bitácora.'));
        }
        return response.data ?? true;
    } catch (error) {
        void logger.error('failed to cleanup bitacora', {
            days,
            error: error?.message || String(error),
        });
        throw error;
    }
}
