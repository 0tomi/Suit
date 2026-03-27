/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncRoles } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: RolesContext, Provider: RolesProvider, useResource: useRolesResource } = createResourceContext({
    resourceName: 'roles',
    syncFn: syncRoles,
    syncPriority: TIER_CATALOG,
});

function useRoles() {
    const resource = useRolesResource();

    return {
        ...resource,
        refreshRoles: resource.refreshRoles,
        loadLocalRoles: resource.loadLocalData,
    };
}

export { RolesContext, RolesProvider, useRoles };
