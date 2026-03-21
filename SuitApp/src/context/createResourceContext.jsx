import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useSyncStatus } from './SyncStatusContext.jsx';
import { parseJsonRows } from '../utils/dbUtils.js';
import { createLogger } from '../services/logService.js';

/**
 * Normaliza el nombre del recurso para construir aliases públicos estables.
 * Ejemplos: `partes` -> `Partes`, `tipo_pagos` -> `TipoPagos`.
 */
function toPascalCaseResourceName(resourceName) {
    return String(resourceName)
        .split(/[_-\s]+/)
        .filter(Boolean)
        .map((chunk) => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join('');
}

export function createResourceContext({
    resourceName,
    syncFn,
    parseRows = parseJsonRows,
    autoRefreshOnMount = true,
}) {
    const Context = createContext(null);
    const logger = createLogger(`${resourceName.toLowerCase()}-context`);

    const useResource = () => {
        const ctx = useContext(Context);
        if (!ctx) throw new Error(`use${resourceName} debe usarse dentro de su Provider`);
        return ctx;
    };

    const initialState = {
        data: [],
        syncing: false,
        initialized: false,
        error: null,
    };

    function resourceReducer(state, action) {
        switch (action.type) {
            case 'SET_DATA':
                return {
                    ...state,
                    data: action.payload,
                };
            case 'SET_SYNCING':
                return {
                    ...state,
                    syncing: action.payload,
                };
            case 'UPDATE_ITEM':
                return {
                    ...state,
                    data: (state.data || []).map(item =>
                        String(item.id) === String(action.payload.id)
                            ? { ...item, ...action.payload.changes }
                            : item
                    ),
                };
            case 'DELETE_ITEM':
                return {
                    ...state,
                    data: (state.data || []).filter(item => String(item.id) !== String(action.payload.id)),
                };
            case 'RESET_DATA':
                return {
                    ...initialState,
                };
            case 'SET_INITIALIZED':
                return {
                    ...state,
                    initialized: action.payload,
                };
            case 'SET_ERROR':
                return {
                    ...state,
                    error: action.payload,
                };
            default:
                return state;
        }
    }

    const Provider = ({ children }) => {
        const { user, authEpoch = 0 } = useAuth();
        const { setSyncStatus } = useSyncStatus();
        const [state, dispatch] = useReducer(resourceReducer, initialState);
        const syncGenerationRef = useRef(0);
        const isSyncingRef = useRef(false);
        const authEpochRef = useRef(authEpoch);

        useEffect(() => {
            authEpochRef.current = authEpoch;
        }, [authEpoch]);

        const loadLocalData = useCallback(async ({ epoch = authEpochRef.current } = {}) => {
            if (authEpochRef.current !== epoch) return [];
            if (!window.electronAPI) {
                if (authEpochRef.current !== epoch) return [];
                dispatch({ type: 'SET_DATA', payload: [] });
                return [];
            }
            const tableName = resourceName.toLowerCase();

            try {
                const rows = await window.electronAPI.db.getAll(tableName);
                if (authEpochRef.current !== epoch) return [];
                const parsed = parseRows(rows);
                if (authEpochRef.current !== epoch) return parsed;
                dispatch({ type: 'SET_DATA', payload: parsed });
                return parsed;
            } catch (err) {
                void logger.error(`loadLocalData failed for ${tableName}`, err);
                throw err;
            }
        }, []);

        const refreshData = useCallback(async () => {
            const epochAtStart = authEpochRef.current;
            if (isSyncingRef.current) return;
            isSyncingRef.current = true;
            dispatch({ type: 'SET_SYNCING', payload: true });
            dispatch({ type: 'SET_ERROR', payload: null });
            setSyncStatus(resourceName, true);
            try {
                await syncFn();
                if (authEpochRef.current !== epochAtStart) return;
                await loadLocalData({ epoch: epochAtStart });
            } catch (err) {
                // Background sync puede fallar por red/startup: no genera snapshot
                void logger.warn('refreshData failed', err);
                if (authEpochRef.current === epochAtStart) {
                    dispatch({
                        type: 'SET_ERROR',
                        payload: err?.message || `No se pudieron actualizar los datos de ${resourceName}.`,
                    });
                }
            } finally {
                isSyncingRef.current = false;
                if (authEpochRef.current === epochAtStart) {
                    dispatch({ type: 'SET_SYNCING', payload: false });
                    setSyncStatus(resourceName, false);
                }
            }
        }, [loadLocalData, setSyncStatus]);

        const updateItem = useCallback((id, changes) => {
            const epochAtStart = authEpochRef.current;
            dispatch({ type: 'UPDATE_ITEM', payload: { id, changes } });
            // Persistir en la caché SQLite para que al recargar el dato ya esté actualizado.
            if (window.electronAPI) {
                const tableName = resourceName.toLowerCase();
                window.electronAPI.db.getById(tableName, id).then(existing => {
                    if (authEpochRef.current !== epochAtStart) return;
                    if (existing) {
                        const updated = { ...existing, ...changes };
                        if (authEpochRef.current !== epochAtStart) return;
                        window.electronAPI.db.upsertMany(tableName, [updated]);
                    }
                }).catch((err) => {
                    void logger.error(`updateItem persistence failed for ${tableName}`, {
                        id,
                        changes,
                        error: err?.message || String(err),
                    });
                });
            }
        }, []);

        const removeItem = useCallback((id) => {
            const epochAtStart = authEpochRef.current;
            dispatch({ type: 'DELETE_ITEM', payload: { id } });
            // Persistir eliminación en SQLite
            if (window.electronAPI) {
                const tableName = resourceName.toLowerCase();
                window.electronAPI.db.deleteById(tableName, id).catch((err) => {
                    if (authEpochRef.current !== epochAtStart) return;
                    void logger.error(`removeItem persistence failed for ${tableName}`, {
                        id,
                        error: err?.message || String(err),
                    });
                });
            }
        }, []);

        useEffect(() => {
            if (!user) {
                syncGenerationRef.current += 1;
                isSyncingRef.current = false;
                dispatch({ type: 'RESET_DATA' });
                return;
            }
            const generation = ++syncGenerationRef.current;
            const epochAtStart = authEpochRef.current;

            const init = async () => {
                await loadLocalData({ epoch: epochAtStart });
                if (authEpochRef.current !== epochAtStart) return;
                if (syncGenerationRef.current !== generation) return;

                dispatch({ type: 'SET_INITIALIZED', payload: true });
                if (autoRefreshOnMount) {
                    refreshData();
                }
            };

            init();
        }, [authEpoch, loadLocalData, refreshData, user]);

        const value = useMemo(() => {
            const legacyRefreshKey = `refresh${resourceName}`;
            const normalizedRefreshKey = `refresh${toPascalCaseResourceName(resourceName)}`;

            return {
                [resourceName.toLowerCase()]: state.data,
                syncing: state.syncing,
                initialized: state.initialized,
                error: state.error,
                // refreshData queda como contrato base para evitar depender de nombres dinámicos.
                refreshData,
                [legacyRefreshKey]: refreshData,
                ...(normalizedRefreshKey !== legacyRefreshKey
                    ? { [normalizedRefreshKey]: refreshData }
                    : {}),
                loadLocalData,
                updateItem,
                removeItem,
            };
        }, [state.data, state.syncing, state.initialized, state.error, refreshData, loadLocalData, updateItem, removeItem]);

        return (
            <Context.Provider value={value}>
                {children}
            </Context.Provider>
        );
    };

    return { Context, Provider, useResource };
}
