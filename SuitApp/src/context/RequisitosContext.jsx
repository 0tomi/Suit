import { createResourceContext } from './createResourceContext.jsx';
import { ensureRequisitosSeeded } from '../services/sync/requisitosSyncService.js';
import { TIER_CATALOG } from '../services/sync/SyncScheduler.js';

/**
 * Contexto de Requisitos — estrategia seed-once.
 *
 * La tabla local se siembra la primera vez que la app arranca con la caché vacía.
 * A partir de ahí todas las lecturas van a SQLite, sin llamadas a la API.
 * La tabla se limpia en logout/clear-cache junto al resto de recursos.
 */
const {
    Context: RequisitosContext,
    Provider: RequisitosProvider,
    useResource: useRequisitosResource,
} = createResourceContext({
    resourceName: 'requisitos',
    syncFn: ensureRequisitosSeeded,
    autoRefreshOnMount: true,
});

/**
 * Hook para consumir los requisitos desde la caché.
 * Expone el array de requisitos y un helper para buscar por id.
 */
function useRequisitos() {
    const resource = useRequisitosResource();

    return {
        ...resource,
        /** Busca un requisito por id en el array ya cargado en memoria. */
        getRequisitoById: (id) => resource.requisitos?.find((r) => r.id === id) ?? null,
    };
}

export { RequisitosContext, RequisitosProvider, useRequisitos };
export default RequisitosContext;
