/* eslint-disable react-refresh/only-export-components */
import { createResourceContext } from './createResourceContext';
import { syncJurisdicciones } from '../services/sync/metadataSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

const { Context: JurisdiccionesContext, Provider: JurisdiccionesProvider, useResource: useJurisdiccionesResource } = createResourceContext({
    resourceName: 'jurisdicciones',
    syncFn: syncJurisdicciones,
    syncPriority: TIER_CATALOG,
});

function useJurisdicciones() {
    const resource = useJurisdiccionesResource();

    const sortedData = (resource.jurisdicciones || [])
        .sort((a, b) => (a.nombre || '').localeCompare(b.nombre || ''));

    return {
        ...resource,
        data: sortedData,
        refreshJurisdicciones: resource.refreshJurisdicciones,
        loadLocalJurisdicciones: resource.loadLocalData,
    };
}

export { JurisdiccionesContext, JurisdiccionesProvider, useJurisdicciones };
