/**
 * PublicFilesContext.jsx — Fachada liviana de Biblioteca.
 *
 * El renderer ya no cachea ni sincroniza `public_files` localmente.
 * Este contexto solo expone acciones que delegan en Electron IPC.
 */
import { createContext, useContext, useMemo } from 'react';
import {
    uploadFile,
    updateFile,
    deleteFile,
    getMyPermissions,
    getPermissions,
    setPermissions,
    revokePermission,
    generateLink,
} from '../services/publicFileService.js';

const PublicFilesContext = createContext(null);

export function PublicFilesProvider({ children }) {
    const value = useMemo(() => ({
        allFiles: [],
        syncing: false,
        initialized: true,
        refreshData: async () => {},
        loadLocalData: async () => [],
        getFilesForCatalog: () => ({ data: [], total: 0, totalPages: 1, page: 1 }),
        uploadFile,
        renameFile: updateFile,
        deleteFile,
        downloadFile: (fileId, suggestedName) => window.electronAPI.publicFiles.download(fileId, suggestedName),
        getMyPermissions,
        getPermissions,
        setPermissions,
        revokePermission,
        generateSignedLink: generateLink,
        markAsSeen: () => {},
    }), []);

    return (
        <PublicFilesContext.Provider value={value}>
            {children}
        </PublicFilesContext.Provider>
    );
}

const _noopPublicFiles = {
    allFiles: [],
    syncing: false,
    initialized: true,
    refreshData: async () => {},
    loadLocalData: async () => [],
    getFilesForCatalog: () => ({ data: [], total: 0, totalPages: 1, page: 1 }),
    uploadFile: async () => ({ ok: false }),
    renameFile: async () => ({ ok: false }),
    deleteFile: async () => ({ ok: false }),
    downloadFile: async () => ({ saved: false }),
    getMyPermissions: async () => ({ ok: false }),
    getPermissions: async () => ({ ok: false }),
    setPermissions: async () => ({ ok: false }),
    revokePermission: async () => ({ ok: false }),
    generateSignedLink: async () => null,
    markAsSeen: () => {},
};

export function usePublicFiles() {
    return useContext(PublicFilesContext) ?? _noopPublicFiles;
}

export default PublicFilesContext;
