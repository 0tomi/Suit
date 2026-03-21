/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncTipoExpedientes } from '../services/sync/metadataSyncService.js';

const { Context: TipoExpedientesContext, Provider: TipoExpedientesProvider, useResource: useTipoExpedientesResource } = createResourceContext({
    resourceName: 'tipo_expedientes',
    syncFn: syncTipoExpedientes,
});

function useTipoExpedientes() {
    const resource = useTipoExpedientesResource();

    return {
        ...resource,
        refreshTipoExpedientes: resource.refreshTipoExpedientes,
        loadLocalTipoExpedientes: resource.loadLocalData,
    };
}

export { TipoExpedientesContext, TipoExpedientesProvider, useTipoExpedientes };
