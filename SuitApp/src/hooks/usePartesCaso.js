import { useCallback, useEffect, useRef, useState } from 'react';
import {
    getPartesByCaso,
    linkParteToCaso,
    unlinkParteFromCaso,
} from '../services/parteService.js';
import { createLogger } from '../services/logService.js';
import { buildParteCasoRow } from '../services/cache/parteCasoRow.js';

const logger = createLogger('hook:use-partes-caso');

/**
 * Intenta leer partes del caso desde la caché SQLite local.
 * Usado como fallback offline cuando la API no responde.
 *
 * Realiza un JOIN en memoria entre `parte_caso` y `partes`.
 * @param {string|number} caseId
 * @returns {Promise<Array>} Array de partes con flag `isStale: true`
 */
async function readPartesFromCache(caseId) {
    if (!window.electronAPI) return [];
    const [pivotRows, allPartes] = await Promise.all([
        window.electronAPI.db.getAll('parte_caso'),
        window.electronAPI.db.getAll('partes'),
    ]);
    const caseIdStr = String(caseId);
    const partesMap = new Map(allPartes.map((p) => [String(p.id), p]));
    return pivotRows
        .filter((r) => String(r.suit_case_id) === caseIdStr)
        .map((r) => {
            const parte = partesMap.get(String(r.parte_id));
            return parte ? { ...parte, isStale: true } : null;
        })
        .filter(Boolean);
}

/**
 * Hook para gestionar las asociaciones Parte ↔ Caso.
 *
 * Las partes del directorio global se obtienen de PartesContext.
 * Este hook maneja ÚNICAMENTE las asociaciones de un caso concreto:
 * qué partes están vinculadas, vincular nuevas y desvincular.
 *
 * Estrategia de caché:
 * - La tabla pivot `parte_caso` refleja localmente las asociaciones.
 * - Al cargar, sincroniza desde la API y actualiza el pivot en SQLite.
 * - `partesCaso` contiene los objetos Parte completos (con rol) del caso actual.
 * - Si la API falla, se sirve desde SQLite con flag `isStale: true`.
 *
 * PAR-4 fix: las escrituras al pivot usan operaciones atómicas (`deleteWhere`)
 * en vez de la secuencia no-atómica `clearTable + upsertMany`, eliminando la
 * race condition que podía corromper filas de otros casos.
 *
 * PAR-5 fix: el bloque catch implementa fallback offline desde SQLite.
 *
 * @param {number|string} caseId — ID del caso.
 */
export function usePartesCaso(caseId, {
    enabled = true,
    skipInitialFetch = false,
} = {}) {
    const [partesCaso, setPartesCaso] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [isStale, setIsStale] = useState(false);
    const requestGenerationRef = useRef(0);

    /**
     * Sincroniza desde la API y actualiza la caché pivot `parte_caso`.
     *
     * PAR-4: En vez de clearTable (borra TODO el pivot) + upsertMany,
     * usamos deleteWhere({ suit_case_id: caseId }) para borrar solo las filas
     * del caso actual, seguido de upsertMany con los nuevos datos.
     * Esto evita afectar filas de otros casos en operaciones concurrentes.
     */
    const loadData = useCallback(async (generation) => {
        if (!caseId) {
            setPartesCaso([]);
            setLoading(false);
            setIsStale(false);
            return;
        }

        if (!enabled) {
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const cachedPartes = await readPartesFromCache(caseId);
            if (requestGenerationRef.current !== generation) return;
            setPartesCaso(cachedPartes);
            setIsStale(false);
            setLoading(false);

            // Cuando el detalle del caso ya ejecutó syncDown, la caché local quedó fresca
            // y no tiene sentido volver a pedir las partes en el primer render del tab.
            if (skipInitialFetch) {
                return;
            }

            const apiData = await getPartesByCaso(caseId);
            if (requestGenerationRef.current !== generation) return;

            // PAR-4: Actualizar pivot de forma atómica solo para este caso.
            // deleteWhere elimina exactamente las filas del caso actual sin
            // tocar otros casos, evitando la race condition del clearTable global.
            if (Array.isArray(apiData) && window.electronAPI) {
                await window.electronAPI.db.deleteWhere('parte_caso', { suit_case_id: caseId });
                const newPivot = apiData.map((p) => buildParteCasoRow(p.id, caseId));
                if (newPivot.length > 0) {
                    await window.electronAPI.db.upsertMany('parte_caso', newPivot);
                }
            }

            if (requestGenerationRef.current !== generation) return;
            setPartesCaso(Array.isArray(apiData) ? apiData : []);
            setIsStale(false);
            setLoading(false);
        } catch (err) {
            if (requestGenerationRef.current !== generation) return;
            void logger.warn('loadData failed, trying SQLite cache', { caseId, error: err?.message });

            // PAR-5: Fallback offline — servir desde caché SQLite.
            // Si la API no responde, hacemos JOIN en memoria entre parte_caso y partes.
            // Los datos se marcan con isStale: true para que la UI pueda indicarlo.
            try {
                const cachedPartes = await readPartesFromCache(caseId);
                if (requestGenerationRef.current !== generation) return;
                setPartesCaso(cachedPartes);
                setIsStale(true);
                setError(null);
            } catch (cacheErr) {
                void logger.error('SQLite fallback also failed', { caseId, error: cacheErr?.message });
                setError('No se pudieron cargar las partes del caso.');
                setIsStale(false);
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

    const reload = useCallback(async () => {
        const generation = ++requestGenerationRef.current;
        await loadData(generation);
    }, [loadData]);

    /**
     * Asocia una parte existente al caso (idempotente en la API).
     * Actualiza la caché pivot y resincroniza el estado.
     */
    const linkParte = useCallback(async (parteId) => {
        const result = await linkParteToCaso(caseId, parteId);
        if (window.electronAPI) {
            await window.electronAPI.db.upsertMany('parte_caso', [buildParteCasoRow(parteId, caseId)]);
        }
        await reload();
        return result;
    }, [caseId, reload]);

    /**
     * Desasocia una parte del caso.
     *
     * PAR-4: En vez de getAll→filter→clearTable→upsertMany, usamos deleteWhere
     * con las dos claves del pivot (parte_id + suit_case_id). Un solo DELETE
     * atómico evita la race condition entre desvinculaciones concurrentes.
     */
    const unlinkParte = useCallback(async (parteId) => {
        const result = await unlinkParteFromCaso(caseId, parteId);
        // Actualización optimista del estado local
        setPartesCaso((prev) => prev.filter((p) => String(p.id) !== String(parteId)));
        // PAR-4: DELETE atómico de la fila exacta en el pivot
        if (window.electronAPI) {
            await window.electronAPI.db.deleteWhere('parte_caso', {
                parte_id: parteId,
                suit_case_id: caseId,
            });
        }
        return result;
    }, [caseId]);

    /** Set de IDs de partes vinculadas al caso (para chequeo O(1) en el UI). */
    const linkedParteIds = new Set(partesCaso.map((p) => String(p.id)));

    return {
        partesCaso,
        linkedParteIds,
        loading,
        error,
        isStale,
        reload,
        linkParte,
        unlinkParte,
    };
}
