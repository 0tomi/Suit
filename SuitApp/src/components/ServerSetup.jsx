import { useCallback, useEffect, useId, useReducer, useRef } from 'react';
import { useApi } from '../context/ApiContext';
import { Wifi, WifiOff, Server, Loader2, Monitor } from 'lucide-react';
import { isElectron } from '../utils/platform.js';

function getDiscoveryError(result) {
    if (!result) return 'No se pudo completar el descubrimiento automático.';
    if (result.reason === 'timeout') return 'No se encontró ningún servidor SuitAPI en la red local.';
    if (result.reason === 'invalid-response') return 'Se recibió una respuesta inválida del discovery UDP.';
    if (result.reason === 'probe-failed') return result.message;
    if (result.reason === 'not-supported') return result.message;
    return result.message || 'No se pudo completar el descubrimiento automático.';
}

const INITIAL_STATE = {
    host: '',
    port: '8000',
    error: '',
    testing: false,
    discovering: false,
};

function buildFormState(apiHost, apiPort) {
    return {
        ...INITIAL_STATE,
        host: apiHost || '',
        port: apiPort ? String(apiPort) : '8000',
    };
}

function serverSetupReducer(state, action) {
    switch (action.type) {
        case 'RESET_FROM_CONFIG':
            return buildFormState(action.host, action.port);
        case 'SET_HOST':
            return {
                ...state,
                host: action.value,
            };
        case 'SET_PORT':
            return {
                ...state,
                port: action.value,
            };
        case 'SET_LOCALHOST':
            return {
                ...state,
                host: 'localhost',
                port: '8000',
                error: '',
            };
        case 'DISCOVERY_START':
            return {
                ...state,
                error: '',
                discovering: true,
            };
        case 'DISCOVERY_FAILURE':
            return {
                ...state,
                discovering: false,
                error: action.error,
                host: action.host ?? state.host,
                port: action.port ?? state.port,
            };
        case 'DISCOVERY_END':
            return {
                ...state,
                discovering: false,
            };
        case 'TEST_START':
            return {
                ...state,
                error: '',
                testing: true,
            };
        case 'TEST_FAILURE':
            return {
                ...state,
                testing: false,
                error: action.error,
            };
        case 'TEST_END':
            return {
                ...state,
                testing: false,
            };
        default:
            return state;
    }
}

const ServerSetup = () => {
    const hostInputId = useId();
    const portInputId = useId();
    const hostInputRef = useRef(null);
    const { apiHost, apiPort, saveAndConnect, discoverAndConnect, showSetup, setShowSetup } = useApi();
    const [state, dispatch] = useReducer(serverSetupReducer, INITIAL_STATE);
    const stateRef = useRef(state);
    const canDiscover = isElectron();

    useEffect(() => {
        stateRef.current = state;
    }, [state]);

    const runDiscovery = useCallback(async () => {
        if (!canDiscover || stateRef.current.discovering || stateRef.current.testing) return;

        dispatch({ type: 'DISCOVERY_START' });

        try {
            const result = await discoverAndConnect();
            if (result?.ok) {
                dispatch({ type: 'DISCOVERY_END' });
                return;
            }

            dispatch({
                type: 'DISCOVERY_FAILURE',
                error: getDiscoveryError(result),
                host: result?.reason === 'probe-failed' ? result.host : undefined,
                port: result?.reason === 'probe-failed' && result.port ? String(result.port) : undefined,
            });
            hostInputRef.current?.focus();
        } catch (err) {
            dispatch({
                type: 'DISCOVERY_FAILURE',
                error: err?.message || 'No se pudo completar el descubrimiento automático.',
            });
            hostInputRef.current?.focus();
        }
    }, [canDiscover, discoverAndConnect]);

    useEffect(() => {
        if (!showSetup) return;
        dispatch({ type: 'RESET_FROM_CONFIG', host: apiHost, port: apiPort });

        if (!canDiscover) {
            hostInputRef.current?.focus();
        }
    }, [apiHost, apiPort, canDiscover, showSetup]);

    useEffect(() => {
        if (!showSetup || !canDiscover) return;
        void runDiscovery();
    }, [canDiscover, runDiscovery, showSetup]);

    if (!showSetup) return null;

    const handleAccept = async () => {
        if (state.discovering || state.testing) return;
        if (!state.host.trim() || !state.port.trim()) {
            dispatch({ type: 'TEST_FAILURE', error: 'Complete ambos campos' });
            return;
        }
        dispatch({ type: 'TEST_START' });

        const success = await saveAndConnect(state.host.trim(), state.port.trim());
        dispatch({ type: 'TEST_END' });

        if (!success) {
            dispatch({
                type: 'TEST_FAILURE',
                error: `No se pudo conectar a ${state.host}:${state.port}. Verifique que el servidor esté activo.`,
            });
        }
    };

    const handleLocalhost = () => {
        dispatch({ type: 'SET_LOCALHOST' });
    };

    const handleDiscovery = () => {
        void runDiscovery();
    };

    const handleKeyDown = (e) => {
        if (e.key === 'Enter') handleAccept();
    };

    return (
        <div data-testid="server-setup-modal" className="fixed inset-0 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-300">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 px-6 py-5 text-white">
                    <div className="flex items-center gap-3">
                        <Server className="w-6 h-6" />
                        <div>
                            <h2 className="text-lg font-bold">Parámetros de Conexión a Suit Server</h2>
                            <p className="text-blue-100 text-sm mt-0.5">Configure la dirección del servidor API</p>
                        </div>
                    </div>
                </div>

                {/* Body */}
                <div className="p-6 space-y-4">
                    {/* IP */}
                    <div>
                        <label htmlFor={hostInputId} className="block text-sm font-medium text-gray-700 mb-1.5">
                            Dirección IP del servidor
                        </label>
                        <input
                            id={hostInputId}
                            ref={hostInputRef}
                            type="text"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900"
                            placeholder="Ej: 192.168.1.50"
                            value={state.host}
                            onChange={(e) => dispatch({ type: 'SET_HOST', value: e.target.value })}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {/* Puerto */}
                    <div>
                        <label htmlFor={portInputId} className="block text-sm font-medium text-gray-700 mb-1.5">
                            Puerto
                        </label>
                        <input
                            id={portInputId}
                            type="number"
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-gray-900"
                            placeholder="Ej: 8000"
                            value={state.port}
                            onChange={(e) => dispatch({ type: 'SET_PORT', value: e.target.value })}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    {/* Error */}
                    {state.error && (
                        <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
                            <WifiOff className="w-4 h-4 shrink-0" />
                            {state.error}
                        </div>
                    )}

                    {/* Botón Usar localhost */}
                    <button
                        type="button"
                        data-testid="server-setup-localhost"
                        onClick={handleLocalhost}
                        disabled={state.testing || state.discovering}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium text-sm transition-colors border border-gray-200 disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                        <Monitor className="w-4 h-4" />
                        Usar localhost
                    </button>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 bg-gray-50 border-t border-gray-100 flex flex-col gap-3">
                    {/* Fila de botones principales */}
                    <div className="flex justify-between items-center gap-3">
                        <button
                            type="button"
                            onClick={() => setShowSetup(false)}
                            className="px-4 py-2.5 text-gray-600 hover:text-gray-800 font-medium text-sm rounded-lg hover:bg-gray-100 transition-colors"
                        >
                            Cerrar
                        </button>

                        <div className="flex gap-2">
                            {/* Ubicar Servidor — disabled, linked to discovery.cjs stub */}
                            <button
                                type="button"
                                onClick={handleDiscovery}
                                data-testid="server-setup-discovery"
                                disabled={!canDiscover || state.testing || state.discovering}
                                className="flex items-center gap-2 px-4 py-2.5 bg-amber-50 text-amber-700 rounded-lg font-medium text-sm border border-amber-200 disabled:cursor-not-allowed disabled:opacity-60"
                                title={canDiscover ? 'Buscar automáticamente el servidor en la red local' : 'Disponible solo en Electron'}
                            >
                                {state.discovering ? <Loader2 className="w-4 h-4 animate-spin" /> : <Wifi className="w-4 h-4" />}
                                {state.discovering ? 'Buscando...' : 'Ubicar Servidor'}
                            </button>

                            {/* Aceptar */}
                            <button
                                type="button"
                                data-testid="server-setup-accept"
                                onClick={handleAccept}
                                disabled={state.testing || state.discovering}
                                className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium text-sm shadow-sm transition-all disabled:opacity-60"
                            >
                                {state.testing ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                        Probando...
                                    </>
                                ) : (
                                    'Aceptar'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ServerSetup;
