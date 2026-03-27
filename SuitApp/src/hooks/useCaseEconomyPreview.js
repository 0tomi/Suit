import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getHonorariosByDateRange } from '../services/honorarioService.js';
import { getGastosByDateRange } from '../services/gastoSuitCaseService.js';
import { createLogger } from '../services/logService.js';

const logger = createLogger('hook:use-case-economy-preview');
const RANGE_FROM = '1970-01-01';
const RANGE_TO = '2099-12-31';

function sortByCreatedAtDesc(items) {
    return [...items].sort((a, b) => String(b.created_at || '').localeCompare(String(a.created_at || '')));
}

/**
 * Carga honorarios y gastos siguiendo el mismo circuito que la página general de Economía.
 * Consulta los endpoints by-date-range y luego filtra por suit_case_id para el caso activo.
 */
export function useCaseEconomyPreview(caseId) {
    const [honorarios, setHonorarios] = useState([]);
    const [gastos, setGastos] = useState([]);
    const [loading, setLoading] = useState(true);
    const [honorariosError, setHonorariosError] = useState(null);
    const [gastosError, setGastosError] = useState(null);
    const requestGenerationRef = useRef(0);

    const normalizedCaseId = useMemo(() => (caseId == null ? null : String(caseId)), [caseId]);

    const loadData = useCallback(async (generation) => {
        if (!normalizedCaseId) {
            setHonorarios([]);
            setGastos([]);
            setHonorariosError(null);
            setGastosError(null);
            setLoading(false);
            return;
        }

        setLoading(true);
        setHonorariosError(null);
        setGastosError(null);

        const [honorariosResult, gastosResult] = await Promise.allSettled([
            getHonorariosByDateRange(RANGE_FROM, RANGE_TO),
            getGastosByDateRange(RANGE_FROM, RANGE_TO),
        ]);

        if (requestGenerationRef.current !== generation) return;

        let nextHonorarios = [];
        let nextGastos = [];
        let nextHonorariosError = null;
        let nextGastosError = null;

        if (honorariosResult.status === 'fulfilled') {
            nextHonorarios = sortByCreatedAtDesc(
                honorariosResult.value.filter((item) => String(item.suit_case_id) === normalizedCaseId)
            );
        } else {
            nextHonorariosError = honorariosResult.reason instanceof Error
                ? honorariosResult.reason
                : new Error(String(honorariosResult.reason || 'Honorarios request failed.'));
            void logger.error('Drafting toolbar honorarios failed', {
                caseId: normalizedCaseId,
                error: nextHonorariosError.message,
            });
        }

        if (gastosResult.status === 'fulfilled') {
            nextGastos = sortByCreatedAtDesc(
                gastosResult.value.filter((item) => String(item.suit_case_id) === normalizedCaseId)
            );
        } else {
            nextGastosError = gastosResult.reason instanceof Error
                ? gastosResult.reason
                : new Error(String(gastosResult.reason || 'Gastos request failed.'));
            void logger.error('Drafting toolbar gastos failed', {
                caseId: normalizedCaseId,
                error: nextGastosError.message,
            });
        }

        setHonorarios(nextHonorarios);
        setGastos(nextGastos);
        setHonorariosError(nextHonorariosError);
        setGastosError(nextGastosError);
        setLoading(false);
    }, [normalizedCaseId]);

    useEffect(() => {
        const generation = ++requestGenerationRef.current;
        void loadData(generation);

        return () => {
            requestGenerationRef.current += 1;
        };
    }, [loadData]);

    return {
        honorarios,
        gastos,
        loading,
        honorariosError,
        gastosError,
    };
}
