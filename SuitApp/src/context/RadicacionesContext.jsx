/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncRadicaciones } from '../services/sync/metadataSyncService.js';

const { Context: RadicacionesContext, Provider: RadicacionesProvider, useResource: useRadicacionesResource } = createResourceContext({
    resourceName: 'radicaciones',
    syncFn: syncRadicaciones,
});

function useRadicaciones() {
    const resource = useRadicacionesResource();

    return {
        ...resource,
        refreshRadicaciones: resource.refreshRadicaciones,
        loadLocalRadicaciones: resource.loadLocalData,
    };
}

export { RadicacionesContext, RadicacionesProvider, useRadicaciones };
