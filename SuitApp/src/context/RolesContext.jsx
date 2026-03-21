/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncRoles } from '../services/sync/metadataSyncService.js';

const { Context: RolesContext, Provider: RolesProvider, useResource: useRolesResource } = createResourceContext({
    resourceName: 'roles',
    syncFn: syncRoles,
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
