/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncCaseTypes } from '../services/sync/metadataSyncService.js';

const { Context: CaseTypesContext, Provider: CaseTypesProvider, useResource: useCaseTypesResource } = createResourceContext({
    resourceName: 'case_types',
    syncFn: syncCaseTypes,
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
