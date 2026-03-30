import { createResourceContext } from './createResourceContext';
import { syncRadicaciones } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: RadicacionesContext, Provider: RadicacionesProvider, useResource: useRadicacionesResource } = createResourceContext({
    resourceName: 'radicaciones',
    syncFn: syncRadicaciones,
    syncPriority: TIER_CATALOG,
});

function useRadicaciones() {
    const resource = useRadicacionesResource();

    return {
        ...resource,
        data: resource.radicaciones,
        refreshRadicaciones: resource.refreshRadicaciones,
        loadLocalRadicaciones: resource.loadLocalData,
    };
}

export { RadicacionesContext, RadicacionesProvider, useRadicaciones };
