import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getEntregasByHonorario,
    createEntrega,
    updateEntrega,
    deleteEntrega,
} from '../services/entregaService.js';
import { parseJsonRows } from '../utils/dbUtils.js';
import { createLogger } from '../services/logService.js';
import { buildEntregaCacheRow } from '../services/cache/entregaCacheRow.js';

const logger = createLogger('hook:use-entregas');

function normalizeCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

/**
 * Lee entregas de un honorario desde SQLite.
 */
async function readFromCache(honorarioId) {
    if (!window.electronAPI) return [];
    const allRows = await window.electronAPI.db.getAll('entregas');
    const filtered = allRows.filter((r) => String(r.honorario_id) === String(honorarioId));
    return parseJsonRows(filtered);
}

/**
 * Hook para gestionar las entregas (pagos parciales) de un honorario.
 *
 * Estrategia de caché: carga desde SQLite primero, luego sincroniza desde la API.
 * Al crear/editar/borrar, la API recalcula automáticamente `pagado` en el honorario padre.
 *
 * @param {number|string} honorarioId — ID del honorario del que cargar entregas.
 */
export function useEntregas(honorarioId) {
    const [entregas, setEntregas] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const requestGenerationRef = useRef(0);

    /**
     * Carga principal: caché → API → actualiza caché.
     * Todos los setStates viven aquí (no directamente en useEffect).
     */
    const loadData = useCallback(async (generation) => {
        if (!honorarioId) {
            setEntregas([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const cached = await readFromCache(honorarioId);
            if (requestGenerationRef.current !== generation) return;
            setEntregas(cached);
            setLoading(false);

            const apiData = normalizeCollection(await getEntregasByHonorario(honorarioId));
            if (requestGenerationRef.current !== generation) return;

            if (apiData.length > 0 && window.electronAPI) {
                const rows = apiData.map(buildEntregaCacheRow);
                await window.electronAPI.db.upsertMany('entregas', rows);
            }

            if (requestGenerationRef.current !== generation) return;
            const fresh = await readFromCache(honorarioId);
            if (requestGenerationRef.current !== generation) return;
            setEntregas(fresh);
        } catch (err) {
            if (requestGenerationRef.current !== generation) return;
            void logger.warn('loadData failed', { honorarioId, error: err?.message });
            const cached = await readFromCache(honorarioId).catch(() => []);
            if (requestGenerationRef.current !== generation) return;
            if (cached.length === 0) {
                setError('No se pudieron cargar las entregas.');
            }
            setLoading(false);
        }
    }, [honorarioId]);

    useEffect(() => {
        const generation = ++requestGenerationRef.current;
        void loadData(generation);

        return () => {
            requestGenerationRef.current += 1;
        };
    }, [loadData]);

    const reload = useCallback(async () => {
        const generation = ++requestGenerationRef.current;
        await loadData(generation);
    }, [loadData]);

    /** Registra una entrega. La API recalcula `pagado` en el honorario padre automáticamente. */
    const addEntrega = useCallback(async (data) => {
        const result = await createEntrega(honorarioId, data);
        await reload();
        return result;
    }, [honorarioId, reload]);

    /** Actualiza monto o tipo de pago de una entrega. */
    const editEntrega = useCallback(async (id, data) => {
        const result = await updateEntrega(id, data);
        await reload();
        return result;
    }, [reload]);

    /** Elimina una entrega de la API y de la caché local. */
    const removeEntrega = useCallback(async (id) => {
        const result = await deleteEntrega(id);
        if (window.electronAPI) {
            await window.electronAPI.db.deleteById('entregas', id);
        }
        // Reutiliza el flujo de recarga con control de generaciones para evitar races
        // entre mutaciones locales y lecturas tardías.
        await reload();
        return result;
    }, [reload]);

    return {
        entregas,
        loading,
        error,
        reload,
        addEntrega,
        editEntrega,
        removeEntrega,
    };
}
