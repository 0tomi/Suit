/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useState, useCallback, useMemo } from 'react';

const SyncStatusContext = createContext(null);

export const useSyncStatus = () => {
    const ctx = useContext(SyncStatusContext);
    if (!ctx) throw new Error('useSyncStatus debe usarse dentro de SyncStatusProvider');
    return ctx;
};

export const SyncStatusProvider = ({ children }) => {
    const [syncStatuses, setSyncStatuses] = useState({});

    const setSyncStatus = useCallback((resourceName, isSyncing) => {
        setSyncStatuses(prev => {
            if (prev[resourceName] === isSyncing) return prev;
            return { ...prev, [resourceName]: isSyncing };
        });
    }, []);

    const isAnySyncing = useMemo(() => {
        return Object.values(syncStatuses).some(Boolean);
    }, [syncStatuses]);

    const value = useMemo(() => ({
        isAnySyncing,
        setSyncStatus
    }), [isAnySyncing, setSyncStatus]);

    return (
        <SyncStatusContext.Provider value={value}>
            {children}
        </SyncStatusContext.Provider>
    );
};
