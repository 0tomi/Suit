import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { login as apiLogin, logout as apiLogout, validateToken } from '../services/authService.js';
import { clearApiRequestState, setAuthToken, subscribeApiState } from '../services/api.js';
import { loadSaved, savePersistent, deletePersistent } from '../utils/platform.js';
import { resetNotificationSyncInFlightState } from '../services/eventNotificationService.js';
import { resetAgendaMonthSyncInFlightState } from '../services/sync/agendaMonthSyncService.js';
import { resetSyncInFlightState } from '../services/sync/syncCore.js';
import { reset as schedulerReset } from '../services/sync/SyncScheduler.js';
import { createLogger } from '../services/logService.js';
import { useApi } from './ApiContext';
import { startupMark } from '../utils/startupMetrics.js';

const AuthContext = createContext(null);
const logger = createLogger('auth-context');

export const useAuth = () => {
    const ctx = useContext(AuthContext);
    if (!ctx) throw new Error('useAuth debe usarse dentro de AuthProvider');
    return ctx;
};

const initialState = {
    user: null,
    loading: true,
    authEpoch: 0,
};

function resetInFlightClientState() {
    clearApiRequestState();
    resetSyncInFlightState();
    resetAgendaMonthSyncInFlightState();
    resetNotificationSyncInFlightState();
    schedulerReset();
}

function authReducer(state, action) {
    switch (action.type) {
        case 'RESTORE_START':
            return {
                ...state,
                loading: true,
            };
        case 'RESTORE_SUCCESS':
            return {
                ...state,
                user: action.payload,
                loading: false,
                authEpoch: state.authEpoch + 1,
            };
        case 'RESTORE_FAIL':
            return {
                ...state,
                user: null,
                loading: false,
            };
        case 'RESTORE_OFFLINE':
            return {
                ...state,
                user: action.payload,
                loading: false,
                authEpoch: state.authEpoch + 1,
            };
        case 'LOGIN_SUCCESS':
            return {
                ...state,
                user: action.payload,
                loading: false,
                authEpoch: state.authEpoch + 1,
            };
        case 'SET_USER':
            return {
                ...state,
                user: action.payload,
            };
        case 'LOGOUT':
            if (!state.user) {
                return {
                    ...state,
                    user: null,
                    loading: false,
                };
            }
            return {
                ...state,
                user: null,
                loading: false,
                authEpoch: state.authEpoch + 1,
            };
        default:
            return state;
    }
}

export const AuthProvider = ({ children }) => {
    const { connected, loading: apiLoading } = useApi();
    const [state, dispatch] = useReducer(authReducer, initialState);
    const restoreGenRef = useRef(0);

    const runSessionBoundaryReset = useCallback(async ({
        clearNotificationState = false,
    } = {}) => {
        resetInFlightClientState();

        const tasks = [];
        if (clearNotificationState && window.electronAPI?.notifications?.clearStateForCurrentUser) {
            tasks.push(window.electronAPI.notifications.clearStateForCurrentUser());
        }

        if (tasks.length === 0) return;

        const settled = await Promise.allSettled(tasks);
        for (const result of settled) {
            if (result.status === 'rejected') {
                void logger.error('session boundary reset failed', result.reason);
            }
        }
    }, []);

    const loadTodayNotificationsFromApi = useCallback(async () => {
        try {
            await window.electronAPI?.notifications?.loadTodayFromApi?.();
        } catch (err) {
            // Feature secundaria post-login: falla silenciosamente sin afectar la sesión
            void logger.warn('failed to load today notifications from API', err);
        }
    }, []);

    useEffect(() => {
        const unsubscribe = subscribeApiState((event) => {
            if (event.type === 'auth-token-changed' && !event.state.hasAuthToken) {
                resetInFlightClientState();
                dispatch({ type: 'LOGOUT' });
            }
        });
        return unsubscribe;
    }, []);

    // Al montar (o al conectar): intentar restaurar sesión
    useEffect(() => {
        // Esperar a que ApiContext termine de inicializar
        if (apiLoading) return;

        const generation = ++restoreGenRef.current;
        startupMark('auth:restore:start', { generation, connected });

        const restoreSession = async () => {
            // Empezar loading por si es una re-conexión
            dispatch({ type: 'RESTORE_START' });
            try {
                const [savedToken, userJson] = await Promise.all([
                    loadSaved('auth_token'),
                    loadSaved('auth_user'),
                ]);
                startupMark('auth:restore:persisted-loaded', {
                    hasToken: Boolean(savedToken),
                    hasUser: Boolean(userJson),
                });
                if (restoreGenRef.current !== generation) return;

                let savedUser = null;
                if (userJson) {
                    try { savedUser = JSON.parse(userJson); } catch (err) { void logger.error('error parsing savedUser JSON', err); }
                }

                // Solo intentar validar con API si estamos conectados
                if (connected) {
                    if (savedToken) {
                        setAuthToken(savedToken, { reason: 'restore-session' });
                        startupMark('auth:restore:validate-token:start');
                        const { valid, user: apiUser } = await validateToken();
                        if (restoreGenRef.current !== generation) return;
                        if (valid) {
                            dispatch({ type: 'RESTORE_SUCCESS', payload: apiUser || savedUser });
                            await loadTodayNotificationsFromApi();
                            startupMark('auth:restore:success');
                            return;
                        }
                    }

                    // Si estamos conectados pero el token es inválido (expirado) o no hay token,
                    // forzamos a re-logearse borrando el token y no usando el fallback offline.
                    setAuthToken(null, { reason: 'invalid-or-missing-token' });
                    await deletePersistent('auth_token');
                    if (restoreGenRef.current !== generation) return;
                    dispatch({ type: 'RESTORE_FAIL' });
                    startupMark('auth:restore:failed-online');
                    return;
                }

                // Sin conexión — usar usuario cacheado (modo offline genuino)
                if (savedUser) {
                    void logger.warn(`modo offline (conectado: ${connected})`);
                    dispatch({ type: 'RESTORE_OFFLINE', payload: savedUser });
                    startupMark('auth:restore:offline-success');
                    return;
                }
                dispatch({ type: 'RESTORE_FAIL' });
                startupMark('auth:restore:failed-offline');
            } catch (err) {
                // Startup con servidor no disponible: tiene fallback offline implementado
                void logger.warn('error restoring session', err);
                if (restoreGenRef.current !== generation) return;
                // Si falla algo inesperado, fallback a cache
                const userJson = await loadSaved('auth_user');
                if (userJson) {
                    try {
                        dispatch({ type: 'RESTORE_OFFLINE', payload: JSON.parse(userJson) });
                        startupMark('auth:restore:fallback-offline-success');
                        return;
                    } catch (fallbackError) { void logger.error('error parsing user fallback JSON', fallbackError); }
                }
                dispatch({ type: 'RESTORE_FAIL' });
                startupMark('auth:restore:error', { message: err?.message || String(err) });
            }
        };

        restoreSession();
    }, [apiLoading, connected, loadTodayNotificationsFromApi]);

    const login = useCallback(async (tag, password) => {
        const result = await apiLogin(tag, password);
        if (result.success) {
            restoreGenRef.current += 1;

            await runSessionBoundaryReset({
                clearNotificationState: true,
            });

            if (window.electronAPI?.profiles?.activateRemoteUser) {
                await window.electronAPI.profiles.activateRemoteUser(result.user);
            }

            dispatch({ type: 'LOGIN_SUCCESS', payload: result.user });

            // Persistir solo token y usuario (NO credenciales)
            const persistResults = await Promise.allSettled([
                savePersistent('auth_token', result.token),
                savePersistent('auth_user', JSON.stringify(result.user)),
            ]);
            for (const persistResult of persistResults) {
                if (persistResult.status === 'rejected') {
                    void logger.error('failed to persist login session', persistResult.reason);
                }
            }

            await loadTodayNotificationsFromApi();

            return { success: true };
        }
        return { success: false, error: result.error };
    }, [loadTodayNotificationsFromApi, runSessionBoundaryReset]);

    const logout = useCallback(async () => {
        restoreGenRef.current += 1;
        try { await apiLogout(); } catch (err) { void logger.warn('apiLogout failed (maybe offline)', err); }
        dispatch({ type: 'LOGOUT' });
        setAuthToken(null, { reason: 'logout' });

        await runSessionBoundaryReset({
            clearNotificationState: true,
        });

        const tasks = [
            deletePersistent('auth_token'),
            deletePersistent('auth_user'),
        ];
        const settled = await Promise.allSettled(tasks);
        for (const result of settled) {
            if (result.status === 'rejected') {
                void logger.error('logout cleanup failed', result.reason);
            }
        }

        try {
            await window.electronAPI?.profiles?.deactivate?.();
        } catch (err) {
            void logger.error('failed to deactivate profile on logout', err);
        }
    }, [runSessionBoundaryReset]);

    const updateUser = useCallback(async (partialUser) => {
        if (!state.user) return;
        const merged = { ...state.user, ...partialUser };
        dispatch({ type: 'SET_USER', payload: merged });
        await savePersistent('auth_user', JSON.stringify(merged));
    }, [state.user]);

    const value = useMemo(() => ({
        user: state.user,
        loading: state.loading,
        authEpoch: state.authEpoch,
        login,
        logout,
        updateUser,
    }), [state.user, state.loading, state.authEpoch, login, logout, updateUser]);

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

export default AuthContext;
