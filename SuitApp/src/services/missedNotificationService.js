function getNotificationsApi() {
    return window.electronAPI?.notifications ?? null;
}

export async function getPastNotifications() {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.listPast) return [];
    return await notificationsApi.listPast();
}

export async function closePastNotification(eventId, notifyAt) {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.closePast) return false;
    return await notificationsApi.closePast({ eventId, notifyAt });
}

export async function clearAllPastNotifications() {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.clearAllPast) return false;
    return await notificationsApi.clearAllPast();
}

export async function markPastNotificationAsRead(eventId, notifyAt) {
    const notificationsApi = getNotificationsApi();
    if (!notificationsApi?.markPastAsRead) return false;
    return await notificationsApi.markPastAsRead({ eventId, notifyAt });
}

// Compatibilidad con el naming viejo del hook.
export async function getMissedNotifications() {
    return await getPastNotifications();
}

export async function resolveMissedNotification(eventId, notifyAt) {
    return await closePastNotification(eventId, notifyAt);
}

export async function resolveMissedNotifications() {
    return false;
}
