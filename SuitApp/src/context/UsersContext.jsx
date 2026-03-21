/* eslint-disable react-refresh/only-export-components */
import { syncUsers } from '../services/sync/userSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';

const { Context: UsersContext, Provider: UsersProvider, useResource: useUsers } = createResourceContext({
    resourceName: 'Users',
    syncFn: syncUsers,
    parseRows: (rows) => rows
});

export { UsersProvider, useUsers };
export default UsersContext;
