import { createContext, useCallback, useContext, useEffect, useMemo, useReducer } from 'react';
import { getCatalogs } from '../services/publicFileCatalogService.js';
import { createLogger } from '../services/logService.js';

const PublicFileCatalogsContext = createContext(null);
const logger = createLogger('public-file-catalogs-context');

const initialState = {
    public_file_catalogs: [],
    syncing: false,
    initialized: false,
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_CATALOGS':
            return { ...state, public_file_catalogs: action.payload };
        case 'SET_SYNCING':
            return { ...state, syncing: action.payload };
        case 'SET_INITIALIZED':
            return { ...state, initialized: action.payload };
        default:
            return state;
    }
}

export function PublicFileCatalogsProvider({ children }) {
    const [state, dispatch] = useReducer(reducer, initialState);

    const refreshData = useCallback(async () => {
        dispatch({ type: 'SET_SYNCING', payload: true });

        try {
            const result = await getCatalogs();
            if (!result.ok) {
                throw new Error(result.error || `La API respondió con error ${result.status}`);
            }

            if (!Array.isArray(result.data)) {
                void logger.error('catalog list payload is invalid', { data: result.data });
                throw new Error('La API devolvió una respuesta inválida para los catálogos.');
            }

            dispatch({ type: 'SET_CATALOGS', payload: result.data });
            dispatch({ type: 'SET_INITIALIZED', payload: true });
            return result.data;
        } catch (error) {
            void logger.error('refresh public file catalogs failed', {
                error: error?.message || String(error),
            });
            dispatch({ type: 'SET_INITIALIZED', payload: true });
            throw error;
        } finally {
            dispatch({ type: 'SET_SYNCING', payload: false });
        }
    }, []);

    useEffect(() => {
        void refreshData().catch(() => {});
    }, [refreshData]);

    const value = useMemo(() => ({
        public_file_catalogs: state.public_file_catalogs,
        syncing: state.syncing,
        initialized: state.initialized,
        refreshData,
        refreshPublicFileCatalogs: refreshData,
        loadLocalData: async () => state.public_file_catalogs,
        loadLocalPublicFileCatalogs: async () => state.public_file_catalogs,
        updateItem: () => {},
        removeItem: () => {},
    }), [refreshData, state.initialized, state.public_file_catalogs, state.syncing]);

    return (
        <PublicFileCatalogsContext.Provider value={value}>
            {children}
        </PublicFileCatalogsContext.Provider>
    );
}

const _noopPublicFileCatalogs = {
    public_file_catalogs: [],
    syncing: false,
    initialized: true,
    refreshData: async () => [],
    refreshPublicFileCatalogs: async () => [],
    loadLocalData: async () => [],
    loadLocalPublicFileCatalogs: async () => [],
    updateItem: () => {},
    removeItem: () => {},
};

export function usePublicFileCatalogs() {
    return useContext(PublicFileCatalogsContext) ?? _noopPublicFileCatalogs;
}

export default PublicFileCatalogsContext;
