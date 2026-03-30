import { createResourceContext } from './createResourceContext';
import { syncCaseTypes } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: CaseTypesContext, Provider: CaseTypesProvider, useResource: useCaseTypesResource } = createResourceContext({
    resourceName: 'case_types',
    syncFn: syncCaseTypes,
    syncPriority: TIER_CATALOG,
});

function useCaseTypes() {
    const resource = useCaseTypesResource();

    return {
        ...resource,
        refreshCaseTypes: resource.refreshCaseTypes,
        loadLocalCaseTypes: resource.loadLocalData,
    };
}

export { CaseTypesContext, CaseTypesProvider, useCaseTypes };
