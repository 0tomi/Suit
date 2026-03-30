import { syncMultimedia } from '../services/sync/multimediaSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: MultimediaContext, Provider: MultimediaProvider, useResource: useMultimedia } = createResourceContext({
    resourceName: 'Multimedia',
    syncFn: syncMultimedia,
    autoRefreshOnMount: false,
    syncPriority: TIER_CATALOG,
});

export { MultimediaProvider, useMultimedia };
export default MultimediaContext;
