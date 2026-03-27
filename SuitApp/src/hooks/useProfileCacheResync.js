import { useCallback, useEffect, useMemo, useState } from 'react';
import { clearApiRequestState } from '../services/api.js';
import { useApi } from '../context/ApiContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import { useSettings } from '../context/SettingsContext.jsx';
import { useSyncStatus } from '../context/SyncStatusContext.jsx';
import { useCases } from '../context/CasesContext.jsx';
import { useClients } from '../context/ClientsContext.jsx';
import { useDocuments } from '../context/DocumentsContext.jsx';
import { useUsers } from '../context/UsersContext.jsx';
import { useTemplateCategories } from '../context/TemplateCategoriesContext.jsx';
import { useTemplates } from '../context/TemplatesContext.jsx';
import { useCaseTypes } from '../context/CaseTypesContext.jsx';
import { useEventTypes } from '../context/EventTypesContext.jsx';
import { useEvents } from '../context/EventsContext.jsx';
import { useDeadlines } from '../context/DeadlinesContext.jsx';
import { usePublicFiles } from '../context/PublicFilesContext.jsx';
import { usePublicFileCatalogs } from '../context/PublicFileCatalogsContext.jsx';
import { syncCases } from '../services/sync/caseSyncService.js';
import { syncClients } from '../services/sync/clientSyncService.js';
import { syncDocuments } from '../services/sync/documentSyncService.js';
import { syncUsers } from '../services/sync/userSyncService.js';
import { syncTemplateCategories, syncTemplates } from '../services/sync/templateSyncService.js';
import { syncCaseTypes, syncEventTypes } from '../services/sync/metadataSyncService.js';
import { syncAgendas } from '../services/sync/agendaSyncService.js';
import { syncPublicFiles } from '../services/sync/publicFileSyncService.js';
import { syncPublicFileCatalogs } from '../services/sync/publicFileCatalogSyncService.js';
import { resetSyncInFlightState } from '../services/sync/syncCore.js';
import {
    ALL_AGENDAS_VIEW,
    normalizeDefaultAgendaView,
} from '../utils/agenda/defaultAgendaView.js';
import {
    resetAgendaMonthSyncInFlightState,
    syncAgendaEventsForView,
} from '../services/sync/agendaMonthSyncService.js';
import { resetNotificationSyncInFlightState } from '../services/eventNotificationService.js';

/**
 * Lee la cola local de cambios pendientes para advertir al usuario antes del reset.
 */
async function countPendingUploads() {
    const rows = await window.electronAPI?.db?.listEventOutbox?.();
    return Array.isArray(rows) ? rows.length : 0;
}

/**
 * Convierte resultados de sync a una lista uniforme de recursos fallidos.
 */
function collectFailedResources(results = []) {
    return results
        .filter((entry) => entry.ok === false)
        .map((entry) => entry.resource);
}

export function useProfileCacheResync() {
    const { connected } = useApi();
    const { user } = useAuth();
    const { defaultAgendaView } = useSettings();
    const { isAnySyncing } = useSyncStatus();
    const { loadLocalData: loadLocalCases } = useCases();
    const { loadLocalData: loadLocalClients } = useClients();
    const { loadLocalData: loadLocalDocuments } = useDocuments();
    const { loadLocalData: loadLocalUsers } = useUsers();
    const { loadLocalTemplateCategories } = useTemplateCategories();
    const { loadLocalTemplates } = useTemplates();
    const { loadLocalCaseTypes } = useCaseTypes();
    const { loadLocalEventTypes } = useEventTypes();
    const { loadLocalData: loadLocalEvents } = useEvents();
    const { bootstrapDeadlines } = useDeadlines();
    const { loadLocalData: loadLocalPublicFiles } = usePublicFiles();
    const { loadLocalData: loadLocalPublicFileCatalogs } = usePublicFileCatalogs();
    const [pendingUploadsCount, setPendingUploadsCount] = useState(0);
    const [resyncing, setResyncing] = useState(false);

    const refreshPendingUploads = useCallback(async () => {
        if (!window.electronAPI?.db?.listEventOutbox || !user) {
            setPendingUploadsCount(0);
            return 0;
        }

        try {
            const count = await countPendingUploads();
            setPendingUploadsCount(count);
            return count;
        } catch {
            setPendingUploadsCount(0);
            return 0;
        }
    }, [user]);

    useEffect(() => {
        void refreshPendingUploads();
    }, [refreshPendingUploads]);

    const disabled = useMemo(() => (
        !connected
        || !user
        || !window.electronAPI?.db?.clearActiveProfileCache
        || resyncing
        || isAnySyncing
    ), [connected, isAnySyncing, resyncing, user]);

    /**
     * Reejecuta el bootstrap del perfil activo después de vaciar su caché SQLite.
     */
    const runResync = useCallback(async () => {
        if (disabled) {
            throw new Error('La resincronización no está disponible en este momento.');
        }

        setResyncing(true);

        try {
            clearApiRequestState();
            resetSyncInFlightState();
            resetAgendaMonthSyncInFlightState();
            resetNotificationSyncInFlightState();

            await window.electronAPI.notifications?.clearStateForCurrentUser?.();
            await window.electronAPI.db.clearActiveProfileCache();

            const syncResults = await Promise.allSettled([
                syncCases().then((changed) => ({ resource: 'cases', ok: true, changed })),
                syncClients().then((changed) => ({ resource: 'clients', ok: true, changed })),
                syncDocuments().then((changed) => ({ resource: 'documents', ok: true, changed })),
                syncUsers().then((changed) => ({ resource: 'users', ok: true, changed })),
                syncTemplateCategories().then((changed) => ({ resource: 'template_categories', ok: true, changed })),
                syncTemplates().then((changed) => ({ resource: 'templates', ok: true, changed })),
                syncCaseTypes().then((changed) => ({ resource: 'case_types', ok: true, changed })),
                syncEventTypes().then((changed) => ({ resource: 'event_types', ok: true, changed })),
                syncAgendas().then((changed) => ({ resource: 'agendas', ok: true, changed })),
                syncPublicFileCatalogs().then((changed) => ({ resource: 'public_file_catalogs', ok: true, changed })),
                syncPublicFiles().then((changed) => ({ resource: 'public_files', ok: true, changed })),
            ]);

            const normalizedSyncResults = syncResults.map((result, index) => {
                if (result.status === 'fulfilled') {
                    return result.value;
                }

                const resourceOrder = [
                    'cases',
                    'clients',
                    'documents',
                    'users',
                    'template_categories',
                    'templates',
                    'case_types',
                    'event_types',
                    'agendas',
                    'public_file_catalogs',
                    'public_files',
                ];

                return {
                    resource: resourceOrder[index],
                    ok: false,
                    changed: false,
                };
            });

            const normalizedAgendaView = normalizeDefaultAgendaView(defaultAgendaView);
            const cachedAgendas = await window.electronAPI.db.getAll('agendas');
            const resolvedAgendaId = normalizedAgendaView !== ALL_AGENDAS_VIEW
                && cachedAgendas.some((row) => String(row.id) === normalizedAgendaView)
                ? normalizedAgendaView
                : null;

            const [eventsChanged, deadlinesChanged] = await Promise.all([
                syncAgendaEventsForView({
                    date: new Date(),
                    view: 'month',
                    force: true,
                    agendaId: resolvedAgendaId,
                    syncAgendaCatalog: false,
                    persistMode: 'await',
                }),
                bootstrapDeadlines(),
            ]);

            await Promise.all([
                loadLocalCases(),
                loadLocalClients(),
                loadLocalDocuments(),
                loadLocalUsers(),
                loadLocalTemplateCategories(),
                loadLocalTemplates(),
                loadLocalCaseTypes(),
                loadLocalEventTypes(),
                loadLocalEvents(),
                loadLocalPublicFileCatalogs(),
                loadLocalPublicFiles(),
            ]);

            await window.electronAPI.notifications?.loadTodayFromApi?.();
            await refreshPendingUploads();

            const failedResources = collectFailedResources([
                ...normalizedSyncResults,
                { resource: 'events', ok: true, changed: eventsChanged },
                { resource: 'deadlines', ok: true, changed: deadlinesChanged },
            ]);

            if (failedResources.length > 0) {
                throw new Error(`No se pudo completar la resincronización de: ${failedResources.join(', ')}.`);
            }
        } finally {
            setResyncing(false);
        }
    }, [
        bootstrapDeadlines,
        defaultAgendaView,
        disabled,
        loadLocalCaseTypes,
        loadLocalCases,
        loadLocalClients,
        loadLocalDocuments,
        loadLocalEventTypes,
        loadLocalEvents,
        loadLocalPublicFileCatalogs,
        loadLocalPublicFiles,
        loadLocalTemplateCategories,
        loadLocalTemplates,
        loadLocalUsers,
        refreshPendingUploads,
    ]);

    return {
        pendingUploadsCount,
        resyncing,
        disabled,
        runResync,
    };
}

export default useProfileCacheResync;
