/* eslint-disable react-refresh/only-export-components */
import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useRef } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useApi } from './ApiContext.jsx';
import { useSyncStatus } from './SyncStatusContext.jsx';
import { syncAgendaEventsForView } from '../services/sync/agendaMonthSyncService.js';
import { syncAgendas } from '../services/sync/agendaSyncService.js';
import { syncAllNotifications } from '../services/eventNotificationService.js';
import { createEvent as createRemoteEvent, updateEvent as updateRemoteEvent } from '../services/eventService.js';
import { createNotification, deleteNotification } from '../services/eventNotificationService.js';
import { deleteEventAndSync } from '../services/sync/eventSyncService.js';
import { parseJsonRows } from '../utils/dbUtils.js';
import { startupMark, startupMarkCount } from '../utils/startupMetrics.js';
import {
    buildEventCacheRow,
} from '../services/eventMutationUtils.js';
import {
    eventsReducer,
    initialEventsState,
    normalizeStoredEvent,
    toPositiveInt,
} from '../services/events/eventStateUtils.js';
import { createEventOutboxService } from '../services/events/eventOutboxService.js';
import { createEventMutationService } from '../services/events/eventMutationService.js';
import { createLogger } from '../services/logService.js';
const logger = createLogger('context:events');

const EventsContext = createContext(null);

export const useEvents = () => {
    const ctx = useContext(EventsContext);
    if (!ctx) throw new Error('useEvents debe usarse dentro de EventsProvider');
    return ctx;
};

export const EventsProvider = ({ children }) => {
    const { user, authEpoch = 0 } = useAuth();
    const { connected } = useApi();
    const { setSyncStatus } = useSyncStatus();
    const [state, dispatch] = useReducer(eventsReducer, initialEventsState);
    const syncGenerationRef = useRef(0);
    const activeRefreshCountRef = useRef(0);
    const latestRefreshRequestRef = useRef(0);
    const authEpochRef = useRef(authEpoch);
    const drainInFlightRef = useRef(null);

    useEffect(() => {
        authEpochRef.current = authEpoch;
    }, [authEpoch]);

    const loadLocalData = useCallback(async ({ epoch = authEpochRef.current } = {}) => {
        startupMarkCount('events:load-local:start', 'events:load-local:calls');
        if (authEpochRef.current !== epoch) return { events: [], agendas: [] };
        if (!window.electronAPI) {
            if (authEpochRef.current !== epoch) return { events: [], agendas: [] };
            dispatch({ type: 'SET_DATA', payload: { events: [], agendas: [] } });
            startupMark('events:load-local:skip-no-electron');
            return { events: [], agendas: [] };
        }

        const eventRows = await window.electronAPI.db.getAll('events');
        if (authEpochRef.current !== epoch) return { events: [], agendas: [] };
        const ev = parseJsonRows(eventRows);

        const agendaRows = await window.electronAPI.db.getAll('agendas');
        if (authEpochRef.current !== epoch) return { events: [], agendas: [] };
        const ag = parseJsonRows(agendaRows);

        if (authEpochRef.current !== epoch) return { events: ev, agendas: ag };
        dispatch({ type: 'SET_DATA', payload: { events: ev, agendas: ag } });
        startupMark('events:load-local:done', {
            events: ev.length,
            agendas: ag.length,
        });
        return { events: ev, agendas: ag };
    }, []);

    const refreshEvents = useCallback(async ({
        date = new Date(),
        view = 'month',
        force = false,
        syncNotifications = false,
        agendaId = null,
        syncAgendaCatalog = true,
        persistMode = 'await',
        applyEventsInMemory = false,
        onFetchRequired = null,
    } = {}) => {
        const epochAtStart = authEpochRef.current;
        const requestId = ++latestRefreshRequestRef.current;
        const normalizedAgendaId = agendaId == null || agendaId === 'ALL' ? null : toPositiveInt(agendaId);
        const shouldApplyInMemory = Boolean(applyEventsInMemory && normalizedAgendaId);
        const shouldSkipLoadLocalData = persistMode === 'background' && shouldApplyInMemory;
        const isLatestRequest = () => (
            authEpochRef.current === epochAtStart
            && latestRefreshRequestRef.current === requestId
        );
        const onEventsFetched = shouldApplyInMemory
            ? ({ agendaId: fetchedAgendaId, year, month, events }) => {
                if (!isLatestRequest()) return;
                dispatch({
                    type: 'REPLACE_AGENDA_MONTH_EVENTS',
                    payload: {
                        agendaId: fetchedAgendaId,
                        year,
                        month,
                        events,
                    },
                });
            }
            : null;
        startupMarkCount('events:refresh:start', 'events:refresh:calls');
        activeRefreshCountRef.current += 1;
        if (activeRefreshCountRef.current === 1) {
            dispatch({ type: 'SET_SYNCING', payload: true });
            setSyncStatus('Events', true);
        }
        try {
            await syncAgendaEventsForView({
                date,
                view,
                force,
                agendaId: normalizedAgendaId,
                syncAgendaCatalog,
                onFetchRequired,
                onEventsFetched,
                persistMode,
            });

            if (!isLatestRequest()) {
                startupMark('events:refresh:skip-stale', { requestId });
                return;
            }
            if (!shouldSkipLoadLocalData) {
                await loadLocalData({ epoch: epochAtStart });
            }
            if (!isLatestRequest()) return;
            if (syncNotifications) {
                await syncAllNotifications();
            }
            startupMark('events:refresh:done');
        } catch (err) {
            // Puede ser init/background sync con servidor no disponible: fallo transitorio
            void logger.warn('EventsContext error', err);
            startupMark('events:refresh:error', { message: err?.message || String(err) });
        } finally {
            activeRefreshCountRef.current = Math.max(0, activeRefreshCountRef.current - 1);
            if (activeRefreshCountRef.current === 0) {
                dispatch({ type: 'SET_SYNCING', payload: false });
                setSyncStatus('Events', false);
            }
        }
    }, [loadLocalData, setSyncStatus]);

    const upsertEventRecord = useCallback(async (rawEvent, { persist = true } = {}) => {
        const normalized = normalizeStoredEvent(rawEvent);

        if (persist && window.electronAPI?.db?.upsertMany) {
            await window.electronAPI.db.upsertMany('events', [buildEventCacheRow(normalized)]);
        }

        dispatch({ type: 'UPSERT_EVENT', payload: normalized });
        return normalized;
    }, []);

    const promotePendingEventRecord = useCallback(async (localEventId, rawEvent, {
        clearOutbox = false,
        outboxRow = null,
        persist = true,
    } = {}) => {
        const normalized = normalizeStoredEvent(rawEvent);

        if (persist && window.electronAPI?.db?.promotePendingEvent) {
            await window.electronAPI.db.promotePendingEvent(
                localEventId,
                buildEventCacheRow(normalized),
                {
                    clearOutbox,
                    outboxRow,
                },
            );
        }

        if (Number(localEventId) === Number(normalized.id)) {
            dispatch({ type: 'UPSERT_EVENT', payload: normalized });
        } else {
            dispatch({
                type: 'REPLACE_EVENT_ID',
                payload: {
                    tempId: localEventId,
                    event: normalized,
                },
            });
        }

        return normalized;
    }, []);

    const removeEventRecord = useCallback(async (eventId, { persist = true } = {}) => {
        if (persist && window.electronAPI?.db?.deleteById && Number(eventId) > 0) {
            await window.electronAPI.db.deleteById('events', Number(eventId));
        }
        dispatch({ type: 'REMOVE_EVENT', payload: eventId });
    }, []);

    const readEventRecord = useCallback(async (eventId) => {
        if (!window.electronAPI?.db?.getById || eventId == null) return null;

        const row = await window.electronAPI.db.getById('events', Number(eventId));
        if (!row) return null;

        if (row.data_json) {
            try {
                return normalizeStoredEvent(JSON.parse(row.data_json));
            } catch (err) {
                void logger.warn('no se pudo parsear el evento cacheado', {
                    eventId,
                    message: err?.message || String(err),
                });
            }
        }

        return normalizeStoredEvent(row);
    }, []);

    const runMonthPreflight = useCallback(async ({ date, agendaId }) => {
        await refreshEvents({
            date,
            view: 'month',
            force: false,
            syncNotifications: false,
            agendaId: agendaId ?? null,
            syncAgendaCatalog: false,
            persistMode: 'await',
            applyEventsInMemory: true,
        });
    }, [refreshEvents]);

    const applyNotificationIntent = useCallback(async ({
        eventId,
        fallbackEventRecord,
        notificationIntent,
        localOnly = false,
    }) => {
        if (!notificationIntent || notificationIntent.action === 'none') {
            return { ok: true, data: null };
        }

        if (notificationIntent.action === 'delete') {
            return await deleteNotification(eventId, localOnly ? { localOnly: true } : {});
        }

        return await createNotification(
            eventId,
            notificationIntent.minutes,
            fallbackEventRecord,
            localOnly ? { localOnly: true } : {},
        );
    }, []);

    const eventStore = useMemo(() => ({
        upsert: upsertEventRecord,
        promote: promotePendingEventRecord,
        remove: removeEventRecord,
        read: readEventRecord,
    }), [promotePendingEventRecord, readEventRecord, removeEventRecord, upsertEventRecord]);

    const outboxService = useMemo(() => createEventOutboxService({
        db: window.electronAPI?.db ?? null,
        eventStore,
        createRemoteEvent,
        applyNotificationIntent,
        runMonthPreflight,
    }), [applyNotificationIntent, eventStore, runMonthPreflight]);

    const mutationService = useMemo(() => createEventMutationService({
        createRemoteEvent,
        updateRemoteEvent,
        deleteEventAndSync,
        deleteNotification,
        applyNotificationIntent,
        runMonthPreflight,
        eventStore,
        outboxService,
    }), [applyNotificationIntent, eventStore, outboxService, runMonthPreflight]);

    const createEventEntry = useCallback(async (payload) => {
        return await mutationService.createEventEntry(payload);
    }, [mutationService]);

    const updateEventEntry = useCallback(async (payload) => {
        return await mutationService.updateEventEntry(payload);
    }, [mutationService]);

    const deleteEventEntry = useCallback(async (payload) => {
        return await mutationService.deleteEventEntry(payload);
    }, [mutationService]);

    const drainEventOutbox = useCallback(async () => {
        if (!window.electronAPI?.db?.listEventOutbox) return [];
        if (drainInFlightRef.current) return await drainInFlightRef.current;

        const task = outboxService.drainOutbox().finally(() => {
            drainInFlightRef.current = null;
        });

        drainInFlightRef.current = task;
        return await task;
    }, [outboxService]);

    useEffect(() => {
        if (!user) {
            syncGenerationRef.current += 1;
            activeRefreshCountRef.current = 0;
            latestRefreshRequestRef.current += 1;
            dispatch({ type: 'RESET_DATA' });
            startupMark('events:init:reset-no-user');
            return;
        }
        const generation = ++syncGenerationRef.current;
        const epochAtStart = authEpochRef.current;
        startupMark('events:init:start', { generation, userId: user.id });

        const init = async () => {
            const localData = await loadLocalData({ epoch: epochAtStart });
            if (authEpochRef.current !== epochAtStart) return;
            if (syncGenerationRef.current !== generation) return;

            if ((localData?.agendas?.length || 0) === 0) {
                await syncAgendas();
                if (authEpochRef.current !== epochAtStart) return;
                await loadLocalData({ epoch: epochAtStart });
                if (authEpochRef.current !== epochAtStart) return;
                if (syncGenerationRef.current !== generation) return;
            }

            dispatch({ type: 'SET_INITIALIZED', payload: true });
            startupMark('events:init:initialized', { generation });
        };

        init();
    }, [authEpoch, loadLocalData, user]);

    useEffect(() => {
        if (!user || !connected) return;
        void drainEventOutbox();
    }, [connected, drainEventOutbox, user]);

    const value = useMemo(() => ({
        events: state.events,
        agendas: state.agendas,
        syncing: state.syncing,
        initialized: state.initialized,
        refreshEvents,
        loadLocalData,
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
        upsertEventRecord,
        removeEventRecord,
        drainEventOutbox,
    }), [
        state.events,
        state.agendas,
        state.syncing,
        state.initialized,
        refreshEvents,
        loadLocalData,
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
        upsertEventRecord,
        removeEventRecord,
        drainEventOutbox,
    ]);

    return (
        <EventsContext.Provider value={value}>
            {children}
        </EventsContext.Provider>
    );
};

export default EventsContext;
