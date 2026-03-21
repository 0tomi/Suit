/* eslint-disable react-refresh/only-export-components */
/**
 * PublicFilesContext.jsx — Contexto de la Biblioteca de Archivos Públicos.
 *
 * Contexto customizado (no usa createResourceContext) porque el flujo de sincronización
 * es incremental (no full-replace) y expone una interfaz paginada orientada al frontend.
 *
 * Interfaz pública:
 *   - getFilesForCatalog(catalogId, page, perPage) → { data, total, totalPages }
 *   - syncing, initialized
 *   - refreshData() — sync API → cache → re-render
 *   - uploadFile(formData), renameFile(id, name, catalogId), deleteFile(id)
 *   - getPermissions(fileId), setPermissions(fileId, data), revokePermission(fileId, userId)
 *   - downloadFile(fileId, suggestedName) — IPC → diálogo nativo → escribe en disco
 */
import {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useReducer,
    useRef,
} from 'react';
import { useAuth } from './AuthContext.jsx';
import { useSyncStatus } from './SyncStatusContext.jsx';
import { parseJsonRows } from '../utils/dbUtils.js';
import { createLogger } from '../services/logService.js';
import { syncPublicFiles } from '../services/sync/publicFileSyncService.js';
import {
    uploadFile as apiUploadFile,
    updateFile as apiUpdateFile,
    deleteFile as apiDeleteFile,
    getPermissions as apiGetPermissions,
    setPermissions as apiSetPermissions,
    revokePermission as apiRevokePermission,
} from '../services/publicFileService.js';
import { buildPublicFileCacheRow } from '../services/sync/publicFileSyncService.js';

const PublicFilesContext = createContext(null);
const logger = createLogger('public-files-context');
const TABLE = 'public_files';

const initialState = {
    allFiles: [],
    syncing: false,
    initialized: false,
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_ALL_FILES':
            return { ...state, allFiles: action.payload };
        case 'SET_SYNCING':
            return { ...state, syncing: action.payload };
        case 'SET_INITIALIZED':
            return { ...state, initialized: action.payload };
        case 'UPSERT_FILE': {
            // exists se calcula sobre el array original, antes del map
            const exists = state.allFiles.some((f) => String(f.id) === String(action.payload.id));
            if (!exists) return { ...state, allFiles: [action.payload, ...state.allFiles] };
            return {
                ...state,
                allFiles: state.allFiles.map((f) =>
                    String(f.id) === String(action.payload.id) ? { ...f, ...action.payload } : f
                ),
            };
        }
        case 'REMOVE_FILE':
            return {
                ...state,
                allFiles: state.allFiles.filter((f) => String(f.id) !== String(action.payload)),
            };
        case 'RESET':
            return initialState;
        default:
            return state;
    }
}

export function PublicFilesProvider({ children }) {
    const { user, authEpoch = 0 } = useAuth();
    const { setSyncStatus } = useSyncStatus();
    const [state, dispatch] = useReducer(reducer, initialState);
    const isSyncingRef = useRef(false);
    const authEpochRef = useRef(authEpoch);

    useEffect(() => {
        authEpochRef.current = authEpoch;
    }, [authEpoch]);

    /** Carga todos los archivos del cache SQLite local. */
    const loadLocalData = useCallback(async ({ epoch = authEpochRef.current } = {}) => {
        if (!window.electronAPI) return;
        try {
            const rows = await window.electronAPI.db.getAll(TABLE);
            if (authEpochRef.current !== epoch) return;
            const parsed = parseJsonRows(rows);
            dispatch({ type: 'SET_ALL_FILES', payload: parsed });
        } catch (err) {
            void logger.error('loadLocalData failed', err);
        }
    }, []);

    /** Lanza sync contra la API y recarga el cache local. */
    const refreshData = useCallback(async () => {
        const epochAtStart = authEpochRef.current;
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        dispatch({ type: 'SET_SYNCING', payload: true });
        setSyncStatus('PublicFiles', true);
        try {
            await syncPublicFiles();
            if (authEpochRef.current !== epochAtStart) return;
            await loadLocalData({ epoch: epochAtStart });
        } catch (err) {
            void logger.warn('refreshData failed', err);
        } finally {
            isSyncingRef.current = false;
            if (authEpochRef.current === epochAtStart) {
                dispatch({ type: 'SET_SYNCING', payload: false });
                setSyncStatus('PublicFiles', false);
            }
        }
    }, [loadLocalData, setSyncStatus]);

    // Inicializar / resetear al cambiar usuario.
    // Se usa authEpoch (primitivo) como dependency en lugar del objeto user completo
    // para evitar re-runs en cambios de referencia no relacionados con la sesión (rerender-dependencies).
    const isLoggedIn = Boolean(user);
    useEffect(() => {
        if (!isLoggedIn) {
            dispatch({ type: 'RESET' });
            isSyncingRef.current = false;
            return;
        }
        const epochAtStart = authEpochRef.current;
        (async () => {
            await loadLocalData({ epoch: epochAtStart });
            if (authEpochRef.current !== epochAtStart) return;
            dispatch({ type: 'SET_INITIALIZED', payload: true });
            refreshData();
        })();
    }, [authEpoch, isLoggedIn, loadLocalData, refreshData]);

    /**
     * Retorna archivos de un catálogo paginados desde el cache en memoria.
     * No hace llamadas a red — el frontend simplemente pide la "ventana" a pintar.
     * @param {number|null} catalogId - null devuelve todos los archivos
     * @param {number} [page=1]
     * @param {number} [perPage=15]
     * @returns {{ data: object[], total: number, totalPages: number, page: number }}
     */
    const getFilesForCatalog = useCallback((catalogId, page = 1, perPage = 15) => {
        const filtered = catalogId == null
            ? state.allFiles
            : state.allFiles.filter((f) => String(f.public_file_catalog_id) === String(catalogId));

        const total = filtered.length;
        const totalPages = Math.max(1, Math.ceil(total / perPage));
        const safePage = Math.min(Math.max(1, page), totalPages);
        const start = (safePage - 1) * perPage;
        const data = filtered.slice(start, start + perPage);

        return { data, total, totalPages, page: safePage };
    }, [state.allFiles]);

    /**
     * Sube un archivo nuevo a la Biblioteca.
     * @param {FormData} formData - Debe incluir campo `file` y opcionalmente `public_file_catalog_id`.
     * @returns {Promise<{ ok: boolean, data: object }>}
     */
    const uploadFile = useCallback(async (formData) => {
        const result = await apiUploadFile(formData);
        if (result.ok && result.data?.data) {
            const file = result.data.data;
            const cacheRow = buildPublicFileCacheRow(file);
            // Persistir en SQLite y actualizar estado local optimistamente
            await window.electronAPI.db.upsertMany(TABLE, [cacheRow]);
            dispatch({ type: 'UPSERT_FILE', payload: file });
        }
        return result;
    }, []);

    /**
     * Renombra un archivo o lo mueve a otro catálogo.
     * @param {number} id
     * @param {string} name
     * @param {number} [catalogId]
     * @returns {Promise<{ ok: boolean, data: object }>}
     */
    const renameFile = useCallback(async (id, name, catalogId) => {
        const body = { name };
        if (catalogId != null) body.public_file_catalog_id = catalogId;
        const result = await apiUpdateFile(id, body);
        if (result.ok) {
            const changes = { name, ...(catalogId != null ? { public_file_catalog_id: catalogId } : {}) };
            dispatch({ type: 'UPSERT_FILE', payload: { id, ...changes } });
            // Actualizar SQLite
            const existing = await window.electronAPI.db.getById(TABLE, id);
            if (existing) {
                await window.electronAPI.db.upsertMany(TABLE, [{ ...existing, ...changes }]);
            }
        }
        return result;
    }, []);

    /**
     * Elimina (soft delete) un archivo de la Biblioteca.
     * @param {number} id
     * @returns {Promise<{ ok: boolean }>}
     */
    const deleteFile = useCallback(async (id) => {
        const result = await apiDeleteFile(id);
        if (result.ok) {
            dispatch({ type: 'REMOVE_FILE', payload: id });
            await window.electronAPI.db.deleteById(TABLE, id);
        }
        return result;
    }, []);

    /** Descarga un archivo via IPC (abre diálogo nativo de guardado). */
    const downloadFile = useCallback((fileId, suggestedName) => {
        return window.electronAPI.publicFiles.download(fileId, suggestedName);
    }, []);

    /** Obtiene los permisos explícitos de un archivo (llamada directa a la API). */
    const getPermissions = useCallback((fileId) => apiGetPermissions(fileId), []);

    /** Otorga o actualiza permisos de un usuario sobre un archivo. */
    const setPermissions = useCallback((fileId, data) => apiSetPermissions(fileId, data), []);

    /** Revoca los permisos de un usuario sobre un archivo. */
    const revokePermission = useCallback((fileId, userId) => apiRevokePermission(fileId, userId), []);

    const value = useMemo(() => ({
        getFilesForCatalog,
        syncing: state.syncing,
        initialized: state.initialized,
        refreshData,
        uploadFile,
        renameFile,
        deleteFile,
        downloadFile,
        getPermissions,
        setPermissions,
        revokePermission,
    }), [
        getFilesForCatalog,
        state.syncing,
        state.initialized,
        refreshData,
        uploadFile,
        renameFile,
        deleteFile,
        downloadFile,
        getPermissions,
        setPermissions,
        revokePermission,
    ]);

    return (
        <PublicFilesContext.Provider value={value}>
            {children}
        </PublicFilesContext.Provider>
    );
}

export function usePublicFiles() {
    const ctx = useContext(PublicFilesContext);
    if (!ctx) throw new Error('usePublicFiles debe usarse dentro de PublicFilesProvider');
    return ctx;
}

export default PublicFilesContext;
