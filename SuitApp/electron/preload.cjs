const { contextBridge, ipcRenderer } = require('electron');

// Cada listener expuesto al renderer devuelve su cleanup para no dejar
// suscripciones colgadas cuando React desmonta componentes.
function registerListener(channel, listener) {
    if (typeof listener !== 'function') {
        throw new Error(`Listener for ${channel} must be a function`);
    }

    const wrapped = (_event, payload) => listener(payload);
    ipcRenderer.on(channel, wrapped);
    return () => ipcRenderer.removeListener(channel, wrapped);
}

contextBridge.exposeInMainWorld('electronAPI', {
    logs: {
        debug: (payload) => ipcRenderer.invoke('logs:debug', payload),
        info: (payload) => ipcRenderer.invoke('logs:info', payload),
        warn: (payload) => ipcRenderer.invoke('logs:warn', payload),
        error: (payload) => ipcRenderer.invoke('logs:error', payload),
    },

    // --- Configuración del servidor ---
    config: {
        get: (key) => ipcRenderer.invoke('config:get', key),
        set: (key, value) => ipcRenderer.invoke('config:set', key, value),
        delete: (key) => ipcRenderer.invoke('config:delete', key),
        getAll: () => ipcRenderer.invoke('config:getAll'),
    },

    profiles: {
        list: () => ipcRenderer.invoke('profiles:list'),
        getActive: () => ipcRenderer.invoke('profiles:getActive'),
        activate: (profileId) => ipcRenderer.invoke('profiles:activate', profileId),
        activateRemoteUser: (user) => ipcRenderer.invoke('profiles:activateRemoteUser', user),
        deactivate: () => ipcRenderer.invoke('profiles:deactivate'),
    },

    // --- Descubrimiento de servidor ---
    discovery: {
        findServer: () => ipcRenderer.invoke('discovery:findServer'),
    },

    http: {
        request: (payload) => ipcRenderer.invoke('http:request', payload),
    },

    dialog: {
        openImage: (options) => ipcRenderer.invoke('dialog:openImage', options),
        saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    },

    documents: {
        exportPdf: (payload) => ipcRenderer.invoke('documents:exportPdf', payload),
    },

    publicFiles: {
        // Descarga un archivo público de la API y lo guarda en disco via diálogo nativo.
        // Retorna { saved: true, filePath } o { saved: false, error? }
        download: (fileId, suggestedName) =>
            ipcRenderer.invoke('publicFiles:download', { fileId, suggestedName }),
    },

    // --- Sincronización ---
    sync: {
        getMeta: (resource) => ipcRenderer.invoke('sync:getMeta', resource),
        setMeta: (resource, lastSync, lastServer) =>
            ipcRenderer.invoke('sync:setMeta', resource, lastSync, lastServer),
        getCaseMeta: (caseId) => ipcRenderer.invoke('sync:getCaseMeta', caseId),
        setCaseMeta: (caseId, entity, lastSync, lastServer) =>
            ipcRenderer.invoke('sync:setCaseMeta', caseId, entity, lastSync, lastServer),
        setCaseMetaBatch: (caseId, entries) =>
            ipcRenderer.invoke('sync:setCaseMetaBatch', caseId, entries),
        clearCaseMeta: (caseId) => ipcRenderer.invoke('sync:clearCaseMeta', caseId),
    },

    // --- Base de datos local (caché) ---
    db: {
        getAll: (table) => ipcRenderer.invoke('db:getAll', table),
        getById: (table, id) => ipcRenderer.invoke('db:getById', table, id),
        getCaseKpis: (caseId) => ipcRenderer.invoke('db:getCaseKpis', caseId),
        getCaseNextEvent: (caseId) => ipcRenderer.invoke('db:getCaseNextEvent', caseId),
        upsertMany: (table, rows) => ipcRenderer.invoke('db:upsertMany', table, rows),
        reconcileEventsForAgenda: (agendaId, rows) =>
            ipcRenderer.invoke('db:reconcileEventsForAgenda', agendaId, rows),
        replaceEventsForAgendaMonth: (agendaId, year, month, rows) =>
            ipcRenderer.invoke('db:replaceEventsForAgendaMonth', agendaId, year, month, rows),
        reconcileEventsForAgendaMonth: (agendaId, year, month, rows) =>
            ipcRenderer.invoke('db:reconcileEventsForAgendaMonth', agendaId, year, month, rows),
        deleteById: (table, id) => ipcRenderer.invoke('db:deleteById', table, id),
        deleteWhere: (table, conditions) => ipcRenderer.invoke('db:deleteWhere', table, conditions),
        clearTable: (table) => ipcRenderer.invoke('db:clearTable', table),
        clearAllResourceTables: () => ipcRenderer.invoke('db:clearAllResourceTables'),
        clearActiveProfileCache: () => ipcRenderer.invoke('db:clearActiveProfileCache'),
        getEventOutboxByLocalEventId: (localEventId) =>
            ipcRenderer.invoke('db:getEventOutboxByLocalEventId', localEventId),
        listEventOutbox: () => ipcRenderer.invoke('db:listEventOutbox'),
        upsertEventOutbox: (row) => ipcRenderer.invoke('db:upsertEventOutbox', row),
        deleteEventOutbox: (localEventId) => ipcRenderer.invoke('db:deleteEventOutbox', localEventId),
        upsertPendingEventBundle: (payload) => ipcRenderer.invoke('db:upsertPendingEventBundle', payload),
        updatePendingEventBundle: (payload) => ipcRenderer.invoke('db:updatePendingEventBundle', payload),
        deletePendingEventBundle: (localEventId) => ipcRenderer.invoke('db:deletePendingEventBundle', localEventId),
        promotePendingEvent: (localEventId, remoteEventRow, options) =>
            ipcRenderer.invoke('db:promotePendingEvent', localEventId, remoteEventRow, options),
    },

    notifications: {
        getEventConfig: (eventId) => ipcRenderer.invoke('notifications:getEventConfig', eventId),
        saveEventConfig: (payload) => ipcRenderer.invoke('notifications:saveEventConfig', payload),
        deleteEventConfig: (eventId, options) => ipcRenderer.invoke('notifications:deleteEventConfig', eventId, options),
        listPast: () => ipcRenderer.invoke('notifications:listPast'),
        closePast: (payload) => ipcRenderer.invoke('notifications:closePast', payload),
        clearAllPast: () => ipcRenderer.invoke('notifications:clearAllPast'),
        markPastAsRead: (payload) => ipcRenderer.invoke('notifications:markPastAsRead', payload),
        setApiAvailability: (connected) => ipcRenderer.invoke('notifications:setApiAvailability', connected),
        loadTodayFromApi: () => ipcRenderer.invoke('notifications:loadTodayFromApi'),
        reconcileNow: () => ipcRenderer.invoke('notifications:reconcileNow'),
        clearStateForCurrentUser: () => ipcRenderer.invoke('notifications:clearStateForCurrentUser'),
        onPastChanged: (listener) => registerListener('notifications:past-changed', listener),
        onOpenEvent: (listener) => registerListener('notifications:open-event', listener),
        onTriggered: (listener) => registerListener('notifications:triggered', listener),
    },
});
