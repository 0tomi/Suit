/* eslint-disable react-refresh/only-export-components */
import { useContext } from 'react';
import { createResourceContext } from './createResourceContext.jsx';
import { syncPublicFileCatalogs } from '../services/sync/publicFileCatalogSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const {
    Context: PublicFileCatalogsContext,
    Provider: PublicFileCatalogsProvider,
} = createResourceContext({
    resourceName: 'public_file_catalogs',
    syncFn: syncPublicFileCatalogs,
    syncPriority: TIER_CATALOG,
});

const _noopPublicFileCatalogs = {
    public_file_catalogs: [],
    syncing: false,
    initialized: false,
    refreshData: async () => {},
    refreshPublicFileCatalogs: async () => {},
    loadLocalData: async () => {},
    loadLocalPublicFileCatalogs: async () => {},
    updateItem: () => {},
    removeItem: () => {},
};

function usePublicFileCatalogs() {
    const ctx = useContext(PublicFileCatalogsContext);
    // Devuelve no-ops si se usa fuera del provider (ej: useProfileCacheResync desde Settings).
    if (!ctx) return _noopPublicFileCatalogs;
    return {
        ...ctx,
        refreshPublicFileCatalogs: ctx.refreshData,
        loadLocalPublicFileCatalogs: ctx.loadLocalData,
    };
}

export { PublicFileCatalogsContext, PublicFileCatalogsProvider, usePublicFileCatalogs };
export default PublicFileCatalogsContext;
