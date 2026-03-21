import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getGastosByCaso,
    createGastoCaso,
    updateGastoCaso,
    deleteGastoCaso,
} from '../services/gastoSuitCaseService.js';
import { parseJsonRows } from '../utils/dbUtils.js';
import { createLogger } from '../services/logService.js';
import { buildGastoCacheRow } from '../services/cache/gastoCacheRow.js';

const logger = createLogger('hook:use-gastos-caso');

function normalizeCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

/**
 * Lee gastos de un caso desde SQLite.
 */
async function readFromCache(caseId) {
    if (!window.electronAPI) return [];
    const allRows = await window.electronAPI.db.getAll('gasto_suit_cases');
    const filtered = allRows.filter((r) => String(r.suit_case_id) === String(caseId));
    return parseJsonRows(filtered);
}

/**
 * Hook para gestionar los gastos operativos de un caso.
 *
 * Estrategia de caché: idéntica a useHonorarios.
 * Los gastos se cargan on-demand por caso y se cachean en SQLite para acceso offline.
 *
 * @param {number|string} caseId — ID del caso del que cargar gastos.
 */
export function useGastosCaso(caseId, {
    enabled = true,
    skipInitialFetch = false,
} = {}) {
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const requestGenerationRef = useRef(0);

    /**
     * Carga principal: caché → API → actualiza caché.
     * Todos los setStates viven aquí (no directamente en useEffect).
     */
    /**
     * @param {number} generation - Marca de generación para evitar race conditions.
     * @param {boolean} forceSync - Si true, ignora skipInitialFetch y va a la API.
     *   Usado por reload() para garantizar que la lista se actualice tras un CRUD.
     */
    const loadData = useCallback(async (generation, forceSync = false) => {
        if (!caseId) {
            setGastos([]);
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
            const cached = await readFromCache(caseId);
            if (requestGenerationRef.current !== generation) return;
            setGastos(cached);
            setLoading(false);

            // Si syncDown ya rellenó el caso, evitamos un segundo fetch inicial del mismo recurso.
            // Pero si forceSync=true (ej: tras crear/editar), siempre vamos a la API.
            if (skipInitialFetch && !forceSync) {
                return;
            }

            const apiData = normalizeCollection(await getGastosByCaso(caseId));
            if (requestGenerationRef.current !== generation) return;

            if (window.electronAPI) {
                const rows = apiData.map(buildGastoCacheRow);
                await window.electronAPI.db.upsertMany('gasto_suit_cases', rows);
            }

            if (requestGenerationRef.current !== generation) return;
            const fresh = await readFromCache(caseId);
            if (requestGenerationRef.current !== generation) return;
            setGastos(fresh);
        } catch (err) {
            if (requestGenerationRef.current !== generation) return;
            void logger.warn('loadData failed', { caseId, error: err?.message });
            const cached = await readFromCache(caseId).catch(() => []);
            if (requestGenerationRef.current !== generation) return;
            if (cached.length === 0) {
                setError('No se pudieron cargar los gastos.');
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

    /** Registra un gasto en el caso y resincroniza. */
    const addGasto = useCallback(async (data) => {
        const result = await createGastoCaso(caseId, data);
        await reload();
        return result;
    }, [caseId, reload]);

    /** Actualiza monto o asociación de clientes de un gasto. */
    const editGasto = useCallback(async (id, data) => {
        const result = await updateGastoCaso(id, data);
        await reload();
        return result;
    }, [reload]);

    /** Elimina un gasto de la API y de la caché local. */
    const removeGasto = useCallback(async (id) => {
        const result = await deleteGastoCaso(id);
        if (window.electronAPI) {
            await window.electronAPI.db.deleteById('gasto_suit_cases', id);
        }
        const generation = ++requestGenerationRef.current;
        const fresh = await readFromCache(caseId);
        if (requestGenerationRef.current === generation) setGastos(fresh);
        return result;
    }, [caseId]);

    return {
        gastos,
        loading,
        error,
        reload,
        addGasto,
        editGasto,
        removeGasto,
    };
}
