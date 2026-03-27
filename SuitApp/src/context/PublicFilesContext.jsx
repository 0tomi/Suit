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
import { syncPublicFiles, buildPublicFileCacheRow, getLatestSyncedIds } from '../services/sync/publicFileSyncService.js';
import {
    uploadFile as apiUploadFile,
    updateFile as apiUpdateFile,
    deleteFile as apiDeleteFile,
    getMyPermissions as apiGetMyPermissions,
    getPermissions as apiGetPermissions,
    setPermissions as apiSetPermissions,
    revokePermission as apiRevokePermission,
    syncDown,
    getLastModified,
} from '../services/publicFileService.js';

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
        case 'REMOVE_FILE':
            return {
                ...state,
                allFiles: state.allFiles.filter((f) => String(f.id) !== String(action.payload)),
            };
        case 'MARK_FILE_AS_SEEN':
            return {
                ...state,
                allFiles: state.allFiles.map((f) =>
                    String(f.id) === String(action.payload) ? { ...f, is_new: false } : f
                ),
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

    /**
     * Decora un array de archivos con `is_owner_or_admin` calculado localmente.
     * El campo no se persiste en SQLite porque es inferible y cambia por sesión.
     */
    const decorateFiles = useCallback((files) => {
        const userId = user?.id ?? null;
        const isAdmin = user?.role === 'admin';
        return files.map((f) => ({
            ...f,
            is_owner_or_admin: isAdmin || String(f.user_id) === String(userId),
        }));
    }, [user?.id, user?.role]);

    /** Carga todos los archivos del cache SQLite local. */
    const loadLocalData = useCallback(async ({ epoch = authEpochRef.current } = {}) => {
        if (!window.electronAPI) return;
        try {
            const rows = await window.electronAPI.db.getAll(TABLE);
            void logger.warn('loadLocalData — rows from SQLite', { count: rows?.length ?? 0 });
            if (authEpochRef.current !== epoch) return;
            const parsed = parseJsonRows(rows);
            dispatch({ type: 'SET_ALL_FILES', payload: decorateFiles(parsed) });
        } catch (err) {
            void logger.error('loadLocalData failed', err);
        }
    }, [decorateFiles]);

    /**
     * Refresca los datos de la Biblioteca.
     *
     * Caso A — Cache vacío (primera vez o app limpia):
     *   1. Llama a syncDown inmediatamente y despacha los resultados al estado
     *      para que el usuario vea los archivos sin esperar la escritura a SQLite.
     *   2. Persiste en SQLite en background (sin bloquear el render).
     *
     * Caso B — Cache poblado:
     *   Usa el flujo normal de syncPublicFiles (check last-modified + incremental).
     */
    const refreshData = useCallback(async () => {
        const epochAtStart = authEpochRef.current;
        if (isSyncingRef.current) return;
        isSyncingRef.current = true;
        dispatch({ type: 'SET_SYNCING', payload: true });
        setSyncStatus('PublicFiles', true);
        try {
            const localRows = await window.electronAPI.db.getAll(TABLE);
            const cacheEmpty = !localRows || localRows.length === 0;

            if (cacheEmpty) {
                // Caso A: fetch directo → muestra inmediato → persiste en background
                const rawFiles = await syncDown('1970-01-01T00:00:00Z');
                if (authEpochRef.current !== epochAtStart) return;

                if (rawFiles.length > 0) {
                    // Marcar TODOS como nuevos en el primer fetch de la sesión si el cache estaba vacío
                    const markedFiles = rawFiles.map(f => ({ ...f, is_new: true }));
                    
                    // Despachar de inmediato para que el usuario vea los archivos
                    dispatch({ type: 'SET_ALL_FILES', payload: decorateFiles(markedFiles) });

                    // Persistir en background sin bloquear
                    const rows = rawFiles.filter(f => !f.deleted_at).map(buildPublicFileCacheRow);
                    ;(async () => {
                        try {
                            await window.electronAPI.db.clearTable(TABLE);
                            if (rows.length > 0) {
                                await window.electronAPI.db.upsertMany(TABLE, rows);
                            }
                            const ts = await getLastModified();
                            await window.electronAPI.sync.setMeta(
                                TABLE,
                                new Date().toISOString(),
                                ts || new Date().toISOString()
                            );
                        } catch (err) {
                            void logger.warn('background cache persist failed', err);
                        }
                    })();
                }
            } else {
                // Caso B: sync incremental normal
                const result = await syncPublicFiles();
                if (authEpochRef.current !== epochAtStart) return;

                if (result) {
                    // Si el sync devolvió true, hubo cambios o se completó con éxito.
                    // Obtenemos los IDs que el servicio guardó internamente.
                    const syncedIds = getLatestSyncedIds();
                    
                    if (syncedIds.size > 0) {
                        // Cargamos datos locales y aplicamos la marca
                        const rows = await window.electronAPI.db.getAll(TABLE);
                        const parsed = parseJsonRows(rows);
                        const decorated = decorateFiles(parsed).map(f => ({
                            ...f,
                            is_new: syncedIds.has(f.id)
                        }));
                        
                        dispatch({ type: 'SET_ALL_FILES', payload: decorated });
                    } else {
                        await loadLocalData({ epoch: epochAtStart });
                    }
                } else {
                    await loadLocalData({ epoch: epochAtStart });
                }
            }
        } catch (err) {
            void logger.warn('refreshData failed', err);
        } finally {
            isSyncingRef.current = false;
            if (authEpochRef.current === epochAtStart) {
                dispatch({ type: 'SET_SYNCING', payload: false });
                setSyncStatus('PublicFiles', false);
            }
        }
    }, [loadLocalData, setSyncStatus, decorateFiles]);

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
            // La API no devuelve user_id en el upload — lo inyectamos manualmente.
            // is_owner_or_admin lo calcula decorateFiles al recargar del cache.
            const file = { ...result.data.data, user_id: user?.id ?? null };
            const cacheRow = buildPublicFileCacheRow(file);
            await window.electronAPI.db.upsertMany(TABLE, [cacheRow]);
            await loadLocalData();
        }
        return result;
    }, [loadLocalData, user?.id]);

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
            // Actualizar SQLite y recargar desde cache para que is_owner se compute correctamente
            const existing = await window.electronAPI.db.getById(TABLE, id);
            if (existing) {
                await window.electronAPI.db.upsertMany(TABLE, [{ ...existing, ...changes }]);
            }
            await loadLocalData();
        }
        return result;
    }, [loadLocalData]);

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

    /** Consulta los permisos del usuario autenticado sobre un archivo. */
    const getMyPermissions = useCallback((fileId) => apiGetMyPermissions(fileId), []);

    /** Obtiene los permisos explícitos de un archivo (llamada directa a la API). */
    const getPermissions = useCallback((fileId) => apiGetPermissions(fileId), []);

    /** Otorga o actualiza permisos de un usuario sobre un archivo. */
    const setPermissions = useCallback((fileId, data) => apiSetPermissions(fileId, data), []);

    /** Revoca los permisos de un usuario sobre un archivo. */
    const revokePermission = useCallback((fileId, userId) => apiRevokePermission(fileId, userId), []);

    /** Marca un archivo como "visto" quitando el badge de nuevo (solo en memoria). */
    const markAsSeen = useCallback((fileId) => {
        dispatch({ type: 'MARK_FILE_AS_SEEN', payload: fileId });
    }, []);

    /** Genera un link firmado para descarga externa (QR). */
    const generateSignedLink = useCallback((fileId) => {
        return window.electronAPI.publicFiles.generateLink(fileId);
    }, []);

    const value = useMemo(() => ({
        allFiles: state.allFiles,
        syncing: state.syncing,
        initialized: state.initialized,
        refreshData,
        loadLocalData,
        getFilesForCatalog,
        uploadFile,
        renameFile,
        deleteFile,
        downloadFile,
        getMyPermissions,
        getPermissions,
        setPermissions,
        revokePermission,
        generateSignedLink,
        markAsSeen,
    }), [
        getFilesForCatalog,
        state.allFiles,
        state.syncing,
        state.initialized,
        refreshData,
        loadLocalData,
        uploadFile,
        renameFile,
        deleteFile,
        downloadFile,
        getMyPermissions,
        getPermissions,
        setPermissions,
        revokePermission,
        generateSignedLink,
        markAsSeen,
    ]);

    return (
        <PublicFilesContext.Provider value={value}>
            {children}
        </PublicFilesContext.Provider>
    );
}

const _noopPublicFiles = {
    allFiles: [],
    syncing: false,
    initialized: false,
    refreshData: async () => {},
    loadLocalData: async () => {},
    getFilesForCatalog: () => ({ data: [], total: 0, totalPages: 1, page: 1 }),
    uploadFile: async () => ({ ok: false }),
    renameFile: async () => ({ ok: false }),
    deleteFile: async () => ({ ok: false }),
    downloadFile: () => {},
    getMyPermissions: async () => null,
    getPermissions: async () => null,
    setPermissions: async () => {},
    revokePermission: async () => {},
    generateSignedLink: async () => null,
    markAsSeen: () => {},
};

export function usePublicFiles() {
    // Devuelve no-ops si se usa fuera del provider (ej: useProfileCacheResync desde Settings).
    return useContext(PublicFilesContext) ?? _noopPublicFiles;
}

export default PublicFilesContext;
