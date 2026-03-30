const {
    getAll,
    getById,
    upsertMany,
    deleteById,
    deleteWhere,
    getSyncMeta,
    setSyncMeta,
} = require('./database.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('partes:repository');

function extractPartePayload(payload) {
    if (!payload || typeof payload !== 'object') return null;
    if (payload.id != null) return payload;
    if (payload.data && typeof payload.data === 'object' && !Array.isArray(payload.data)) return payload.data;
    if (payload.parte && typeof payload.parte === 'object') return payload.parte;
    return null;
}

function hydrateParteRow(row) {
    if (!row || typeof row !== 'object') return null;
    if (!row.data_json) return row;

    try {
        const full = JSON.parse(row.data_json);
        return { ...row, ...full };
    } catch (error) {
        logger.warn('failed to parse parte row data_json', {
            parteId: row.id,
            error: error?.message || String(error),
        });
        return row;
    }
}

/**
 * Convierte la parte remota a una fila apta para SQLite.
 * Si llega una respuesta parcial, reutiliza el snapshot previo para no perder datos.
 */
function buildParteCacheRow(parte, existingParte = null) {
    const normalized = extractPartePayload(parte);
    const fallback = hydrateParteRow(extractPartePayload(existingParte) || existingParte || null);
    const parteId = Number(normalized?.id ?? fallback?.id);

    if (!Number.isInteger(parteId) || parteId < 1) {
        logger.error('cannot build parte cache row without valid id', {
            providedParte: parte,
            existingParte,
        });
        throw new Error('No se pudo construir la fila de caché de parte sin un id válido.');
    }

    const merged = {
        ...(fallback || {}),
        ...(normalized || {}),
        id: parteId,
    };

    return {
        id: parteId,
        nombre: merged.nombre ?? null,
        apellido: merged.apellido ?? null,
        identificacion: merged.identificacion ?? null,
        email: merged.email ?? null,
        telefono: merged.telefono ?? null,
        direccion: merged.direccion ?? null,
        genero: merged.genero ?? null,
        estado: merged.estado ?? null,
        notas: merged.notas ?? null,
        rol_id: merged.rol_id ?? null,
        created_at: merged.created_at ?? null,
        updated_at: merged.updated_at ?? null,
        data_json: JSON.stringify(merged),
        synced_at: new Date().toISOString(),
    };
}

function buildParteCasoRow(parteId, caseId) {
    const normalizedParteId = Number(parteId);
    const normalizedCaseId = Number(caseId);

    if (!Number.isInteger(normalizedParteId) || normalizedParteId < 1) {
        throw new Error('No se pudo construir el pivot parte_caso sin un parte_id válido.');
    }
    if (!Number.isInteger(normalizedCaseId) || normalizedCaseId < 1) {
        throw new Error('No se pudo construir el pivot parte_caso sin un suit_case_id válido.');
    }

    return {
        parte_id: normalizedParteId,
        suit_case_id: normalizedCaseId,
    };
}

function listCachedPartes() {
    return getAll('partes').map(hydrateParteRow);
}

function getCachedParteById(id) {
    return hydrateParteRow(getById('partes', id));
}

function upsertCachedPartes(partes) {
    if (!Array.isArray(partes) || partes.length === 0) return;

    const rows = partes.map((parte) => {
        const existing = getCachedParteById(parte?.id);
        return buildParteCacheRow(parte, existing);
    });

    upsertMany('partes', rows);
}

function deleteCachedParteById(id) {
    deleteById('partes', id);
    deleteWhere('parte_caso', { parte_id: id });
}

function deleteCachedPartesByIds(ids = []) {
    for (const id of ids) {
        deleteCachedParteById(id);
    }
}

function reconcileFullParteSet(partes) {
    const currentRows = getAll('partes');
    const serverIds = new Set();
    const rows = partes.map((parte) => {
        const row = buildParteCacheRow(parte, getById('partes', parte.id));
        serverIds.add(Number(row.id));
        return row;
    });

    if (rows.length > 0) {
        upsertMany('partes', rows);
    }

    const deletedIds = currentRows
        .map((row) => Number(row.id))
        .filter((parteId) => !serverIds.has(parteId));

    if (deletedIds.length > 0) {
        deleteCachedPartesByIds(deletedIds);
    }
}

/**
 * Reemplaza atómicamente las vinculaciones de partes para un caso.
 */
function replaceCasePartes(caseId, partes) {
    const normalizedCaseId = Number(caseId);
    if (!Number.isInteger(normalizedCaseId) || normalizedCaseId < 1) {
        throw new Error('El id de caso es inválido para actualizar el pivot parte_caso.');
    }

    const normalizedPartes = Array.isArray(partes) ? partes : [];
    if (normalizedPartes.length > 0) {
        upsertCachedPartes(normalizedPartes);
    }

    deleteWhere('parte_caso', { suit_case_id: normalizedCaseId });

    const pivotRows = normalizedPartes.map((parte) => buildParteCasoRow(parte.id, normalizedCaseId));
    if (pivotRows.length > 0) {
        upsertMany('parte_caso', pivotRows);
    }
}

function linkParteToCaseCache(caseId, parteId) {
    upsertMany('parte_caso', [buildParteCasoRow(parteId, caseId)]);
}

function unlinkParteFromCaseCache(caseId, parteId) {
    deleteWhere('parte_caso', {
        parte_id: Number(parteId),
        suit_case_id: Number(caseId),
    });
}

function getPartesSyncMeta() {
    return getSyncMeta('partes');
}

function setPartesSyncMeta(lastSync, lastServer) {
    setSyncMeta('partes', lastSync, lastServer);
}

module.exports = {
    extractPartePayload,
    buildParteCacheRow,
    hydrateParteRow,
    listCachedPartes,
    getCachedParteById,
    upsertCachedPartes,
    deleteCachedParteById,
    deleteCachedPartesByIds,
    reconcileFullParteSet,
    replaceCasePartes,
    linkParteToCaseCache,
    unlinkParteFromCaseCache,
    getPartesSyncMeta,
    setPartesSyncMeta,
};
