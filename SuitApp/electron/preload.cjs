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

    clients: {
        list: (options) => ipcRenderer.invoke('clients:list', options),
        get: (id) => ipcRenderer.invoke('clients:get', id),
        create: (payload) => ipcRenderer.invoke('clients:create', payload),
        update: (id, payload) => ipcRenderer.invoke('clients:update', id, payload),
        delete: (id) => ipcRenderer.invoke('clients:delete', id),
        getLastModified: () => ipcRenderer.invoke('clients:lastModified'),
        sync: () => ipcRenderer.invoke('clients:sync'),
    },

    partes: {
        list: (options) => ipcRenderer.invoke('partes:list', options),
        get: (id) => ipcRenderer.invoke('partes:get', id),
        create: (payload) => ipcRenderer.invoke('partes:create', payload),
        update: (id, payload) => ipcRenderer.invoke('partes:update', id, payload),
        delete: (id) => ipcRenderer.invoke('partes:delete', id),
        getLastModified: () => ipcRenderer.invoke('partes:lastModified'),
        sync: () => ipcRenderer.invoke('partes:sync'),
        listByCase: (caseId) => ipcRenderer.invoke('partes:listByCase', caseId),
        linkToCase: (caseId, parteId) => ipcRenderer.invoke('partes:linkToCase', caseId, parteId),
        unlinkFromCase: (caseId, parteId) => ipcRenderer.invoke('partes:unlinkFromCase', caseId, parteId),
    },

    dialog: {
        openImage: (options) => ipcRenderer.invoke('dialog:openImage', options),
        openFile: (options) => ipcRenderer.invoke('dialog:openFile', options),
        saveFile: (options) => ipcRenderer.invoke('dialog:saveFile', options),
    },

    documents: {
        exportPdf: (payload) => ipcRenderer.invoke('documents:exportPdf', payload),
        /**
         * Convierte un archivo DOCX o PDF a HTML.
         * Si se pasa keyword, reemplaza sus ocurrencias por #1#, #2#, ..., #n#.
         * Retorna { ok, html, warnings, placeholderCount } | { ok: false, error }
         */
        convertToHtml: (filePath, keyword) =>
            ipcRenderer.invoke('documents:convertToHtml', { filePath, keyword }),
        getVersionHistory: (documentId) =>
            ipcRenderer.invoke('documents:getVersionHistory', documentId),
        getVersionContent: (documentId, versionId, fallbackVersion) =>
            ipcRenderer.invoke('documents:getVersionContent', documentId, versionId, fallbackVersion),
        getListingPage: (options) =>
            ipcRenderer.invoke('documents:getListingPage', options),
        invalidateListingCache: () =>
            ipcRenderer.invoke('documents:invalidateListingCache'),
    },

    bitacora: {
        list: (options) => ipcRenderer.invoke('bitacora:list', options),
        clear: () => ipcRenderer.invoke('bitacora:clear'),
        cleanup: (days) => ipcRenderer.invoke('bitacora:cleanup', days),
    },

    publicFiles: {
        // Descarga un archivo público de la API y lo guarda en disco via diálogo nativo.
        // Retorna { saved: true, filePath } o { saved: false, error? }
        download: (fileId, suggestedName) =>
            ipcRenderer.invoke('publicFiles:download', { fileId, suggestedName }),

        // Genera un enlace temporal firmado (válido por 5 min) para descarga externa.
        // Retorna { signed_url, expires_at }
        generateLink: (fileId) => ipcRenderer.invoke('publicFiles:generateLink', fileId),

        // Genera un enlace temporal firmado para carga externa.
        // Retorna { upload_url, expires_at }
        generateUploadLink: (options) => ipcRenderer.invoke('publicFiles:generateUploadLink', options),
    },

    cases: {
        // Genera un enlace temporal para carga/descarga de archivos o multimedia en un caso.
        // Retorna { upload_url | download_url, expires_at }
        generateLink: (options) => ipcRenderer.invoke('cases:generateLink', options),
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
        count: (table) => ipcRenderer.invoke('db:count', table),
        getById: (table, id) => ipcRenderer.invoke('db:getById', table, id),
        getCaseKpis: (caseId) => ipcRenderer.invoke('db:getCaseKpis', caseId),
        getCaseNextEvent: (caseId) => ipcRenderer.invoke('db:getCaseNextEvent', caseId),
        getEnrichedDependencies: (jurisdiccionId, radicacionId) =>
            ipcRenderer.invoke('db:getEnrichedDependencies', jurisdiccionId, radicacionId),
        getTemplateRequirements: (templateId) =>
            ipcRenderer.invoke('db:getTemplateRequirements', templateId),
        searchEvents: (options) => ipcRenderer.invoke('db:searchEvents', options),
        upsertMany: (table, rows) => ipcRenderer.invoke('db:upsertMany', table, rows),
        reconcileEventsForAgenda: (agendaId, rows) =>
            ipcRenderer.invoke('db:reconcileEventsForAgenda', agendaId, rows),
        replaceEventsForAgendaMonth: (agendaId, year, month, rows) =>
            ipcRenderer.invoke('db:replaceEventsForAgendaMonth', agendaId, year, month, rows),
        reconcileEventsForAgendaMonth: (agendaId, year, month, rows) =>
            ipcRenderer.invoke('db:reconcileEventsForAgendaMonth', agendaId, year, month, rows),
        reconcileEventsForAgendasMonth: (year, month, rowsByAgendaId) =>
            ipcRenderer.invoke('db:reconcileEventsForAgendasMonth', year, month, rowsByAgendaId),
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

    system: {
        getFonts: () => ipcRenderer.invoke('system:getFonts'),
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
