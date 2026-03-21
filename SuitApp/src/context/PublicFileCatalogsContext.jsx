/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext.jsx';
import { syncPublicFileCatalogs } from '../services/sync/publicFileCatalogSyncService.js';

const {
    Context: PublicFileCatalogsContext,
    Provider: PublicFileCatalogsProvider,
    useResource: usePublicFileCatalogsResource,
} = createResourceContext({
    resourceName: 'public_file_catalogs',
    syncFn: syncPublicFileCatalogs,
});

function usePublicFileCatalogs() {
    const resource = usePublicFileCatalogsResource();
    return {
        ...resource,
        refreshPublicFileCatalogs: resource.refreshPublicFileCatalogs,
        loadLocalPublicFileCatalogs: resource.loadLocalData,
    };
}

export { PublicFileCatalogsContext, PublicFileCatalogsProvider, usePublicFileCatalogs };
export default PublicFileCatalogsContext;
