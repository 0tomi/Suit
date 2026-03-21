import {
    buildNotificationIntent,
    extractEventRecordFromCreateResponse,
    isOfflineLikeResult,
} from '../eventMutationUtils.js';

function buildMutationResult({
    ok = true,
    event = null,
    queued = false,
    offline = false,
    notificationWarning = '',
    error = null,
} = {}) {
    return {
        ok,
        event,
        queued,
        offline,
        notificationWarning,
        error,
    };
}

function isLocalPendingOutbox(entry) {
    return Boolean(entry && Number(entry.local_event_id) < 0 && !Number(entry.remote_event_id));
}

export function createEventMutationService({
    createRemoteEvent,
    updateRemoteEvent,
    deleteEventAndSync,
    deleteNotification,
    applyNotificationIntent,
    runMonthPreflight,
    eventStore,
    outboxService,
}) {
    async function syncRemoteEventAndNotification({
        sourceEventId,
        remoteEvent,
        notificationIntent = null,
        existingOutboxEntry = null,
    }) {
        const safeNotificationIntent = notificationIntent || buildNotificationIntent(null);

        if (!safeNotificationIntent.action || safeNotificationIntent.action === 'none') {
            const syncedEvent = existingOutboxEntry
                ? await outboxService.finalizeRemoteSync({
                    remoteEvent,
                    existingOutboxEntry,
                    sourceEventId,
                })
                : await eventStore.upsert(remoteEvent);

            return buildMutationResult({
                event: syncedEvent,
            });
        }

        const notificationResult = await applyNotificationIntent({
            eventId: remoteEvent.id,
            fallbackEventRecord: remoteEvent,
            notificationIntent: safeNotificationIntent,
        });

        if (!notificationResult.ok) {
            const queuedEvent = await outboxService.queueRemoteNotificationSync({
                remoteEvent,
                notificationIntent: safeNotificationIntent,
                existingOutboxEntry,
                sourceEventId,
                error: notificationResult.error || 'No se pudo sincronizar la notificacion.',
                retryCount: existingOutboxEntry ? (existingOutboxEntry.retry_count || 0) + 1 : 1,
            });

            return buildMutationResult({
                event: queuedEvent,
                queued: true,
                offline: isOfflineLikeResult(notificationResult),
                notificationWarning: notificationResult.error || 'No se pudo sincronizar la notificacion.',
            });
        }

        const syncedEvent = existingOutboxEntry
            ? await outboxService.finalizeRemoteSync({
                remoteEvent,
                existingOutboxEntry,
                sourceEventId,
            })
            : await eventStore.upsert(remoteEvent);

        return buildMutationResult({
            event: syncedEvent,
        });
    }

    async function createEventEntry({
        eventPayload,
        notificationIntent = null,
        syncAgendaId = null,
    }) {
        await runMonthPreflight({
            date: eventPayload?.starts_at,
            agendaId: syncAgendaId ?? eventPayload?.agenda_id ?? null,
        });

        const result = await createRemoteEvent(eventPayload);
        if (!result.ok) {
            if (!isOfflineLikeResult(result)) {
                return buildMutationResult({
                    ok: false,
                    error: result.error || 'No se pudo crear el evento.',
                });
            }

            return await outboxService.queueOfflineCreate({
                eventPayload,
                notificationIntent,
                error: result.error || 'No hay conexion con la API.',
            });
        }

        const remoteEvent = extractEventRecordFromCreateResponse(result.data, eventPayload);
        return await syncRemoteEventAndNotification({
            sourceEventId: remoteEvent.id,
            remoteEvent,
            notificationIntent,
        });
    }

    async function updateEventEntry({
        eventId,
        eventPayload,
        notificationIntent = null,
    }) {
        const numericEventId = Number(eventId);
        const existingOutboxEntry = await outboxService.findOutboxEntryForEvent(numericEventId);

        if (isLocalPendingOutbox(existingOutboxEntry)) {
            return await outboxService.requeuePendingCreate({
                eventId: numericEventId,
                eventPayload,
                notificationIntent,
                existingOutboxEntry,
            });
        }

        const result = await updateRemoteEvent(numericEventId, eventPayload);
        if (!result.ok) {
            return buildMutationResult({
                ok: false,
                error: result.error || 'No se pudo actualizar el evento.',
            });
        }

        const remoteEvent = extractEventRecordFromCreateResponse(result.data, {
            ...eventPayload,
            id: numericEventId,
        });

        return await syncRemoteEventAndNotification({
            sourceEventId: existingOutboxEntry?.local_event_id ?? numericEventId,
            remoteEvent,
            notificationIntent,
            existingOutboxEntry,
        });
    }

    async function deleteEventEntry({ eventId }) {
        const numericEventId = Number(eventId);
        const existingOutboxEntry = await outboxService.findOutboxEntryForEvent(numericEventId);

        if (isLocalPendingOutbox(existingOutboxEntry)) {
            await deleteNotification(numericEventId, { localOnly: true });
            await window.electronAPI?.db?.deletePendingEventBundle?.(numericEventId);
            await eventStore.remove(numericEventId, { persist: false });
            return buildMutationResult();
        }

        const result = await deleteEventAndSync(numericEventId);
        if (!result.ok) {
            return buildMutationResult({
                ok: false,
                error: result.error || 'No se pudo eliminar el evento.',
            });
        }

        if (existingOutboxEntry?.local_event_id != null) {
            await window.electronAPI?.db?.deleteEventOutbox?.(existingOutboxEntry.local_event_id);
        }
        await eventStore.remove(numericEventId, { persist: false });
        return buildMutationResult();
    }

    return {
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
    };
}
