/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncTipoPagos } from '../services/sync/metadataSyncService.js';

const { Context: TipoPagosContext, Provider: TipoPagosProvider, useResource: useTipoPagosResource } = createResourceContext({
    resourceName: 'tipo_pagos',
    syncFn: syncTipoPagos,
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
