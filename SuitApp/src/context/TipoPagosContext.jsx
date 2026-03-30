import { createResourceContext } from './createResourceContext';
import { syncTipoPagos } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: TipoPagosContext, Provider: TipoPagosProvider, useResource: useTipoPagosResource } = createResourceContext({
    resourceName: 'tipo_pagos',
    syncFn: syncTipoPagos,
    syncPriority: TIER_CATALOG,
});

function useTipoPagos() {
    const resource = useTipoPagosResource();

    return {
        ...resource,
        refreshTipoPagos: resource.refreshTipoPagos,
        loadLocalTipoPagos: resource.loadLocalData,
    };
}

export { TipoPagosContext, TipoPagosProvider, useTipoPagos };
