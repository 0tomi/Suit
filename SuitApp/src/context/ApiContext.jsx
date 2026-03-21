/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useReducer, useEffect, useCallback, useMemo, useRef } from 'react';
import { setApiBase, probeServer } from '../services/api.js';
import { isElectron } from '../utils/platform.js';
import { startupMark } from '../utils/startupMetrics.js';
import { createLogger } from '../services/logService.js';
const logger = createLogger('context:api');

const ApiContext = createContext(null);

export const useApi = () => {
    const ctx = useContext(ApiContext);
    if (!ctx) throw new Error('useApi debe usarse dentro de ApiProvider');
    return ctx;
};

const initialState = {
    apiHost: null,
    apiPort: null,
    connected: false,
    loading: true,
    showSetup: false,
    showServerUnavailableAlert: false,
};

function apiReducer(state, action) {
    switch (action.type) {
        case 'LOAD_SUCCESS':
            return {
                ...state,
                apiHost: action.payload.host,
                apiPort: action.payload.port,
                connected: true,
                loading: false,
                showSetup: false,
                showServerUnavailableAlert: false,
            };
        case 'LOAD_UNAVAILABLE':
            return {
                ...state,
                loading: false,
                showServerUnavailableAlert: true,
            };
        case 'LOAD_SETUP':
            return {
                ...state,
                loading: false,
                showSetup: true,
            };
        case 'DISCONNECT':
            return {
                ...state,
                connected: false,
                showServerUnavailableAlert: false,
                showSetup: true,
            };
        case 'SET_SHOW_SETUP':
            return {
                ...state,
                showSetup: action.payload,
            };
        case 'SET_SHOW_UNAVAILABLE_ALERT':
            return {
                ...state,
                showServerUnavailableAlert: action.payload,
            };
        default:
            return state;
    }
}

export const ApiProvider = ({ children }) => {
    const [state, dispatch] = useReducer(apiReducer, initialState);
    const configGenRef = useRef(0);
    const discoveryInFlightRef = useRef(null);

    const saveAndConnect = useCallback(async (host, port) => {
        const reachable = await probeServer(host, port);
        if (!reachable) return false;

        setApiBase(host, port);
        dispatch({ type: 'LOAD_SUCCESS', payload: { host, port } });

        if (isElectron()) {
            await window.electronAPI.config.set('api_host', host);
            await window.electronAPI.config.set('api_port', String(port));
        } else {
            localStorage.setItem('suit_api_host', host);
            localStorage.setItem('suit_api_port', String(port));
        }

        return true;
    }, []);

    const discoverAndConnect = useCallback(async () => {
        if (!isElectron() || typeof window.electronAPI?.discovery?.findServer !== 'function') {
            return {
                ok: false,
                reason: 'not-supported',
                message: 'El descubrimiento automatico solo esta disponible en Electron.',
            };
        }

        if (discoveryInFlightRef.current) {
            return await discoveryInFlightRef.current;
        }

        const discoveryPromise = (async () => {
            const discoveryResult = await window.electronAPI.discovery.findServer();
            if (!discoveryResult?.ok) {
                return discoveryResult || {
                    ok: false,
                    reason: 'socket-error',
                    message: 'No se pudo completar el descubrimiento automatico.',
                };
            }

            const { host, port } = discoveryResult;
            const connected = await saveAndConnect(host, port);
            if (connected) {
                return {
                    ok: true,
                    host,
                    port,
                };
            }

            return {
                ok: false,
                reason: 'probe-failed',
                message: `Se encontro SuitAPI en ${host}:${port}, pero la API HTTP no respondio.`,
                host,
                port,
            };
        })();

        discoveryInFlightRef.current = discoveryPromise;

        try {
            return await discoveryPromise;
        } finally {
            if (discoveryInFlightRef.current === discoveryPromise) {
                discoveryInFlightRef.current = null;
            }
        }
    }, [saveAndConnect]);

    // Al montar: intentar cargar config guardada
    useEffect(() => {
        const generation = ++configGenRef.current;
        startupMark('api:init:start', { generation });

        const loadConfig = async () => {
            try {
                if (isElectron()) {
                    const [host, port] = await Promise.all([
                        window.electronAPI.config.get('api_host'),
                        window.electronAPI.config.get('api_port'),
                    ]);
                    startupMark('api:config:loaded', { hasHost: Boolean(host), hasPort: Boolean(port) });
                    if (configGenRef.current !== generation) return;
                    if (host && port) {
                        startupMark('api:probe:start', { host, port });
                        const reachable = await probeServer(host, port);
                        if (configGenRef.current !== generation) return;
                        if (reachable) {
                            setApiBase(host, port);
                            dispatch({ type: 'LOAD_SUCCESS', payload: { host, port } });
                            startupMark('api:init:success', { host, port });
                            return;
                        }
                        startupMark('api:discovery:start', { reason: 'saved-config-unavailable' });
                        const discoveryResult = await discoverAndConnect();
                        if (configGenRef.current !== generation) return;
                        if (discoveryResult.ok) {
                            startupMark('api:init:discovery-success', {
                                host: discoveryResult.host,
                                port: discoveryResult.port,
                            });
                            return;
                        }
                        dispatch({ type: 'LOAD_UNAVAILABLE' });
                        startupMark('api:init:unavailable', {
                            host,
                            port,
                            discoveryReason: discoveryResult.reason,
                        });
                        return;
                    }
                } else {
                    // En browser puro (dev sin Electron), intentar localhost
                    const savedHost = localStorage.getItem('suit_api_host');
                    const savedPort = localStorage.getItem('suit_api_port');
                    startupMark('api:browser-config:loaded', { hasHost: Boolean(savedHost), hasPort: Boolean(savedPort) });
                    if (savedHost && savedPort) {
                        startupMark('api:probe:start', { host: savedHost, port: savedPort });
                        const reachable = await probeServer(savedHost, savedPort);
                        if (configGenRef.current !== generation) return;
                        if (reachable) {
                            setApiBase(savedHost, savedPort);
                            dispatch({ type: 'LOAD_SUCCESS', payload: { host: savedHost, port: savedPort } });
                            startupMark('api:init:success', { host: savedHost, port: savedPort });
                            return;
                        }
                        dispatch({ type: 'LOAD_UNAVAILABLE' });
                        startupMark('api:init:unavailable', { host: savedHost, port: savedPort });
                        return;
                    }
                }
            } catch (err) {
                // Startup: la app continúa al flujo de discovery/configuración
                void logger.warn('error loading API config', err);
                startupMark('api:init:error', { message: err?.message || String(err) });
            }
            if (configGenRef.current !== generation) return;
            if (isElectron()) {
                startupMark('api:discovery:start', { reason: 'missing-config' });
                const discoveryResult = await discoverAndConnect();
                if (configGenRef.current !== generation) return;
                if (discoveryResult.ok) {
                    startupMark('api:init:discovery-success', {
                        host: discoveryResult.host,
                        port: discoveryResult.port,
                    });
                    return;
                }
                startupMark('api:init:setup-discovery-failed', {
                    discoveryReason: discoveryResult.reason,
                });
            }
            dispatch({ type: 'LOAD_SETUP' });
            startupMark('api:init:setup-required');
        };

        loadConfig();
    }, [discoverAndConnect]);

    useEffect(() => {
        if (!isElectron() || !window.electronAPI?.notifications?.setApiAvailability) return;
        void window.electronAPI.notifications.setApiAvailability(state.connected);
    }, [state.connected]);

    const disconnect = useCallback(() => {
        setApiBase(null, null);
        dispatch({ type: 'DISCONNECT' });
    }, []);

    const setShowSetup = useCallback((val) => dispatch({ type: 'SET_SHOW_SETUP', payload: val }), []);
    const setShowServerUnavailableAlert = useCallback((val) => dispatch({ type: 'SET_SHOW_UNAVAILABLE_ALERT', payload: val }), []);

    const value = useMemo(() => ({
        apiHost: state.apiHost,
        apiPort: state.apiPort,
        connected: state.connected,
        loading: state.loading,
        showSetup: state.showSetup,
        setShowSetup,
        showServerUnavailableAlert: state.showServerUnavailableAlert,
        setShowServerUnavailableAlert,
        saveAndConnect,
        discoverAndConnect,
        disconnect,
    }), [state, setShowSetup, setShowServerUnavailableAlert, saveAndConnect, discoverAndConnect, disconnect]);

    return (
        <ApiContext.Provider value={value}>
            {children}
        </ApiContext.Provider>
    );
};

export default ApiContext;
