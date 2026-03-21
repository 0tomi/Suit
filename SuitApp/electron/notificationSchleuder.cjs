const { Notification } = require('electron');
const {
    getConfig,
    getById,
    buildStoredNotificationPayload,
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
} = require('./database.cjs');

const STATUS_SCHEDULED = 'scheduled';
const STATUS_PENDING_READ = 'pending_read';
const STATUS_READ = 'read';
const VERIFY_AFTER_MS = 5 * 60 * 1000;
const {
    parseNotificationDate,
    getEndOfTodayMs,
    getNotificationBucket,
} = require('./notificationTimeUtils.cjs');
const { mergeScheduledNotificationRows } = require('./notificationSyncUtils.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('notification-schleuder');

function parseCurrentUserId() {
    const rawUser = getConfig('auth_user');
    if (!rawUser) return null;

    try {
        const parsed = JSON.parse(rawUser);
        const userId = Number(parsed?.id);
        return Number.isFinite(userId) ? userId : null;
    } catch (err) {
        logger.error('failed to parse auth_user config', err);
        return null;
    }
}

function parseJsonSafe(value) {
    if (!value) return null;

    try {
        return JSON.parse(value);
    } catch {
        return null;
    }
}

const {
    fromApiDateTime,
    toApiDateTime,
    buildLocalDateFromStartsAt,
    calcNotifyAt,
    calcMinutesFromStartsAt,
} = require('./dateTimeAdapter.cjs');

function buildEventDate(eventRow) {
    return buildLocalDateFromStartsAt(eventRow?.starts_at);
}

function buildKey(eventId, userId) {
    return `${String(userId)}:${String(eventId)}`;
}

function sortPastNotifications(items) {
    return [...items].sort((left, right) => {
        const leftTime = parseNotificationDate(left.handled_at || left.notify_at || 0)?.getTime() ?? 0;
        const rightTime = parseNotificationDate(right.handled_at || right.notify_at || 0)?.getTime() ?? 0;
        return rightTime - leftTime;
    });
}

function buildApiBaseUrl() {
    const host = getConfig('api_host');
    const port = getConfig('api_port');
    if (!host || !port) return null;
    return `http://${host}:${port}/api`;
}

async function requestApi(path, { method = 'GET', body } = {}) {
    const baseUrl = buildApiBaseUrl();
    const token = getConfig('auth_token');

    if (!baseUrl || !token) {
        return {
            ok: false,
            status: 0,
            data: null,
            error: 'API no configurada o sin autenticacion.',
        };
    }

    const headers = {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
    };

    if (body !== undefined) {
        headers['Content-Type'] = 'application/json';
    }

    try {
        const response = await fetch(`${baseUrl}${path}`, {
            method,
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        let data = null;
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        }

        return {
            ok: response.ok,
            status: response.status,
            data,
            error: response.ok ? null : (data?.message || `HTTP ${response.status}`),
        };
    } catch (err) {
        return {
            ok: false,
            status: 0,
            data: null,
            error: err?.message || 'No se pudo contactar la API.',
        };
    }
}

class NotificationEvent {
    constructor({ row, onTrigger, onVerify }) {
        this.row = row;
        this.state = 'waiting';
        this.triggerTimer = null;
        this.verifyTimer = null;
        this.onTrigger = onTrigger;
        this.onVerify = onVerify;
    }

    schedule() {
        this.cancelTimers();

        const notifyDate = parseNotificationDate(this.row.notify_at);
        if (!notifyDate) return;

        const delay = Math.max(0, notifyDate.getTime() - Date.now());
        this.triggerTimer = setTimeout(() => {
            this.state = 'occurred';
            this.onTrigger(this);
        }, delay);
    }

    scheduleVerification() {
        this.verifyTimer = setTimeout(() => {
            this.onVerify(this);
        }, VERIFY_AFTER_MS);
    }

    cancelTimers() {
        if (this.triggerTimer) {
            clearTimeout(this.triggerTimer);
            this.triggerTimer = null;
        }
        if (this.verifyTimer) {
            clearTimeout(this.verifyTimer);
            this.verifyTimer = null;
        }
    }

    cancel() {
        this.state = 'discarded';
        this.cancelTimers();
        if (this.nativeNotification) {
            this.nativeNotification.close();
            this.nativeNotification = null;
        }
    }
}

class PastNotification {
    constructor(row) {
        this.event_id = row.event_id;
        this.user_id = row.user_id;
        this.notify_at = row.notify_at;
        this.status = row.status;
        this.title = row.title || 'Evento sin titulo';
        this.description = row.description || '';
        this.date = row.date || null;
        this.time = row.time || null;
        this.handled_at = row.handled_at || null;
    }
}

function createNotificationSchleuder({ focusMainWindow, onOpenEvent, onPastChanged, onTriggered = () => { } }) {
    let apiConnected = false;
    let started = false;
    let reconcileInFlight = null;
    let rolloverTimer = null;
    const activeNotifications = new Map();
    const pastNotifications = new Map();

    function emitPastChanged() {
        onPastChanged(listPastNotifications());
    }

    function clearRuntime() {
        for (const notificationEvent of activeNotifications.values()) {
            notificationEvent.cancel();
        }
        activeNotifications.clear();
        pastNotifications.clear();
        if (rolloverTimer) {
            clearTimeout(rolloverTimer);
            rolloverTimer = null;
        }
    }

    function scheduleRollover() {
        if (rolloverTimer) {
            clearTimeout(rolloverTimer);
        }

        const next = new Date();
        next.setHours(24, 0, 0, 0);
        const delay = Math.max(1, next.getTime() - Date.now());

        rolloverTimer = setTimeout(() => {
            void reconcileNow({ force: true });
        }, delay);
    }

    function normalizeRemoteNotification(notification, fallbackEventId = null, fallbackUserId = null) {
        const eventId = Number(notification?.event_id ?? fallbackEventId);
        const userId = Number(notification?.user_id ?? fallbackUserId);
        const notifyAt = notification?.notify_at ?? null;

        if (!Number.isFinite(eventId) || !Number.isFinite(userId) || !notifyAt) {
            return null;
        }

        const normalizedNotifyAt = fromApiDateTime(notifyAt);
        if (!normalizedNotifyAt) {
            return null;
        }

        const nowIso = new Date().toISOString();
        const existing = getEventNotificationWithEvent(eventId, userId);
        const preserveRead = existing?.status === STATUS_READ && existing.notify_at === normalizedNotifyAt;
        const status = preserveRead ? STATUS_READ : STATUS_SCHEDULED;
        const handledAt = preserveRead ? (existing.handled_at || notification?.handled_at || nowIso) : null;

        // Enriquecer data_json con datos del evento local cuando la API no los incluye
        // (por ejemplo, /until-today solo devuelve event_id y notify_at).
        // Esto garantiza que title/description/starts_at estén disponibles como fallback
        // incluso si el evento es borrado de la cache más adelante.
        const eventRow = getById('events', eventId);
        const eventSnapshot = eventRow ? {
            title: eventRow.title || null,
            description: eventRow.description || '',
            starts_at: eventRow.starts_at || null,
            is_all_day: eventRow.is_all_day ?? 0,
        } : {};

        return {
            event_id: eventId,
            user_id: userId,
            notify_at: normalizedNotifyAt,
            last_updated_at: notification?.last_updated_at ?? nowIso,
            status,
            handled_at: handledAt,
            data_json: JSON.stringify({
                ...eventSnapshot,
                ...notification,
                event_id: eventId,
                user_id: userId,
                notify_at: normalizedNotifyAt,
                status,
            }),
            synced_at: nowIso,
        };
    }

    function ensureScheduledState(row) {
        if (!row || row.status === STATUS_SCHEDULED && !row.handled_at) {
            return row;
        }

        const lastUpdatedAt = new Date().toISOString();
        const eventRow = getById('events', row.event_id);
        const payload = buildStoredNotificationPayload({
            ...row,
            status: STATUS_SCHEDULED,
            handled_at: null,
            last_updated_at: lastUpdatedAt,
        }, eventRow);

        updateEventNotificationStatus(row.event_id, row.user_id, {
            status: STATUS_SCHEDULED,
            handledAt: null,
            lastUpdatedAt,
            syncedAt: lastUpdatedAt,
            dataJson: JSON.stringify(payload),
        });

        return getEventNotificationWithEvent(row.event_id, row.user_id) || {
            ...row,
            status: STATUS_SCHEDULED,
            handled_at: null,
            last_updated_at: lastUpdatedAt,
            data_json: JSON.stringify(payload),
        };
    }

    function buildPastNotification(row) {
        return new PastNotification(row);
    }

    function listPastNotifications() {
        return sortPastNotifications([...pastNotifications.values()]);
    }

    function hydratePastNotification(row) {
        const key = buildKey(row.event_id, row.user_id);
        pastNotifications.set(key, buildPastNotification(row));
    }

    function removePastNotification(eventId, userId) {
        const key = buildKey(eventId, userId);
        pastNotifications.delete(key);
    }

    function removeActiveNotification(eventId, userId) {
        const key = buildKey(eventId, userId);
        const existing = activeNotifications.get(key);
        if (existing) {
            existing.cancel();
            activeNotifications.delete(key);
        }
    }

function buildNotificationPayload(row) {
    return {
        eventId: row.event_id,
        title: row.title,
            description: row.description || '',
            date: row.date,
            time: row.time,
        notifyAt: row.notify_at,
    };
}

function buildEventConfigResponse(row) {
    if (!row?.notify_at) {
        return { enabled: false };
    }

    const notifyDate = parseNotificationDate(row.notify_at);
    const minutes = calculateMinutesForRow(row);
    const notifyDatePart = notifyDate
        ? `${notifyDate.getFullYear()}-${String(notifyDate.getMonth() + 1).padStart(2, '0')}-${String(notifyDate.getDate()).padStart(2, '0')}`
        : null;
    const notifyTimePart = notifyDate
        ? `${String(notifyDate.getHours()).padStart(2, '0')}:${String(notifyDate.getMinutes()).padStart(2, '0')}`
        : null;

    return {
        ...row,
        enabled: true,
        notify_at: row.notify_at,
        notifyAt: row.notify_at,
        notify_date: notifyDatePart,
        notify_time: notifyTimePart,
        minutes,
    };
}

    function createNativeNotification(row, notificationEvent) {
        const nativeNotification = new Notification({
            title: row.title || 'Recordatorio de evento',
            body: row.description || 'Tienes un evento proximo en SuitAPP.',
            silent: false,
        });

        nativeNotification.on('click', () => {
            void markNotificationAsRead({
                eventId: row.event_id,
                userId: row.user_id,
                notifyAt: row.notify_at,
                emitOpenEvent: true,
            });
        });

        nativeNotification.show();
        onTriggered(buildNotificationPayload(row));
        notificationEvent.scheduleVerification();
        
        // Guardar la referencia para evitar que el Garbage Collector destruya la notificacion antes de que el usuario la vea
        notificationEvent.nativeNotification = nativeNotification;
        
        return nativeNotification;
    }

    function materializeRuntimeForUser(userId) {
        clearRuntime();
        if (!userId) return;

        const rows = getAllEventNotificationsForUser(userId);
        const endOfToday = getEndOfTodayMs();
        const now = Date.now();

        for (let row of rows) {
            const notifyDate = parseNotificationDate(row.notify_at);
            if (!notifyDate) {
                continue;
            }

            // Descartar notificaciones huérfanas: el evento no existe en la cache
            // y el data_json tampoco tiene título. Esto ocurre cuando el evento fue
            // borrado del cache y la notificación quedó sin datos identificables.
            // Las eliminamos de la DB para no acumular basura.
            if (!row.title && !row.payload?.title) {
                deleteEventNotification(row.event_id, row.user_id);
                continue;
            }

            const bucket = getNotificationBucket(notifyDate, {
                nowMs: now,
                endOfTodayMs: endOfToday,
            });

            if (row.status === STATUS_READ) {
                hydratePastNotification(row);
                continue;
            }

            if (bucket === 'past') {
                const moved = moveNotificationToPast(row, STATUS_PENDING_READ, { emit: false });
                if (moved) {
                    hydratePastNotification(moved);
                }
                continue;
            }

            row = ensureScheduledState(row);

            if (bucket === 'today') {
                const key = buildKey(row.event_id, row.user_id);
                const notificationEvent = new NotificationEvent({
                    row,
                    onTrigger: handleNotificationTriggered,
                    onVerify: handleNotificationVerification,
                });
                activeNotifications.set(key, notificationEvent);
                notificationEvent.schedule();
                continue;
            }

            removePastNotification(row.event_id, row.user_id);
        }

        scheduleRollover();
    }

    function getCurrentUserRow(eventId) {
        const userId = parseCurrentUserId();
        if (!userId) return null;
        return getEventNotificationWithEvent(eventId, userId);
    }

    function calculateNotifyAt(eventId, minutes, fallbackEventRecord) {
        const eventRow = getById('events', eventId) || fallbackEventRecord;
        if (!eventRow) {
            throw new Error('No se encontro el evento local ni evento fallback para calcular la notificacion.');
        }

        const startsAt = eventRow?.starts_at;
        if (!startsAt) {
            throw new Error('La fecha del evento no es valida para calcular la notificacion.');
        }

        const normalizedMinutes = Number(minutes);
        if (!Number.isFinite(normalizedMinutes) || normalizedMinutes < 0) {
            throw new Error('Los minutos de notificacion son invalidos.');
        }

        // Devuelve naive ISO (sin Z) para almacenamiento local.
        return calcNotifyAt(startsAt, normalizedMinutes);
    }

    function calculateMinutesForRow(row) {
        const startsAt = row?.starts_at;
        const notifyAt = row?.notify_at;
        if (!startsAt || !notifyAt) return null;
        return calcMinutesFromStartsAt(startsAt, notifyAt);
    }

    function buildLocalNotificationRow({ eventId, userId, minutes, fallbackEventRecord }) {
        const notifyAt = calculateNotifyAt(eventId, minutes, fallbackEventRecord);
        const nowIso = new Date().toISOString();
        const bucket = getNotificationBucket(notifyAt, {
            nowMs: Date.now(),
            endOfTodayMs: getEndOfTodayMs(),
        });
        const status = bucket === 'past' ? STATUS_PENDING_READ : STATUS_SCHEDULED;
        const handledAt = status === STATUS_SCHEDULED ? null : nowIso;
        const eventRow = getById('events', eventId) || fallbackEventRecord;
        const stored = {
            event_id: eventId,
            user_id: userId,
            notify_at: notifyAt,
            last_updated_at: nowIso,
            status,
            handled_at: handledAt,
            synced_at: nowIso,
        };

        stored.data_json = JSON.stringify(buildStoredNotificationPayload(stored, eventRow));
        return stored;
    }

    function moveNotificationToPast(row, status, { emit = true } = {}) {
        const handledAt = new Date().toISOString();
        const eventRow = getById('events', row.event_id);
        const payload = buildStoredNotificationPayload({
            ...row,
            status,
            handled_at: handledAt,
            last_updated_at: handledAt,
        }, eventRow);

        updateEventNotificationStatus(row.event_id, row.user_id, {
            status,
            handledAt,
            lastUpdatedAt: handledAt,
            syncedAt: handledAt,
            dataJson: JSON.stringify(payload),
        });

        removeActiveNotification(row.event_id, row.user_id);
        const hydrated = getEventNotificationWithEvent(row.event_id, row.user_id);
        if (hydrated) {
            hydratePastNotification(hydrated);
            if (emit) emitPastChanged();
            return hydrated;
        }

        if (emit) emitPastChanged();
        return null;
    }

    async function syncFromApi({ force = false } = {}) {
        void force;
        const userId = parseCurrentUserId();
        if (!userId || !apiConnected) return [];

        const dueTodayResponse = await requestApi('/notifications/until-today');
        if (!dueTodayResponse.ok) {
            throw new Error(dueTodayResponse.error || 'No se pudo sincronizar notificaciones del dia.');
        }

        const dueRows = Array.isArray(dueTodayResponse.data)
            ? dueTodayResponse.data
                .map((notification) => normalizeRemoteNotification(notification, notification?.event_id, userId))
                .filter(Boolean)
            : [];
        const endOfTodayIso = new Date(getEndOfTodayMs()).toISOString();
        const retainedLocalDueTodayRows = getNotificationsUpToDateForUser(userId, endOfTodayIso)
            .filter((row) => row.status === STATUS_SCHEDULED);

        // /until-today solo consume las de hoy; las futuras quedan en el servidor.
        // Sin embargo, replaceScheduledNotificationsForUser borra TODAS las scheduled
        // antes de re-insertar, así que hay que rescatar también las futuras del cache
        // para que no se pierdan durante el replace.
        const retainedLocalFutureRows = getAllEventNotificationsForUser(userId)
            .filter((row) => row.status === STATUS_SCHEDULED && row.notify_at > endOfTodayIso);

        if (dueRows.length > 0) {
            upsertEventNotifications(dueRows);
        }

        const mergedScheduledRows = mergeScheduledNotificationRows(
            dueRows.filter((row) => row.status === STATUS_SCHEDULED),
            retainedLocalDueTodayRows,
            retainedLocalFutureRows,
        );

        replaceScheduledNotificationsForUser(userId, mergedScheduledRows);
        if (dueRows.some((row) => row.status !== STATUS_SCHEDULED)) {
            upsertEventNotifications(dueRows.filter((row) => row.status !== STATUS_SCHEDULED));
        }

        return dueRows;
    }

    async function loadTodayFromApi() {
        const userId = parseCurrentUserId();
        if (!userId) {
            clearRuntime();
            return [];
        }

        if (apiConnected) {
            await syncFromApi({ force: true });
        }

        materializeRuntimeForUser(userId);
        emitPastChanged();
        return listPastNotifications();
    }

    async function refreshSingleNotificationFromApi(eventId, userId) {
        const response = await requestApi(`/events/${eventId}/notification`);
        if (!response.ok) {
            if (response.status === 404) {
                // No borrar del cache en 404: el servidor puede haber consumido
                // la notificacion via /until-today. El cache es la fuente de verdad.
                return null;
            }
            throw new Error(response.error || 'No se pudo obtener la notificacion del evento.');
        }

        const normalized = normalizeRemoteNotification(response.data, eventId, userId);
        if (!normalized) {
            deleteEventNotification(eventId, userId);
            return null;
        }

        upsertEventNotification({
            ...normalized,
            status: STATUS_SCHEDULED,
            handled_at: null,
        });

        return getEventNotificationWithEvent(eventId, userId);
    }

    async function handleNotificationTriggered(notificationEvent) {
        const row = notificationEvent.row;
        if (!row) return;

        const liveRow = getEventNotificationWithEvent(row.event_id, row.user_id) || row;
        notificationEvent.row = liveRow;
        createNativeNotification(liveRow, notificationEvent);
    }

    function handleNotificationVerification(notificationEvent) {
        const row = getEventNotificationWithEvent(notificationEvent.row.event_id, notificationEvent.row.user_id) || notificationEvent.row;
        if (!row || row.status !== STATUS_SCHEDULED) {
            return;
        }

        moveNotificationToPast(row, STATUS_PENDING_READ);
    }

    async function markNotificationAsRead({ eventId, userId = null, notifyAt = null, emitOpenEvent = false }) {
        const currentUserId = userId ?? parseCurrentUserId();
        if (!currentUserId) return false;

        const row = getEventNotificationWithEvent(eventId, currentUserId);
        if (!row) return false;
        if (notifyAt && row.notify_at !== notifyAt) return false;

        const moved = moveNotificationToPast(row, STATUS_READ);
        if (!moved) return false;

        if (emitOpenEvent) {
            focusMainWindow();
            onOpenEvent(buildNotificationPayload(moved));
        }

        return true;
    }

    async function reconcileNow({ force = false } = {}) {
        if (reconcileInFlight) {
            return await reconcileInFlight;
        }

        reconcileInFlight = (async () => {
            const userId = parseCurrentUserId();
            if (!userId) {
                clearRuntime();
                return [];
            }

            void force;

            materializeRuntimeForUser(userId);
            emitPastChanged();
            return listPastNotifications();
        })().finally(() => {
            reconcileInFlight = null;
        });

        return await reconcileInFlight;
    }

    async function getEventConfig(eventId) {
        const userId = parseCurrentUserId();
        if (!userId) return buildEventConfigResponse(null);

        let row = getEventNotificationWithEvent(eventId, userId);

        // Solo consultar la API si NO hay row local. Una vez que el servidor
        // entrega la notificacion via /until-today la borra, pero debe seguir
        // activa localmente — el cache es la fuente de verdad.
        if (!row) {
            const eventRow = getById('events', eventId);
            const eventPayload = parseJsonSafe(eventRow?.data_json) || {};
            const shouldSkipRemoteRefresh = eventPayload?.pending_sync === true;

            if (apiConnected && Number(eventId) > 0 && !shouldSkipRemoteRefresh) {
                try {
                    row = await refreshSingleNotificationFromApi(eventId, userId);
                } catch (err) {
                    logger.warn('failed to refresh single notification', err);
                }
            }
        }

        if (!row) return buildEventConfigResponse(null);

        const bucket = getNotificationBucket(row.notify_at, {
            nowMs: Date.now(),
            endOfTodayMs: getEndOfTodayMs(),
        });
        if (row.status === STATUS_READ || bucket === 'past') {
            return buildEventConfigResponse(null);
        }

        row = ensureScheduledState(row);
        return buildEventConfigResponse(row);
    }

    async function saveEventConfig({ eventId, minutes, fallbackEventRecord, localOnly = false }) {
        const userId = parseCurrentUserId();
        if (!userId) {
            return { ok: false, error: 'No hay usuario autenticado.' };
        }

        const shouldPersistLocallyOnly = Boolean(localOnly) || Number(eventId) <= 0;
        if (shouldPersistLocallyOnly) {
            try {
                const stored = buildLocalNotificationRow({
                    eventId,
                    userId,
                    minutes,
                    fallbackEventRecord,
                });
                upsertEventNotification(stored);
                await reconcileNow({ force: false });

                const nextRow = getEventNotificationWithEvent(eventId, userId);
                return {
                    ok: true,
                    data: nextRow
                        ? {
                            ...nextRow,
                            minutes: calculateMinutesForRow(nextRow),
                        }
                        : null,
                };
            } catch (err) {
                return {
                    ok: false,
                    error: err?.message || 'No se pudo guardar la notificacion local.',
                };
            }
        }

        if (!apiConnected) {
            return { ok: false, error: 'No hay conexion con la API.' };
        }

        try {
            const existing = getEventNotificationWithEvent(eventId, userId);
            const notifyAt = calculateNotifyAt(eventId, minutes, fallbackEventRecord);
            const method = existing?.status === STATUS_SCHEDULED ? 'PUT' : 'POST';
            const response = await requestApi(`/events/${eventId}/notification`, {
                method,
                body: { notify_at: toApiDateTime(notifyAt) },
            });

            if (!response.ok) {
                return { ok: false, error: response.error || 'No se pudo guardar la notificacion.' };
            }

            const normalized = normalizeRemoteNotification({
                ...(response.data || {}),
                notify_at: response.data?.notify_at ?? notifyAt,
            }, eventId, userId);
            if (!normalized) {
                return { ok: false, error: 'La API devolvio una notificacion invalida.' };
            }

            const requestedBucket = getNotificationBucket(notifyAt, {
                nowMs: Date.now(),
                endOfTodayMs: getEndOfTodayMs(),
            });
            const normalizedBucket = getNotificationBucket(normalized.notify_at, {
                nowMs: Date.now(),
                endOfTodayMs: getEndOfTodayMs(),
            });
            const effectiveNotifyAt = requestedBucket !== 'past' && normalizedBucket === 'past'
                ? notifyAt
                : normalized.notify_at;
            const status = getNotificationBucket(effectiveNotifyAt, {
                nowMs: Date.now(),
                endOfTodayMs: getEndOfTodayMs(),
            }) === 'past'
                ? STATUS_PENDING_READ
                : STATUS_SCHEDULED;
            const handledAt = status === STATUS_SCHEDULED ? null : new Date().toISOString();
            const eventRow = getById('events', eventId) || fallbackEventRecord;
            const stored = {
                ...normalized,
                notify_at: effectiveNotifyAt,
                status,
                handled_at: handledAt,
            };

            stored.data_json = JSON.stringify(buildStoredNotificationPayload(stored, eventRow));
            upsertEventNotification(stored);
            await reconcileNow({ force: false });

            const nextRow = getEventNotificationWithEvent(eventId, userId);
            return {
                ok: true,
                data: nextRow
                    ? {
                        ...nextRow,
                        minutes: calculateMinutesForRow(nextRow),
                    }
                    : null,
            };
        } catch (err) {
            return {
                ok: false,
                error: err?.message || 'No se pudo guardar la notificacion.',
            };
        }
    }

    async function deleteEventConfig(eventId, { localOnly = false } = {}) {
        const userId = parseCurrentUserId();
        if (!userId) {
            return { ok: false, error: 'No hay usuario autenticado.' };
        }
        if (localOnly || Number(eventId) <= 0) {
            removeActiveNotification(eventId, userId);
            removePastNotification(eventId, userId);
            deleteEventNotification(eventId, userId);
            emitPastChanged();
            return { ok: true, data: null };
        }
        if (!apiConnected) {
            return { ok: false, error: 'No hay conexion con la API.' };
        }

        const existing = getEventNotificationWithEvent(eventId, userId);
        if (!existing) {
            return { ok: true, data: null };
        }

        const response = await requestApi(`/events/${eventId}/notification`, {
            method: 'DELETE',
        });
        if (!response.ok && response.status !== 404) {
            return { ok: false, error: response.error || 'No se pudo eliminar la notificacion.' };
        }

        removeActiveNotification(eventId, userId);
        removePastNotification(eventId, userId);
        deleteEventNotification(eventId, userId);
        emitPastChanged();
        return { ok: true, data: null };
    }

    async function closePast({ eventId, notifyAt }) {
        const userId = parseCurrentUserId();
        if (!userId) return false;

        const row = getEventNotificationWithEvent(eventId, userId);
        if (!row || row.notify_at !== notifyAt || (row.status !== STATUS_PENDING_READ && row.status !== STATUS_READ)) {
            return false;
        }

        removePastNotification(eventId, userId);
        deleteEventNotification(eventId, userId);
        emitPastChanged();
        return true;
    }

    async function clearAllPast() {
        const userId = parseCurrentUserId();
        if (!userId) return false;

        deletePastNotificationsForUser(userId);
        pastNotifications.clear();
        emitPastChanged();
        return true;
    }

    async function markPastAsRead({ eventId, notifyAt }) {
        return await markNotificationAsRead({
            eventId,
            notifyAt,
            emitOpenEvent: false,
        });
    }

    function setApiAvailability(connected) {
        apiConnected = Boolean(connected);
    }

    function start() {
        if (started) return;
        started = true;
        void reconcileNow({ force: false });
    }

    function stop() {
        started = false;
        clearRuntime();
    }

    function clearStateForCurrentUser() {
        clearRuntime();
        emitPastChanged();
        return true;
    }

    return {
        start,
        stop,
        setApiAvailability,
        reconcileNow,
        loadTodayFromApi,
        getEventConfig,
        saveEventConfig,
        deleteEventConfig,
        listPast: listPastNotifications,
        closePast,
        clearAllPast,
        markPastAsRead,
        clearStateForCurrentUser,
    };
}

module.exports = {
    createNotificationSchleuder,
};
