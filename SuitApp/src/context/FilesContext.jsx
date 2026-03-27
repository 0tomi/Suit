/* eslint-disable react-refresh/only-export-components */
import { syncFiles } from '../services/sync/fileSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: FilesContext, Provider: FilesProvider, useResource: useFiles } = createResourceContext({
    resourceName: 'Files',
    syncFn: syncFiles,
    autoRefreshOnMount: false,
    syncPriority: TIER_CATALOG,
});

export { FilesProvider, useFiles };
export default FilesContext;
