/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncEventTypes } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: EventTypesContext, Provider: EventTypesProvider, useResource: useEventTypesResource } = createResourceContext({
    resourceName: 'event_types',
    syncFn: syncEventTypes,
    syncPriority: TIER_CATALOG,
});

function useEventTypes() {
    const resource = useEventTypesResource();

    return {
        ...resource,
        refreshEventTypes: resource.refreshEventTypes,
        loadLocalEventTypes: resource.loadLocalData,
    };
}

export { EventTypesContext, EventTypesProvider, useEventTypes };
