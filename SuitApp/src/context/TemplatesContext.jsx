/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext.jsx';
import { syncTemplates } from '../services/sync/templateSyncService.js';

const { Context: TemplatesContext, Provider: TemplatesProvider, useResource: useTemplatesResource } = createResourceContext({
    resourceName: 'templates',
    syncFn: syncTemplates,
});

function useTemplates() {
    const resource = useTemplatesResource();

    return {
        ...resource,
        refreshTemplates: resource.refreshTemplates,
        loadLocalTemplates: resource.loadLocalData,
    };
}

export { TemplatesContext, TemplatesProvider, useTemplates };
export default TemplatesContext;
