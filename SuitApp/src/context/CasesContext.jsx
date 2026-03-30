import { syncCases } from '../services/sync/caseSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';
import { TIER_CRITICAL } from '../services/sync/SyncScheduler.js';

const { Context: CasesContext, Provider: CasesProvider, useResource: useCases } = createResourceContext({
    resourceName: 'Cases',
    syncFn: syncCases,
    syncPriority: TIER_CRITICAL,
});

export { CasesProvider, useCases };
export default CasesContext;
