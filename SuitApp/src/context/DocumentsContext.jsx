/* eslint-disable react-refresh/only-export-components */
import { syncDocuments } from '../services/sync/documentSyncService.js';
import { createResourceContext } from './createResourceContext.jsx';

const { Context: DocumentsContext, Provider: DocumentsProvider, useResource: useDocuments } = createResourceContext({
    resourceName: 'Documents',
    syncFn: syncDocuments
});

export { DocumentsProvider, useDocuments };
export default DocumentsContext;
