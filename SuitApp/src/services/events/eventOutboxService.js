import {
    buildEventCacheRow,
    buildEventOutboxRow,
    buildPendingEventRecord,
    createTemporaryEventId,
    EVENT_OUTBOX_STATUS,
    extractEventRecordFromCreateResponse,
    isOfflineLikeResult,
    normalizeEventRecord,
    parseEventOutboxRow,
} from '../eventMutationUtils.js';
import { normalizeStoredEvent } from './eventStateUtils.js';

function buildRemotePendingEvent(remoteEvent, status, error = null) {
    return normalizeEventRecord({
        ...remoteEvent,
        pending_sync: true,
        pending_sync_status: status,
        pending_sync_error: error,
        local_origin: 'outbox',
    }, {
        pendingSync: true,
        pendingStatus: status,
        pendingError: error,
        localOrigin: 'outbox',
    });
}

function buildOutboxErrorMessage(resultOrError, fallbackMessage) {
    return resultOrError?.error || resultOrError?.message || fallbackMessage;
}

function resolveFailureStatus(pendingStatus, resultOrError) {
    return isOfflineLikeResult(resultOrError)
        ? pendingStatus
        : EVENT_OUTBOX_STATUS.FAILED;
}

function shouldBreakDrainLoop(resultOrError) {
    return isOfflineLikeResult(resultOrError);
}

export function createEventOutboxService({
    db,
    eventStore,
    createRemoteEvent,
    applyNotificationIntent,
    runMonthPreflight,
}) {
    async function findOutboxEntryForEvent(eventId) {
        if (!db?.listEventOutbox) return null;
        const rows = await db.listEventOutbox();
        const match = rows.find((row) =>
            String(row.local_event_id) === String(eventId)
            || String(row.remote_event_id) === String(eventId)
        );
        return parseEventOutboxRow(match);
    }

    async function queueOfflineCreate({
        eventPayload,
        notificationIntent = null,
        error = 'No hay conexion con la API.',
    }) {
        const localEventId = createTemporaryEventId();
        const pendingEvent = buildPendingEventRecord(eventPayload, {
            localEventId,
            status: EVENT_OUTBOX_STATUS.PENDING_EVENT,
            error,
        });
        const outboxRow = buildEventOutboxRow({
            localEventId,
            eventPayload,
            notificationIntent,
            status: EVENT_OUTBOX_STATUS.PENDING_EVENT,
            lastError: error,
        });

        await db?.upsertPendingEventBundle?.({
            eventRow: buildEventCacheRow(pendingEvent),
            outboxRow,
        });
        await eventStore.upsert(pendingEvent, { persist: false });

        let notificationWarning = '';
        if (notificationIntent?.action && notificationIntent.action !== 'none') {
            const notificationResult = await applyNotificationIntent({
                eventId: localEventId,
                fallbackEventRecord: pendingEvent,
                notificationIntent,
                localOnly: true,
            });
            if (!notificationResult.ok) {
                notificationWarning = notificationResult.error || 'No se pudo guardar la notificacion local.';
            }
        }

        return {
            ok: true,
            event: pendingEvent,
            queued: true,
            offline: true,
            notificationWarning,
        };
    }

    async function requeuePendingCreate({
        eventId,
        eventPayload,
        notificationIntent = null,
        existingOutboxEntry = null,
    }) {
        const localEventId = Number(eventId);
        const nextNotificationIntent = notificationIntent
            || existingOutboxEntry?.notificationIntent
            || { action: 'none', minutes: null };
        const pendingEvent = buildPendingEventRecord(eventPayload, {
            localEventId,
            status: EVENT_OUTBOX_STATUS.PENDING_EVENT,
            error: null,
        });
        const outboxRow = buildEventOutboxRow({
            localEventId,
            eventPayload,
            notificationIntent: nextNotificationIntent,
            status: EVENT_OUTBOX_STATUS.PENDING_EVENT,
            retryCount: existingOutboxEntry?.retry_count || 0,
            lastError: null,
            createdAt: existingOutboxEntry?.created_at || null,
        });

        await db?.updatePendingEventBundle?.({
            eventRow: buildEventCacheRow(pendingEvent),
            outboxRow,
            clearNotifications: true,
        });
        await eventStore.upsert(pendingEvent, { persist: false });

        let notificationWarning = '';
        if (nextNotificationIntent.action && nextNotificationIntent.action !== 'none') {
            const notificationResult = await applyNotificationIntent({
                eventId: localEventId,
                fallbackEventRecord: pendingEvent,
                notificationIntent: nextNotificationIntent,
                localOnly: true,
            });
            if (!notificationResult.ok) {
                notificationWarning = notificationResult.error || 'No se pudo actualizar la notificacion local.';
            }
        }

        return {
            ok: true,
            event: pendingEvent,
            queued: true,
            offline: false,
            notificationWarning,
        };
    }

    async function queueRemoteNotificationSync({
        remoteEvent,
        notificationIntent,
        existingOutboxEntry = null,
        sourceEventId = null,
        error = null,
        retryCount = null,
    }) {
        const remoteEventId = Number(remoteEvent?.id ?? existingOutboxEntry?.remote_event_id ?? sourceEventId);
        const localEventId = Number(existingOutboxEntry?.local_event_id ?? sourceEventId ?? remoteEventId);
        const status = resolveFailureStatus(EVENT_OUTBOX_STATUS.PENDING_NOTIFICATION, { error });
        const safeError = error || null;
        const pendingEvent = buildRemotePendingEvent(remoteEvent, status, safeError);
        const outboxRow = buildEventOutboxRow({
            localEventId,
            remoteEventId,
            eventPayload: remoteEvent,
            notificationIntent,
            status,
            retryCount: retryCount ?? ((existingOutboxEntry?.retry_count || 0) + 1),
            lastError: safeError,
            createdAt: existingOutboxEntry?.created_at || null,
        });

        if (existingOutboxEntry && localEventId !== remoteEventId) {
            await eventStore.promote(localEventId, pendingEvent, {
                clearOutbox: false,
                outboxRow,
                persist: true,
            });
            return pendingEvent;
        }

        await db?.upsertEventOutbox?.(outboxRow);
        await eventStore.upsert(pendingEvent);
        return pendingEvent;
    }

    async function finalizeRemoteSync({
        remoteEvent,
        existingOutboxEntry = null,
        sourceEventId = null,
    }) {
        const normalizedRemoteEvent = normalizeStoredEvent(remoteEvent);
        const localEventId = Number(existingOutboxEntry?.local_event_id ?? sourceEventId ?? normalizedRemoteEvent.id);

        if (existingOutboxEntry && localEventId !== normalizedRemoteEvent.id) {
            return await eventStore.promote(localEventId, normalizedRemoteEvent, {
                clearOutbox: true,
                persist: true,
            });
        }

        if (existingOutboxEntry?.local_event_id != null) {
            await db?.deleteEventOutbox?.(existingOutboxEntry.local_event_id);
        }
        return await eventStore.upsert(normalizedRemoteEvent);
    }

    async function drainOutbox() {
        if (!db?.listEventOutbox) return [];

        const rawRows = await db.listEventOutbox();
        const rows = rawRows.map(parseEventOutboxRow).filter(Boolean);
        const processed = [];

        for (const row of rows) {
            if (row.status === EVENT_OUTBOX_STATUS.FAILED) continue;

            if (row.status === EVENT_OUTBOX_STATUS.PENDING_EVENT) {
                await runMonthPreflight({
                    date: row.eventPayload?.date,
                    agendaId: row.eventPayload?.agenda_id ?? null,
                });

                const createResult = await createRemoteEvent(row.eventPayload);
                if (!createResult.ok) {
                    const nextStatus = resolveFailureStatus(EVENT_OUTBOX_STATUS.PENDING_EVENT, createResult);
                    const pendingEvent = buildPendingEventRecord(row.eventPayload, {
                        localEventId: row.local_event_id,
                        status: nextStatus,
                        error: buildOutboxErrorMessage(createResult, 'No se pudo sincronizar el evento pendiente.'),
                    });
                    await db.updatePendingEventBundle({
                        eventRow: buildEventCacheRow(pendingEvent),
                        outboxRow: buildEventOutboxRow({
                            localEventId: row.local_event_id,
                            remoteEventId: row.remote_event_id,
                            eventPayload: row.eventPayload,
                            notificationIntent: row.notificationIntent,
                            status: nextStatus,
                            retryCount: (row.retry_count || 0) + 1,
                            lastError: buildOutboxErrorMessage(createResult, 'No se pudo sincronizar el evento pendiente.'),
                            createdAt: row.created_at,
                        }),
                    });
                    await eventStore.upsert(pendingEvent, { persist: false });
                    if (shouldBreakDrainLoop(createResult)) break;
                    continue;
                }

                const remoteEvent = extractEventRecordFromCreateResponse(createResult.data, row.eventPayload);
                if (!row.notificationIntent || row.notificationIntent.action === 'none') {
                    const syncedEvent = await finalizeRemoteSync({
                        remoteEvent,
                        existingOutboxEntry: row,
                        sourceEventId: row.local_event_id,
                    });
                    processed.push(syncedEvent.id);
                    continue;
                }

                const notificationResult = await applyNotificationIntent({
                    eventId: remoteEvent.id,
                    fallbackEventRecord: remoteEvent,
                    notificationIntent: row.notificationIntent,
                });

                if (!notificationResult.ok) {
                    const pendingEvent = await queueRemoteNotificationSync({
                        remoteEvent,
                        notificationIntent: row.notificationIntent,
                        existingOutboxEntry: row,
                        sourceEventId: row.local_event_id,
                        error: buildOutboxErrorMessage(notificationResult, 'No se pudo sincronizar la notificacion.'),
                        retryCount: (row.retry_count || 0) + 1,
                    });
                    if (pendingEvent.pending_sync_status === EVENT_OUTBOX_STATUS.PENDING_NOTIFICATION) {
                        break;
                    }
                    continue;
                }

                const syncedEvent = await finalizeRemoteSync({
                    remoteEvent,
                    existingOutboxEntry: row,
                    sourceEventId: row.local_event_id,
                });
                processed.push(syncedEvent.id);
                continue;
            }

            if (row.status === EVENT_OUTBOX_STATUS.PENDING_NOTIFICATION && row.remote_event_id) {
                const currentEvent = await eventStore.read(row.remote_event_id)
                    || normalizeStoredEvent({
                        ...row.eventPayload,
                        id: row.remote_event_id,
                    });

                if (!row.notificationIntent || row.notificationIntent.action === 'none') {
                    const syncedEvent = await finalizeRemoteSync({
                        remoteEvent: currentEvent,
                        existingOutboxEntry: row,
                        sourceEventId: row.local_event_id,
                    });
                    processed.push(syncedEvent.id);
                    continue;
                }

                const notificationResult = await applyNotificationIntent({
                    eventId: row.remote_event_id,
                    fallbackEventRecord: currentEvent,
                    notificationIntent: row.notificationIntent,
                });

                if (!notificationResult.ok) {
                    const pendingEvent = await queueRemoteNotificationSync({
                        remoteEvent: currentEvent,
                        notificationIntent: row.notificationIntent,
                        existingOutboxEntry: row,
                        sourceEventId: row.local_event_id,
                        error: buildOutboxErrorMessage(notificationResult, 'No se pudo sincronizar la notificacion.'),
                        retryCount: (row.retry_count || 0) + 1,
                    });
                    if (pendingEvent.pending_sync_status === EVENT_OUTBOX_STATUS.PENDING_NOTIFICATION) {
                        break;
                    }
                    continue;
                }

                const syncedEvent = await finalizeRemoteSync({
                    remoteEvent: currentEvent,
                    existingOutboxEntry: row,
                    sourceEventId: row.local_event_id,
                });
                processed.push(syncedEvent.id);
            }
        }

        return processed;
    }

    return {
        findOutboxEntryForEvent,
        queueOfflineCreate,
        requeuePendingCreate,
        queueRemoteNotificationSync,
        finalizeRemoteSync,
        drainOutbox,
    };
}
