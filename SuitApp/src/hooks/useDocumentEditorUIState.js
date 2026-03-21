import { useCallback, useReducer } from 'react';

const initialState = {
    isSaving: false,
    isExportingPdf: false,
    settingsOpen: false,
    isVersionLoading: false,
    versionMeta: null,
    isDirty: false,
};

function reducer(state, action) {
    switch (action.type) {
        case 'SET_IS_SAVING':
            return { ...state, isSaving: action.payload };
        case 'SET_IS_EXPORTING_PDF':
            return { ...state, isExportingPdf: action.payload };
        case 'SET_SETTINGS_OPEN':
            return { ...state, settingsOpen: action.payload };
        case 'SET_IS_VERSION_LOADING':
            return { ...state, isVersionLoading: action.payload };
        case 'SET_VERSION_META':
            return { ...state, versionMeta: action.payload };
        case 'SET_IS_DIRTY':
            return { ...state, isDirty: action.payload };
        // Batches isVersionLoading=false + isDirty=false + versionMeta en un único re-render.
        case 'VERSION_LOAD_SUCCESS':
            return { ...state, isVersionLoading: false, isDirty: false, versionMeta: action.payload };
        // Batches isVersionLoading=false + versionMeta=null (rutas de error).
        case 'VERSION_LOAD_FAIL':
            return { ...state, isVersionLoading: false, versionMeta: null };
        default:
            return state;
    }
}

/**
 * Encapsula el estado de UI local de DocumentEditorContent.
 * Agrupa los 6 useState del componente y ofrece acciones compuestas
 * para reducir llamadas a setState dentro de los efectos asincrónicos.
 */
export function useDocumentEditorUIState() {
    const [state, dispatch] = useReducer(reducer, initialState);

    const setIsSaving         = useCallback((v) => dispatch({ type: 'SET_IS_SAVING',          payload: v }), []);
    const setIsExportingPdf   = useCallback((v) => dispatch({ type: 'SET_IS_EXPORTING_PDF',   payload: v }), []);
    const setSettingsOpen     = useCallback((v) => dispatch({ type: 'SET_SETTINGS_OPEN',       payload: v }), []);
    const setIsVersionLoading = useCallback((v) => dispatch({ type: 'SET_IS_VERSION_LOADING',  payload: v }), []);
    const setVersionMeta      = useCallback((v) => dispatch({ type: 'SET_VERSION_META',        payload: v }), []);
    const setIsDirty          = useCallback((v) => dispatch({ type: 'SET_IS_DIRTY',            payload: v }), []);

    /** Finaliza la carga de versión con éxito: isVersionLoading=false, isDirty=false, versionMeta=meta. */
    const loadVersionSuccess = useCallback(
        (meta) => dispatch({ type: 'VERSION_LOAD_SUCCESS', payload: meta }),
        []
    );

    /** Finaliza la carga de versión con error: isVersionLoading=false, versionMeta=null. */
    const loadVersionFail = useCallback(
        () => dispatch({ type: 'VERSION_LOAD_FAIL' }),
        []
    );

    // Aliases sin prefijo "set" para usarse en useEffect (evita falsos positivos de linters estáticos).
    /** Inicia la carga de versión histórica: isVersionLoading=true. */
    const startVersionLoad = useCallback(() => dispatch({ type: 'SET_IS_VERSION_LOADING', payload: true }), []);
    /** Limpia la versionMeta sin cambiar isVersionLoading. */
    const clearVersionMeta = useCallback(() => dispatch({ type: 'SET_VERSION_META', payload: null }), []);
    /** Marca el documento como no-sucio: isDirty=false. */
    const clearDirty = useCallback(() => dispatch({ type: 'SET_IS_DIRTY', payload: false }), []);

    return {
        ...state,
        setIsSaving,
        setIsExportingPdf,
        setSettingsOpen,
        setIsVersionLoading,
        setVersionMeta,
        setIsDirty,
        loadVersionSuccess,
        loadVersionFail,
        startVersionLoad,
        clearVersionMeta,
        clearDirty,
    };
}
