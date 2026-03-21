const { initGlobalDatabase, openProfileConnection } = require('./db/bootstrap.cjs');
const { getConfigValue, setConfigValue, deleteConfigValue } = require('./db/configStore.cjs');
const {
    getConfig,
    setConfig,
    deleteConfig,
    getAllConfig,
    getSyncMeta,
    setSyncMeta,
    getCaseSyncMeta,
    setCaseSyncMeta,
    setCaseSyncMetaBatch,
    clearCaseSyncMeta,
    upsertMany,
    getAll,
    getById,
    getCaseKpis,
    getCaseNextEvent,
    deleteById,
    deleteWhere,
    clearTable,
    clearAllResourceTables: clearAllResourceTablesInDb,
} = require('./db/genericRepository.cjs');
const {
    buildStoredNotificationPayload,
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
} = require('./db/notificationsRepository.cjs');
const {
    reconcileEventsForAgenda,
    replaceEventsForAgendaMonth,
    reconcileEventsForAgendaMonth,
    normalizeEventRowForMonthReplace,
} = require('./db/eventsRepository.cjs');
const {
    getEventOutboxByLocalEventId,
    listEventOutbox,
    upsertEventOutbox,
    deleteEventOutbox,
    upsertPendingEventBundle,
    updatePendingEventBundle,
    deletePendingEventBundle,
    promotePendingEvent,
} = require('./db/outboxRepository.cjs');
const {
    getProfileById,
    getProfileByRemoteUserId,
    listProfiles,
    touchProfile,
    createRemoteProfile,
} = require('./db/profileRepository.cjs');
const { getLogger } = require('./logService.cjs');

let globalDb = null;
let activeProfileDb = null;
let activeProfile = null;
const logger = getLogger('database');

function ensureGlobalDb() {
    if (!globalDb) {
        throw new Error('Global database has not been initialized.');
    }
    return globalDb;
}

function getActiveProfileDb() {
    return activeProfileDb;
}

function closeActiveProfileConnection() {
    if (!activeProfileDb) return;

    try {
        activeProfileDb.close();
    } catch (err) {
        logger.warn('Failed to close active profile database', err);
    } finally {
        activeProfileDb = null;
        activeProfile = null;
    }
}

function initDatabase() {
    globalDb = initGlobalDatabase();

    const lastActiveProfileId = Number.parseInt(getConfigValue(globalDb, 'last_active_profile_id') || '', 10);
    if (Number.isInteger(lastActiveProfileId) && lastActiveProfileId > 0) {
        try {
            activateProfile(lastActiveProfileId);
        } catch (err) {
            logger.warn('Failed to restore last active profile', err);
            deactivateProfile();
        }
    }

    return {
        globalDb,
        activeProfileDb,
    };
}

function getActiveProfile() {
    return activeProfile ? { ...activeProfile } : null;
}

function activateProfile(profileId) {
    const profileRow = getProfileById(ensureGlobalDb(), profileId);
    if (!profileRow) {
        throw new Error(`Profile "${String(profileId)}" was not found.`);
    }

    closeActiveProfileConnection();
    activeProfileDb = openProfileConnection(profileRow);

    const now = new Date().toISOString();
    touchProfile(globalDb, profileRow.id, { usedAt: now });
    setConfigValue(ensureGlobalDb(), 'last_active_profile_id', String(profileRow.id));
    activeProfile = getProfileById(globalDb, profileRow.id);
    return getActiveProfile();
}

function activateRemoteUser(user) {
    const remoteUserId = Number(user?.id);
    if (!Number.isInteger(remoteUserId) || remoteUserId < 1) {
        throw new Error('Cannot activate remote profile without a valid user id.');
    }

    let profileRow = getProfileByRemoteUserId(ensureGlobalDb(), remoteUserId);
    if (!profileRow) {
        profileRow = createRemoteProfile(globalDb, user);
    } else {
        touchProfile(globalDb, profileRow.id, {
            displayName: user?.name ?? null,
            tag: user?.tag ?? null,
            authenticatedAt: new Date().toISOString(),
        });
    }

    return activateProfile(profileRow.id);
}

function deactivateProfile() {
    closeActiveProfileConnection();
    deleteConfigValue(globalDb, 'last_active_profile_id');
    return true;
}

/**
 * Limpia la caché SQLite del perfil activo sin tocar su configuración persistida.
 * Mantiene auth/config para que la sesión actual pueda repoblar la BD luego.
 */
function clearActiveProfileCache() {
    const dbInstance = getActiveProfileDb();
    if (!dbInstance) return false;

    clearAllResourceTablesInDb(dbInstance);
    return true;
}

module.exports = {
    initDatabase,
    listProfiles: () => listProfiles(ensureGlobalDb()),
    getActiveProfile,
    activateProfile,
    activateRemoteUser,
    deactivateProfile,
    getConfig: (key) => getConfig(globalDb, activeProfileDb, key),
    setConfig: (key, value) => setConfig(globalDb, activeProfileDb, key, value),
    deleteConfig: (key) => deleteConfig(globalDb, activeProfileDb, key),
    getAllConfig: () => getAllConfig(globalDb, activeProfileDb),
    getSyncMeta: (resource) => getSyncMeta(getActiveProfileDb(), resource),
    setSyncMeta: (resource, lastSync, lastServer) => setSyncMeta(getActiveProfileDb(), resource, lastSync, lastServer),
    getCaseSyncMeta: (caseId) => getCaseSyncMeta(getActiveProfileDb(), caseId),
    setCaseSyncMeta: (caseId, entity, lastSync, lastServer) => setCaseSyncMeta(getActiveProfileDb(), caseId, entity, lastSync, lastServer),
    setCaseSyncMetaBatch: (caseId, entries) => setCaseSyncMetaBatch(getActiveProfileDb(), caseId, entries),
    clearCaseSyncMeta: (caseId) => clearCaseSyncMeta(getActiveProfileDb(), caseId),
    upsertMany: (table, rows) => upsertMany(getActiveProfileDb(), table, rows),
    reconcileEventsForAgenda: (agendaId, rows) =>
        reconcileEventsForAgenda(getActiveProfileDb(), agendaId, rows),
    replaceEventsForAgendaMonth: (agendaId, year, month, rows) =>
        replaceEventsForAgendaMonth(getActiveProfileDb(), agendaId, year, month, rows),
    reconcileEventsForAgendaMonth: (agendaId, year, month, rows) =>
        reconcileEventsForAgendaMonth(getActiveProfileDb(), agendaId, year, month, rows),
    getAll: (table) => getAll(getActiveProfileDb(), table),
    getById: (table, id) => getById(getActiveProfileDb(), table, id),
    getCaseKpis: (caseId) => getCaseKpis(getActiveProfileDb(), caseId),
    getCaseNextEvent: (caseId) => getCaseNextEvent(getActiveProfileDb(), caseId),
    deleteById: (table, id) => deleteById(getActiveProfileDb(), table, id),
    deleteWhere: (table, conditions) => deleteWhere(getActiveProfileDb(), table, conditions),
    clearTable: (table) => clearTable(getActiveProfileDb(), table),
    clearAllResourceTables: () => clearActiveProfileCache(),
    clearActiveProfileCache,
    getEventOutboxByLocalEventId: (localEventId) =>
        getEventOutboxByLocalEventId(getActiveProfileDb(), localEventId),
    listEventOutbox: () => listEventOutbox(getActiveProfileDb()),
    upsertEventOutbox: (row) => upsertEventOutbox(getActiveProfileDb(), row),
    deleteEventOutbox: (localEventId) => deleteEventOutbox(getActiveProfileDb(), localEventId),
    upsertPendingEventBundle: (payload) => upsertPendingEventBundle(getActiveProfileDb(), payload, {
        upsertMany,
        upsertEventNotifications,
    }),
    updatePendingEventBundle: (payload) => updatePendingEventBundle(getActiveProfileDb(), payload, {
        upsertMany,
        upsertEventNotifications,
    }),
    deletePendingEventBundle: (localEventId) => deletePendingEventBundle(getActiveProfileDb(), localEventId),
    promotePendingEvent: (localEventId, remoteEventRow, options) =>
        promotePendingEvent(getActiveProfileDb(), localEventId, remoteEventRow, options, {
            normalizeEventRowForMonthReplace,
            upsertMany,
            upsertEventNotifications,
        }),
    buildStoredNotificationPayload,
    getEventNotification: (eventId, userId) => getEventNotification(getActiveProfileDb(), eventId, userId),
    getEventNotificationWithEvent: (eventId, userId) =>
        getEventNotificationWithEvent(getActiveProfileDb(), eventId, userId),
    upsertEventNotification: (row) => upsertEventNotification(getActiveProfileDb(), row),
    upsertEventNotifications: (rows) => upsertEventNotifications(getActiveProfileDb(), rows),
    replaceScheduledNotificationsForUser: (userId, rows) =>
        replaceScheduledNotificationsForUser(getActiveProfileDb(), userId, rows),
    deleteEventNotification: (eventId, userId) =>
        deleteEventNotification(getActiveProfileDb(), eventId, userId),
    deletePastNotificationsForUser: (userId) =>
        deletePastNotificationsForUser(getActiveProfileDb(), userId),
    getNotificationsUpToDateForUser: (userId, untilIso) =>
        getNotificationsUpToDateForUser(getActiveProfileDb(), userId, untilIso),
    getAllEventNotificationsForUser: (userId) =>
        getAllEventNotificationsForUser(getActiveProfileDb(), userId),
    listPastNotificationsForUser: (userId) =>
        listPastNotificationsForUser(getActiveProfileDb(), userId),
    updateEventNotificationStatus: (eventId, userId, options) =>
        updateEventNotificationStatus(getActiveProfileDb(), eventId, userId, options),
    clearNotificationStateForUser: (userId) =>
        clearNotificationStateForUser(getActiveProfileDb(), userId),
    // Solo para tests internos del main process.
    _unsafe: {
        getActiveProfileDb,
        ensureGlobalDb,
        closeActiveProfileConnection,
    },
};
