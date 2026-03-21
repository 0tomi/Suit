const {
    EVENT_NOTIFICATION_SCHEDULED,
    EVENT_NOTIFICATION_PENDING_READ,
    EVENT_NOTIFICATION_READ,
    parseJsonSafe,
} = require('./shared.cjs');

function buildStoredNotificationPayload(row, eventRow = null) {
    const existingPayload = parseJsonSafe(row?.data_json) || {};
    const eventPayload = eventRow
        ? {
            event_id: eventRow.id,
            title: eventRow.title || null,
            description: eventRow.description || '',
            starts_at: eventRow.starts_at || null,
            is_all_day: eventRow.is_all_day ? 1 : 0,
        }
        : {};

    return {
        ...existingPayload,
        ...eventPayload,
        event_id: row.event_id,
        user_id: row.user_id,
        notify_at: row.notify_at,
        status: row.status,
        handled_at: row.handled_at ?? null,
        last_updated_at: row.last_updated_at ?? null,
    };
}

function hydrateNotificationRow(row) {
    const payload = parseJsonSafe(row.data_json) || {};
    return {
        ...row,
        event_id: Number(row.event_id),
        user_id: Number(row.user_id),
        title: row.title ?? payload.title ?? null,
        description: row.description ?? payload.description ?? '',
        starts_at: row.starts_at ?? payload.starts_at ?? null,
        is_all_day: row.is_all_day ?? payload.is_all_day ?? 0,
        payload,
    };
}

function getEventNotification(dbInstance, eventId, userId) {
    if (!dbInstance) return null;
    return dbInstance.prepare(`
        SELECT *
        FROM event_notifications
        WHERE event_id = ?
          AND user_id = ?
    `).get(eventId, userId) || null;
}

function getEventNotificationWithEvent(dbInstance, eventId, userId) {
    if (!dbInstance) return null;

    const row = dbInstance.prepare(`
        SELECT
            event_notifications.*,
            events.id AS joined_event_id,
            events.title,
            events.description,
            events.starts_at,
            events.is_all_day
        FROM event_notifications
        LEFT JOIN events ON events.id = event_notifications.event_id
        WHERE event_notifications.event_id = ?
          AND event_notifications.user_id = ?
    `).get(eventId, userId);

    return row ? hydrateNotificationRow(row) : null;
}

function upsertEventNotification(dbInstance, row) {
    if (!dbInstance) return;

    const safeRow = {
        event_id: Number(row.event_id),
        user_id: Number(row.user_id),
        notify_at: row.notify_at ?? null,
        last_updated_at: row.last_updated_at ?? new Date().toISOString(),
        status: row.status ?? EVENT_NOTIFICATION_SCHEDULED,
        handled_at: row.handled_at ?? null,
        data_json: row.data_json ?? null,
        synced_at: row.synced_at ?? new Date().toISOString(),
    };

    dbInstance.prepare(`
        INSERT OR REPLACE INTO event_notifications (
            event_id,
            user_id,
            notify_at,
            last_updated_at,
            status,
            handled_at,
            data_json,
            synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
        safeRow.event_id,
        safeRow.user_id,
        safeRow.notify_at,
        safeRow.last_updated_at,
        safeRow.status,
        safeRow.handled_at,
        safeRow.data_json,
        safeRow.synced_at,
    );
}

function upsertEventNotifications(dbInstance, rows = []) {
    if (!dbInstance || !Array.isArray(rows) || rows.length === 0) return;

    const insertMany = dbInstance.transaction((items) => {
        for (const item of items) {
            upsertEventNotification(dbInstance, item);
        }
    });

    insertMany(rows);
}

function replaceScheduledNotificationsForUser(dbInstance, userId, rows = []) {
    if (!dbInstance) return;

    const deleteScheduled = dbInstance.prepare(`
        DELETE FROM event_notifications
        WHERE user_id = ?
          AND status = ?
    `);

    const replaceMany = dbInstance.transaction((items) => {
        deleteScheduled.run(userId, EVENT_NOTIFICATION_SCHEDULED);
        for (const item of items) {
            upsertEventNotification(dbInstance, {
                ...item,
                user_id: userId,
                status: item.status ?? EVENT_NOTIFICATION_SCHEDULED,
            });
        }
    });

    replaceMany(rows);
}

function deleteEventNotification(dbInstance, eventId, userId) {
    if (!dbInstance) return;
    dbInstance.prepare(`
        DELETE FROM event_notifications
        WHERE event_id = ?
          AND user_id = ?
    `).run(eventId, userId);
}

function deletePastNotificationsForUser(dbInstance, userId) {
    if (!dbInstance) return;
    dbInstance.prepare(`
        DELETE FROM event_notifications
        WHERE user_id = ?
          AND status IN (?, ?)
    `).run(userId, EVENT_NOTIFICATION_PENDING_READ, EVENT_NOTIFICATION_READ);
}

function getNotificationsUpToDateForUser(dbInstance, userId, untilIso) {
    if (!dbInstance) return [];

    const rows = dbInstance.prepare(`
        SELECT
            event_notifications.*,
            events.title,
            events.description,
            events.starts_at,
            events.is_all_day
        FROM event_notifications
        LEFT JOIN events ON events.id = event_notifications.event_id
        WHERE event_notifications.user_id = ?
          AND event_notifications.notify_at IS NOT NULL
          AND event_notifications.notify_at <= ?
        ORDER BY event_notifications.notify_at ASC
    `).all(userId, untilIso);

    return rows.map(hydrateNotificationRow);
}

function getAllEventNotificationsForUser(dbInstance, userId) {
    if (!dbInstance) return [];

    const rows = dbInstance.prepare(`
        SELECT
            event_notifications.*,
            events.title,
            events.description,
            events.starts_at,
            events.is_all_day
        FROM event_notifications
        LEFT JOIN events ON events.id = event_notifications.event_id
        WHERE event_notifications.user_id = ?
        ORDER BY event_notifications.notify_at ASC
    `).all(userId);

    return rows.map(hydrateNotificationRow);
}

function listPastNotificationsForUser(dbInstance, userId) {
    if (!dbInstance) return [];

    const rows = dbInstance.prepare(`
        SELECT
            event_notifications.*,
            events.title,
            events.description,
            events.starts_at,
            events.is_all_day
        FROM event_notifications
        LEFT JOIN events ON events.id = event_notifications.event_id
        WHERE event_notifications.user_id = ?
          AND event_notifications.status IN (?, ?)
        ORDER BY COALESCE(event_notifications.handled_at, event_notifications.notify_at) DESC
    `).all(userId, EVENT_NOTIFICATION_PENDING_READ, EVENT_NOTIFICATION_READ);

    return rows.map(hydrateNotificationRow);
}

function updateEventNotificationStatus(dbInstance, eventId, userId, {
    status,
    handledAt = undefined,
    lastUpdatedAt = new Date().toISOString(),
    syncedAt = new Date().toISOString(),
    dataJson = undefined,
} = {}) {
    const existing = getEventNotification(dbInstance, eventId, userId);
    if (!existing) return null;

    const nextRow = {
        ...existing,
        status: status ?? existing.status,
        handled_at: handledAt === undefined ? existing.handled_at : handledAt,
        last_updated_at: lastUpdatedAt,
        synced_at: syncedAt,
        data_json: dataJson === undefined ? existing.data_json : dataJson,
    };

    upsertEventNotification(dbInstance, nextRow);
    return nextRow;
}

function clearNotificationStateForUser(dbInstance, userId) {
    if (!dbInstance) return;
    dbInstance.prepare('DELETE FROM event_notifications WHERE user_id = ?').run(userId);
    try {
        dbInstance.prepare('DELETE FROM notification_deliveries WHERE user_id = ?').run(userId);
    } catch {
        // Tabla legacy, mantener compatibilidad si no existe.
    }
}

module.exports = {
    buildStoredNotificationPayload,
    hydrateNotificationRow,
    getEventNotification,
    getEventNotificationWithEvent,
    upsertEventNotification,
    upsertEventNotifications,
    replaceScheduledNotificationsForUser,
    deleteEventNotification,
    deletePastNotificationsForUser,
    getNotificationsUpToDateForUser,
    getAllEventNotificationsForUser,
    listPastNotificationsForUser,
    updateEventNotificationStatus,
    clearNotificationStateForUser,
};
