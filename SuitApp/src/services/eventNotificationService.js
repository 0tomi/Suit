function getNotificationsApi() {
    return window.electronAPI?.notifications ?? null;
}

export function resetNotificationSyncInFlightState() {
    // El renderer ya no mantiene un sync en vuelo; el estado vive en main.
}

export async function getNotification(eventId) {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.getEventConfig) {
        return {
            enabled: false,
            minutes: null,
            when_to_notify_minutes: null,
            notifyAt: null,
            notifyDate: null,
            notifyTime: null,
        };
    }

    const data = await notificationsApi.getEventConfig(eventId);
    if (!data) {
        return {
            enabled: false,
            minutes: null,
            when_to_notify_minutes: null,
            notifyAt: null,
            notifyDate: null,
            notifyTime: null,
        };
    }

    return {
        ...data,
        enabled: Boolean(data.enabled),
        minutes: data.minutes ?? null,
        when_to_notify_minutes: data.minutes ?? null,
        notifyAt: data.notifyAt ?? data.notify_at ?? null,
        notifyDate: data.notifyDate ?? data.notify_date ?? null,
        notifyTime: data.notifyTime ?? data.notify_time ?? null,
    };
}

export async function syncAllNotifications() {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.reconcileNow) return [];
    return await notificationsApi.reconcileNow();
}

export async function syncEventNotifications() {
    return await syncAllNotifications();
}

export async function createNotification(eventId, minutes, fallbackEventRecord, options = {}) {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.saveEventConfig) {
        return {
            ok: false,
            error: 'La gestion de notificaciones no esta disponible en este entorno.',
        };
    }

    return await notificationsApi.saveEventConfig({ eventId, minutes, fallbackEventRecord, ...options });
}

export async function updateNotification(eventId, minutes, fallbackEventRecord, options = {}) {
    return await createNotification(eventId, minutes, fallbackEventRecord, options);
}

export async function deleteNotification(eventId, options = {}) {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.deleteEventConfig) {
        return {
            ok: false,
            error: 'La gestion de notificaciones no esta disponible en este entorno.',
        };
    }

    return await notificationsApi.deleteEventConfig(eventId, options);
}
