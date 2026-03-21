import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getHonorariosByCaso,
    createHonorario,
    updateHonorario,
    deleteHonorario,
} from '../services/honorarioService.js';
import { parseJsonRows } from '../utils/dbUtils.js';
import { createLogger } from '../services/logService.js';
import { buildHonorarioCacheRow } from '../services/cache/honorarioCacheRow.js';

const logger = createLogger('hook:use-honorarios');

function normalizeCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

/**
 * Lee los honorarios de un caso desde SQLite, filtrando por suit_case_id.
 */
async function readFromCache(caseId) {
    if (!window.electronAPI) return [];
    const allRows = await window.electronAPI.db.getAll('honorarios');
    const caseRows = allRows.filter((r) => String(r.suit_case_id) === String(caseId));
    return parseJsonRows(caseRows);
}

/**
 * Hook para gestionar los honorarios de un caso legal.
 *
 * Estrategia de caché:
 * 1. Al montar (o cuando cambia caseId), carga inmediatamente desde SQLite.
 * 2. Luego sincroniza desde la API y actualiza la caché y el estado.
 * 3. Las operaciones CRUD actualizan la API y resincronizan la caché.
 *
 * @param {number|string} caseId — ID del caso del que cargar honorarios.
 */
export function useHonorarios(caseId, {
    enabled = true,
    skipInitialFetch = false,
} = {}) {
    const [honorarios, setHonorarios] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const requestGenerationRef = useRef(0);

    /**
     * Función de carga principal: lee caché → sincroniza API → actualiza caché.
     * Todos los setStates viven aquí (no directamente en useEffect).
     */
    /**
     * @param {number} generation - Marca de generación para evitar race conditions.
     * @param {boolean} forceSync - Si true, ignora skipInitialFetch y va a la API.
     *   Usado por reload() para garantizar que la lista se actualice tras un CRUD.
     */
    const loadData = useCallback(async (generation, forceSync = false) => {
        if (!caseId) {
            setHonorarios([]);
            setLoading(false);
            return;
        }

        if (!enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            // Mostrar datos cacheados inmediatamente
            const cached = await readFromCache(caseId);
            if (requestGenerationRef.current !== generation) return;
            setHonorarios(cached);
            setLoading(false);

            // En el detalle del caso usamos syncDown como fuente única de hidratación inicial.
            // Pero si forceSync=true (ej: tras crear/editar), siempre vamos a la API.
            if (skipInitialFetch && !forceSync) {
                return;
            }

            // Sincronizar desde la API en background
            const apiData = normalizeCollection(await getHonorariosByCaso(caseId));
            if (requestGenerationRef.current !== generation) return;

            if (window.electronAPI) {
                const rows = apiData.map(buildHonorarioCacheRow);
                await window.electronAPI.db.upsertMany('honorarios', rows);
            }

            if (requestGenerationRef.current !== generation) return;
            const fresh = await readFromCache(caseId);
            if (requestGenerationRef.current !== generation) return;
            setHonorarios(fresh);
        } catch (err) {
            if (requestGenerationRef.current !== generation) return;
            void logger.warn('loadData failed (usando caché si existe)', { caseId, error: err?.message });
            const cached = await readFromCache(caseId).catch(() => []);
            if (requestGenerationRef.current !== generation) return;
            if (cached.length === 0) {
                setError('No se pudieron cargar los honorarios.');
            }
            setLoading(false);
        }
    }, [caseId, enabled, skipInitialFetch]);

    useEffect(() => {
        const generation = ++requestGenerationRef.current;
        void loadData(generation);

        return () => {
            requestGenerationRef.current += 1;
        };
    }, [loadData]);

    /** Fuerza una re-sincronización completa contra la API, ignorando skipInitialFetch. */
    const reload = useCallback(async () => {
        const generation = ++requestGenerationRef.current;
        await loadData(generation, true);
    }, [loadData]);

    /** Crea un honorario y resincroniza. */
    const addHonorario = useCallback(async (data) => {
        const result = await createHonorario(caseId, data);
        await reload();
        return result;
    }, [caseId, reload]);

    /** Actualiza un honorario y resincroniza. */
    const editHonorario = useCallback(async (id, data) => {
        const result = await updateHonorario(id, data);
        await reload();
        return result;
    }, [reload]);

    /** Elimina un honorario de la API y de la caché local. */
    const removeHonorario = useCallback(async (id) => {
        const result = await deleteHonorario(id);
        if (window.electronAPI) {
            await window.electronAPI.db.deleteById('honorarios', id);
        }
        const generation = ++requestGenerationRef.current;
        const fresh = await readFromCache(caseId);
        if (requestGenerationRef.current === generation) setHonorarios(fresh);
        return result;
    }, [caseId]);

    return {
        honorarios,
        loading,
        error,
        reload,
        addHonorario,
        editHonorario,
        removeHonorario,
    };
}
