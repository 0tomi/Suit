/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncGastosCatalogo } from '../services/sync/metadataSyncService.js';

const { Context: GastoCatalogoContext, Provider: GastoCatalogoProvider, useResource: useGastoCatalogoResource } = createResourceContext({
    resourceName: 'gastos_catalogo',
    syncFn: syncGastosCatalogo,
});

function useGastoCatalogo() {
    const resource = useGastoCatalogoResource();

    return {
        ...resource,
        refreshGastosCatalogo: resource.refreshGastosCatalogo,
        loadLocalGastosCatalogo: resource.loadLocalData,
    };
}

export { GastoCatalogoContext, GastoCatalogoProvider, useGastoCatalogo };
