/* eslint-disable react-refresh/only-export-components */
import { syncClients } from '../services/sync/clientSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';

const { Context: ClientsContext, Provider: ClientsProvider, useResource: useClients } = createResourceContext({
    resourceName: 'Clients',
    syncFn: syncClients
});

export { ClientsProvider, useClients };
export default ClientsContext;
