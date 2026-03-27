/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncDependenciasJudiciales } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: DependenciasJudicialesContext, Provider: DependenciasJudicialesProvider, useResource: useDependenciasJudicialesResource } = createResourceContext({
    resourceName: 'dependencias_judiciales',
    syncFn: syncDependenciasJudiciales,
    syncPriority: TIER_CATALOG,
});

function useDependenciasJudiciales() {
    const resource = useDependenciasJudicialesResource();

    return {
        ...resource,
        data: resource.dependencias_judiciales || [],
        refreshDependenciasJudiciales: resource.refreshDependenciasJudiciales,
        loadLocalDependenciasJudiciales: resource.loadLocalData,
    };
}

export { DependenciasJudicialesContext, DependenciasJudicialesProvider, useDependenciasJudiciales };
