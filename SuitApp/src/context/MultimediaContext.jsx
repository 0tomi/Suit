/* eslint-disable react-refresh/only-export-components */
import { syncMultimedia } from '../services/sync/multimediaSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';

const { Context: MultimediaContext, Provider: MultimediaProvider, useResource: useMultimedia } = createResourceContext({
    resourceName: 'Multimedia',
    syncFn: syncMultimedia,
    autoRefreshOnMount: false,
});

export { MultimediaProvider, useMultimedia };
export default MultimediaContext;
