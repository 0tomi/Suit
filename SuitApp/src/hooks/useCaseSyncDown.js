/**
 * useCaseSyncDown.js — Hook que dispara el sync incremental de un caso al entrar a él.
 *
 * Al montar (o cuando cambia caseId), llama a syncCaseDown() que:
 * - Consulta last-modified per-entity
 * - Si hay cambios, trae los datos via syncDown y los persiste en cache
 * - Devuelve el resultado para que los hooks de sub-recursos puedan saber si ya se sincronizó
 *
 * Uso en CaseDetail.jsx:
 *   const { syncing, syncResult } = useCaseSyncDown(caseId);
 *
 * @param {number|string} caseId — ID del caso a sincronizar.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { syncCaseDown } from '../services/sync/caseSyncDownService.js';
import { createLogger } from '../services/logService.js';

const logger = createLogger('hook:use-case-sync-down');

/**
 * @typedef {Object} SyncResult
 * @property {boolean} changed — true si hubo cambios y se ejecutó syncDown
 * @property {Object|null} data — payload retornado por syncDown, o null si no hubo cambios
 * @property {string[]} staleEntities — entidades que estaban desactualizadas
 */

/**
 * Hook para sincronizar incrementalmente los sub-recursos de un caso.
 *
 * @param {number|string} caseId
 * @returns {{ syncing: boolean, lastSynced: Date|null, syncResult: SyncResult|null, refresh: Function }}
 */
export function useCaseSyncDown(caseId) {
    const [syncing, setSyncing] = useState(false);
    const [lastSynced, setLastSynced] = useState(null);
    const [syncResult, setSyncResult] = useState(null);
    const requestGenerationRef = useRef(0);

    /**
     * Ejecuta el sync incremental del caso.
     * Usa un contador de generación para cancelar setStates de llamadas anteriores
     * en caso de que caseId cambie rápido (ej: navegación veloz entre casos).
     */
    const runSync = useCallback(async (generation) => {
        if (!caseId) {
            setSyncing(false);
            setSyncResult(null);
            return;
        }

        setSyncing(true);
        try {
            const result = await syncCaseDown(Number(caseId));
            if (requestGenerationRef.current !== generation) return;

            setSyncResult(result);
            setLastSynced(new Date());
            void logger.info('sync done', { caseId, changed: result.changed });
        } catch (err) {
            if (requestGenerationRef.current !== generation) return;
            void logger.warn('sync error', { caseId, error: err?.message });
            setSyncResult(null);
        } finally {
            if (requestGenerationRef.current === generation) {
                setSyncing(false);
            }
        }
    }, [caseId]);

    useEffect(() => {
        const generation = ++requestGenerationRef.current;
        void runSync(generation);

        return () => {
            requestGenerationRef.current += 1;
        };
    }, [runSync]);

    /** Fuerza una re-sincronización del caso. */
    const refresh = useCallback(() => {
        const generation = ++requestGenerationRef.current;
        void runSync(generation);
    }, [runSync]);

    return { syncing, lastSynced, syncResult, refresh };
}
