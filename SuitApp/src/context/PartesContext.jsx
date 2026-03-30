import { createResourceContext } from './createResourceContext';
import { syncPartes } from '../services/sync/parteSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: PartesContext, Provider: PartesProvider, useResource: usePartesResource } = createResourceContext({
    resourceName: 'partes',
    syncFn: syncPartes,
    syncPriority: TIER_CATALOG,
});

/**
 * Hook para acceder al directorio global de Partes.
 * Las asociaciones parte↔caso se manejan desde el detalle del caso
 * usando parteService.getPartesByCaso / linkParteToCaso / unlinkParteFromCaso.
 */
function usePartes() {
    const resource = usePartesResource();

    return {
        ...resource,
        refreshPartes: resource.refreshPartes,
        loadLocalPartes: resource.loadLocalData,
    };
}

export { PartesContext, PartesProvider, usePartes };
