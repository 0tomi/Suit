import { createContext, useContext, useState, useCallback, useMemo, useRef } from 'react';

const SyncStatusContext = createContext(null);

export const useSyncStatus = () => {
    const ctx = useContext(SyncStatusContext);
    if (!ctx) throw new Error('useSyncStatus debe usarse dentro de SyncStatusProvider');
    return ctx;
};

export const SyncStatusProvider = ({ children }) => {
    // El mapa de estados por recurso vive en un ref, no en state.
    // Esto evita que cada setSyncStatus individual (hasta 42 por ciclo de login)
    // cause un re-render del Provider y propague cambios por los 25 contextos hijos.
    // Solo se dispara un setState cuando el boolean agregado cambia (false→true o true→false),
    // lo que limita los re-renders reales a exactamente 2 por ciclo de sync completo.
    const statusesRef = useRef({});
    const [isAnySyncing, setIsAnySyncing] = useState(false);

    const setSyncStatus = useCallback((resourceName, isSyncing) => {
        const prev = statusesRef.current;
        if (prev[resourceName] === isSyncing) return;
        statusesRef.current = { ...prev, [resourceName]: isSyncing };
        const newVal = Object.values(statusesRef.current).some(Boolean);
        // Usar updater funcional para evitar cierre sobre valor desactualizado
        setIsAnySyncing(curr => (curr === newVal ? curr : newVal));
    }, []);

    const value = useMemo(() => ({
        isAnySyncing,
        setSyncStatus,
    }), [isAnySyncing, setSyncStatus]);

    return (
        <SyncStatusContext.Provider value={value}>
            {children}
        </SyncStatusContext.Provider>
    );
};
