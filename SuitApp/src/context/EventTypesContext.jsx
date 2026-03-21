/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncEventTypes } from '../services/sync/metadataSyncService.js';

const { Context: EventTypesContext, Provider: EventTypesProvider, useResource: useEventTypesResource } = createResourceContext({
    resourceName: 'event_types',
    syncFn: syncEventTypes,
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
