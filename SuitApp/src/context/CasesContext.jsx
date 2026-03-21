/* eslint-disable react-refresh/only-export-components */
import { syncCases } from '../services/sync/caseSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';

const { Context: CasesContext, Provider: CasesProvider, useResource: useCases } = createResourceContext({
    resourceName: 'Cases',
    syncFn: syncCases
});

export { CasesProvider, useCases };
export default CasesContext;
