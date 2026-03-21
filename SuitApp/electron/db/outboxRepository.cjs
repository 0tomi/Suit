function normalizeEventOutboxRow(row = {}) {
    const localEventId = Number(row.local_event_id);
    if (!Number.isFinite(localEventId)) {
        throw new Error('event_outbox.local_event_id must be a finite number');
    }

    return {
        local_event_id: localEventId,
        remote_event_id: row.remote_event_id == null ? null : Number(row.remote_event_id),
        event_payload_json: row.event_payload_json,
        notification_payload_json: row.notification_payload_json ?? null,
        status: row.status ?? 'pending_event',
        retry_count: Number.isFinite(Number(row.retry_count)) ? Number(row.retry_count) : 0,
        last_error: row.last_error ?? null,
        created_at: row.created_at ?? new Date().toISOString(),
        updated_at: row.updated_at ?? new Date().toISOString(),
    };
}

function upsertEventOutbox(dbInstance, row) {
    if (!dbInstance) return;
    const safeRow = normalizeEventOutboxRow(row);

    dbInstance.prepare(`
        INSERT OR REPLACE INTO event_outbox (
            local_event_id,
            remote_event_id,
            event_payload_json,
            notification_payload_json,
            status,
            retry_count,
            last_error,
            created_at,
            updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        safeRow.local_event_id,
        safeRow.remote_event_id,
        safeRow.event_payload_json,
        safeRow.notification_payload_json,
        safeRow.status,
        safeRow.retry_count,
        safeRow.last_error,
        safeRow.created_at,
        safeRow.updated_at,
    );
}

function getEventOutboxByLocalEventId(dbInstance, localEventId) {
    if (!dbInstance) return null;
    return dbInstance.prepare(`
        SELECT *
        FROM event_outbox
        WHERE local_event_id = ?
    `).get(localEventId) || null;
}

function listEventOutbox(dbInstance) {
    if (!dbInstance) return [];
    return dbInstance.prepare(`
        SELECT *
        FROM event_outbox
        ORDER BY created_at ASC, local_event_id ASC
    `).all();
}

function deleteEventOutbox(dbInstance, localEventId) {
    if (!dbInstance) return;
    dbInstance.prepare(`
        DELETE FROM event_outbox
        WHERE local_event_id = ?
    `).run(localEventId);
}

function upsertPendingEventBundle(dbInstance, { eventRow, outboxRow, notificationRows = [] }, deps) {
    if (!dbInstance) return;

    const safeEventRows = Array.isArray(eventRow) ? eventRow : [eventRow];
    const safeNotificationRows = Array.isArray(notificationRows) ? notificationRows.filter(Boolean) : [];

    const transaction = dbInstance.transaction(() => {
        deps.upsertMany(dbInstance, 'events', safeEventRows.filter(Boolean));
        if (outboxRow) {
            upsertEventOutbox(dbInstance, outboxRow);
        }
        if (safeNotificationRows.length > 0) {
            deps.upsertEventNotifications(dbInstance, safeNotificationRows);
        }
    });

    transaction();
}

function updatePendingEventBundle(dbInstance, {
    eventRow,
    outboxRow,
    notificationRows = [],
    clearNotifications = false,
}, deps) {
    if (!dbInstance) return;

    const localEventId = Number(eventRow?.id ?? outboxRow?.local_event_id);
    const transaction = dbInstance.transaction(() => {
        if (eventRow) {
            deps.upsertMany(dbInstance, 'events', [eventRow]);
        }
        if (outboxRow) {
            upsertEventOutbox(dbInstance, outboxRow);
        }
        if (clearNotifications && Number.isFinite(localEventId)) {
            dbInstance.prepare('DELETE FROM event_notifications WHERE event_id = ?').run(localEventId);
            dbInstance.prepare('DELETE FROM notification_deliveries WHERE event_id = ?').run(localEventId);
        }
        if (Array.isArray(notificationRows) && notificationRows.length > 0) {
            deps.upsertEventNotifications(dbInstance, notificationRows.filter(Boolean));
        }
    });

    transaction();
}

function deletePendingEventBundle(dbInstance, localEventId) {
    if (!dbInstance) return;
    const normalizedLocalEventId = Number(localEventId);
    if (!Number.isFinite(normalizedLocalEventId)) return;

    const transaction = dbInstance.transaction(() => {
        dbInstance.prepare('DELETE FROM event_outbox WHERE local_event_id = ?').run(normalizedLocalEventId);
        dbInstance.prepare('DELETE FROM event_notifications WHERE event_id = ?').run(normalizedLocalEventId);
        dbInstance.prepare('DELETE FROM notification_deliveries WHERE event_id = ?').run(normalizedLocalEventId);
        dbInstance.prepare('DELETE FROM events WHERE id = ?').run(normalizedLocalEventId);
    });

    transaction();
}

function promotePendingEvent(dbInstance, localEventId, remoteEventRow, {
    outboxRow = null,
    notificationRows = [],
    clearOutbox = false,
} = {}, deps) {
    if (!dbInstance) return;

    const normalizedLocalEventId = Number(localEventId);
    const normalizedRemoteEventRow = deps.normalizeEventRowForMonthReplace(
        remoteEventRow,
        Number(remoteEventRow?.agenda_id),
    );

    if (!Number.isFinite(normalizedLocalEventId) || !normalizedRemoteEventRow) {
        throw new Error('Invalid promotePendingEvent payload');
    }

    const transaction = dbInstance.transaction(() => {
        dbInstance.prepare(`
            UPDATE event_notifications
            SET event_id = ?
            WHERE event_id = ?
        `).run(normalizedRemoteEventRow.id, normalizedLocalEventId);
        dbInstance.prepare(`
            UPDATE notification_deliveries
            SET event_id = ?
            WHERE event_id = ?
        `).run(normalizedRemoteEventRow.id, normalizedLocalEventId);

        deps.upsertMany(dbInstance, 'events', [normalizedRemoteEventRow]);
        if (normalizedRemoteEventRow.id !== normalizedLocalEventId) {
            dbInstance.prepare('DELETE FROM events WHERE id = ?').run(normalizedLocalEventId);
        }

        if (Array.isArray(notificationRows) && notificationRows.length > 0) {
            deps.upsertEventNotifications(dbInstance, notificationRows.filter(Boolean));
        }

        if (clearOutbox) {
            deleteEventOutbox(dbInstance, normalizedLocalEventId);
        } else if (outboxRow) {
            upsertEventOutbox(dbInstance, outboxRow);
        }
    });

    transaction();
}

module.exports = {
    normalizeEventOutboxRow,
    upsertEventOutbox,
    getEventOutboxByLocalEventId,
    listEventOutbox,
    deleteEventOutbox,
    upsertPendingEventBundle,
    updatePendingEventBundle,
    deletePendingEventBundle,
    promotePendingEvent,
};
