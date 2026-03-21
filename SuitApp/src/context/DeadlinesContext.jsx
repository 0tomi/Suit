/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useCallback, useEffect, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { syncDeadlinesMonth } from '../services/sync/deadlineSyncService.js';
import { createLogger } from '../services/logService.js';
import { parseJsonRows } from '../utils/dbUtils.js';
import { useDeadlinesProviderState } from '../hooks/useDeadlinesProviderState.js';

const DeadlinesContext = createContext(null);
const logger = createLogger('deadlines-context');

/** Retorna el mes/año siguiente dado un mes/año. */
function getNextMonth(month, year) {
    return month === 12 ? { month: 1, year: year + 1 } : { month: month + 1, year };
}

/**
 * Determina los meses a sincronizar/mostrar para la vista actual.
 * Regla: mes actual siempre. Si el día actual >= 20 Y estamos viendo el mes actual,
 * también se precarga el mes siguiente.
 */
function getMonthsToLoad(viewMonth, viewYear) {
    const now = new Date();
    const months = [{ month: viewMonth, year: viewYear }];
    const isViewingCurrentMonth =
        viewMonth === now.getMonth() + 1 && viewYear === now.getFullYear();
    if (isViewingCurrentMonth && now.getDate() >= 20) {
        months.push(getNextMonth(viewMonth, viewYear));
    }
    return months;
}

/** Filtra filas de SQLite para que coincidan con los meses dados (por due_date). */
function filterDeadlinesByMonths(rows, months) {
    const monthKeys = new Set(
        months.map(({ month, year }) => `${year}-${String(month).padStart(2, '0')}`)
    );
    return (rows || []).filter((row) => {
        if (!row.due_date) return false;
        return monthKeys.has(String(row.due_date).slice(0, 7));
    });
}

export const DeadlinesProvider = ({ children }) => {
    const { user, authEpoch } = useAuth();
    const skipAutoSyncRef = useRef(false);

    const {
        currentMonth, currentYear, deadlines, syncing, initialized,
        setDeadlines, setSyncing, setInitialized, setMonthYear, reset,
        startSync, endSync, markInitialized,
    } = useDeadlinesProviderState();

    /** Carga los vencimientos desde SQLite filtrando por los meses activos. */
    const loadLocalData = useCallback(async (months) => {
        if (!window.electronAPI || !user) return;
        try {
            const allRows = await window.electronAPI.db.getAll('deadlines');
            const filtered = filterDeadlinesByMonths(allRows, months);
            setDeadlines(parseJsonRows(filtered));
        } catch (err) {
            void logger.error('loadLocalData failed', err?.message);
        }
    }, [user]);

    /**
     * Sincroniza una ventana de meses y devuelve si al menos uno cambió en el servidor.
     */
    const syncMonths = useCallback(async (months) => {
        const results = await Promise.all(months.map(({ month, year }) => syncDeadlinesMonth(month, year)));
        return results.some(Boolean);
    }, []);

    // setMonthYear viene del hook (referencia estable, dispatch atómico).

    /** Fuerza re-sync de todos los meses activos (by-passes last-modified no aplica aquí,
     *  pero se puede usar para refresh explícito post-mutación). */
    const refreshDeadlines = useCallback(async () => {
        if (!window.electronAPI || !user) return false;
        const months = getMonthsToLoad(currentMonth, currentYear);
        setSyncing(true);
        try {
            const changed = await syncMonths(months);
            await loadLocalData(months);
            return changed;
        } catch (err) {
            void logger.error('refreshDeadlines failed', err?.message);
            return false;
        } finally {
            setSyncing(false);
        }
    }, [currentMonth, currentYear, loadLocalData, syncMonths, user]);

    /**
     * Repuebla vencimientos usando la misma ventana temporal del arranque en frío.
     * También actualiza el mes/año visible del provider sin disparar un doble sync.
     */
    const bootstrapDeadlines = useCallback(async () => {
        if (!window.electronAPI || !user) return false;

        const today = new Date();
        const bootstrapMonth = today.getMonth() + 1;
        const bootstrapYear = today.getFullYear();
        const months = getMonthsToLoad(bootstrapMonth, bootstrapYear);
        const shouldSkipNextAutoSync =
            currentMonth !== bootstrapMonth || currentYear !== bootstrapYear;

        skipAutoSyncRef.current = shouldSkipNextAutoSync;
        setMonthYear(bootstrapMonth, bootstrapYear);
        setSyncing(true);

        try {
            const changed = await syncMonths(months);
            await loadLocalData(months);
            setInitialized(true);
            return changed;
        } catch (err) {
            // Startup: el servidor puede no estar listo aún, fallo esperado
            void logger.warn('bootstrapDeadlines failed', err?.message);
            return false;
        } finally {
            setSyncing(false);
        }
    }, [currentMonth, currentYear, loadLocalData, syncMonths, user]);

    /**
     * Actualización optimista de un ítem en el estado local.
     * Los vencimientos no tienen update directo a SQLite aquí; se re-sincronizan desde la API.
     */
    const updateItem = useCallback((id, changes) => {
        setDeadlines((prev) => prev.map((d) => (d.id === id ? { ...d, ...changes } : d)));
    }, []);

    // Reset completo al hacer logout: un único dispatch → un único re-render para todos los consumers.
    useEffect(() => {
        reset();
        skipAutoSyncRef.current = false;
    }, [authEpoch, reset]);

    // Al cambiar el mes/año visualizado (o al montar por primera vez):
    // 1. Mostrar datos locales inmediatamente
    // 2. Sincronizar en background (verifica last-modified internamente)
    useEffect(() => {
        if (!user || !window.electronAPI) return;
        if (skipAutoSyncRef.current) {
            skipAutoSyncRef.current = false;
            return;
        }

        const months = getMonthsToLoad(currentMonth, currentYear);

        // Carga local inmediata para mostrar datos al instante
        loadLocalData(months).then(() => markInitialized());

        // Sync en background: verifica last-modified y descarga cambios si los hay.
        // Solo recarga SQLite si al menos un mes tuvo cambios (evita IPC redundante).
        startSync();
        Promise.all(months.map(({ month, year }) => syncDeadlinesMonth(month, year)))
            .then((results) => {
                if (results.some(Boolean)) return loadLocalData(months);
            })
            .catch((err) => {
                // Background sync periódico: fallo transitorio esperado
                void logger.warn('background sync failed', err?.message);
            })
            .finally(() => endSync());

    }, [currentMonth, currentYear, authEpoch, user]); // eslint-disable-line react-hooks/exhaustive-deps

    const value = useMemo(() => ({
        deadlines,
        syncing,
        initialized,
        currentMonth,
        currentYear,
        setMonthYear,
        refreshDeadlines,
        bootstrapDeadlines,
        updateItem,
    }), [
        deadlines,
        syncing,
        initialized,
        currentMonth,
        currentYear,
        setMonthYear,
        refreshDeadlines,
        bootstrapDeadlines,
        updateItem,
    ]);

    return (
        <DeadlinesContext.Provider value={value}>
            {children}
        </DeadlinesContext.Provider>
    );
};

export function useDeadlines() {
    const ctx = useContext(DeadlinesContext);
    if (!ctx) throw new Error('useDeadlines debe usarse dentro de DeadlinesProvider');
    return ctx;
}

export default DeadlinesContext;
