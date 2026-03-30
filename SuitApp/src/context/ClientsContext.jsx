import { syncClients } from '../services/sync/clientSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';
import { TIER_CRITICAL } from '../services/sync/SyncScheduler.js';

const { Context: ClientsContext, Provider: ClientsProvider, useResource: useClients } = createResourceContext({
    resourceName: 'Clients',
    syncFn: syncClients,
    syncPriority: TIER_CRITICAL,
});

export { ClientsProvider, useClients };
export default ClientsContext;
