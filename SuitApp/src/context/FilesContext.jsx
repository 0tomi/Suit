/* eslint-disable react-refresh/only-export-components */
import { syncFiles } from '../services/sync/fileSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';

const { Context: FilesContext, Provider: FilesProvider, useResource: useFiles } = createResourceContext({
    resourceName: 'Files',
    syncFn: syncFiles,
    autoRefreshOnMount: false,
});

export { FilesProvider, useFiles };
export default FilesContext;
