/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncCompetencias } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: CompetenciasContext, Provider: CompetenciasProvider, useResource: useCompetenciasResource } = createResourceContext({
    resourceName: 'competencias',
    syncFn: syncCompetencias,
    syncPriority: TIER_CATALOG,
});

function useCompetencias() {
    const resource = useCompetenciasResource();

    return {
        ...resource,
        data: resource.competencias,
        refreshCompetencias: resource.refreshCompetencias,
        loadLocalCompetencias: resource.loadLocalData,
    };
}

export { CompetenciasContext, CompetenciasProvider, useCompetencias };
