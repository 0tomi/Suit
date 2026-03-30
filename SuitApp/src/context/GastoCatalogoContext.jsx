import { createResourceContext } from './createResourceContext';
import { syncGastosCatalogo } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: GastoCatalogoContext, Provider: GastoCatalogoProvider, useResource: useGastoCatalogoResource } = createResourceContext({
    resourceName: 'gastos_catalogo',
    syncFn: syncGastosCatalogo,
    syncPriority: TIER_CATALOG,
});

function useGastoCatalogo() {
    const resource = useGastoCatalogoResource();

    return {
        ...resource,
        refreshGastosCatalogo: resource.refreshGastosCatalogo,
        loadLocalGastosCatalogo: resource.loadLocalData,
    };
}

export { GastoCatalogoContext, GastoCatalogoProvider, useGastoCatalogo };
