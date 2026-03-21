const { app, BrowserWindow, Notification, dialog, ipcMain, session } = require('electron');
const path = require('path');
const { initializeLogService, getLogger, writeEntry, writeFatalStartupReport } = require('./logService.cjs');
const { bootstrapApp } = require('./bootstrapApp.cjs');

// Establecer el nombre de la aplicación explícitamente
app.name = 'SuitAPP';

if (process.platform === 'win32') {
  app.setAppUserModelId('com.suitapp.desktop');
}

const {
    initDatabase,
    listProfiles,
    getActiveProfile,
    activateProfile,
    activateRemoteUser,
    deactivateProfile,
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
    reconcileEventsForAgenda,
    replaceEventsForAgendaMonth,
    reconcileEventsForAgendaMonth,
    getAll,
    getById,
    getCaseKpis,
    getCaseNextEvent,
    deleteById,
    deleteWhere,
    clearTable,
    clearAllResourceTables,
    clearActiveProfileCache,
    getEventOutboxByLocalEventId,
    listEventOutbox,
    upsertEventOutbox,
    deleteEventOutbox,
    upsertPendingEventBundle,
    updatePendingEventBundle,
    deletePendingEventBundle,
    promotePendingEvent,
} = require('./database.cjs');
const { discoverServer } = require('./discovery.cjs');
const { performHttpRequest } = require('./httpProxy.cjs');
const { createTrayManager } = require('./trayManager.cjs');
const { configureSingleInstance } = require('./singleInstance.cjs');
const { createNotificationSchleuder } = require('./notificationSchleuder.cjs');
const { openImageDialog } = require('./documentDialogs.cjs');
const { exportDocumentToPdf } = require('./documentExporter.cjs');
const {
    pathExists,
    resolveAppIconPath,
    resolveRendererEntryPath,
} = require('./runtimePaths.cjs');

let mainWindow = null;
let trayManager = null;
let notificationSchleuder = null;
const mainLogger = getLogger('main');
const startupLogger = getLogger('startup');
const startupStartedAt = Date.now();
const startupMetricsEnabled = true;
const hasSingleInstanceLock = configureSingleInstance({
    app,
    enabled: app.isPackaged,
    onSecondInstance: () => handleSecondInstance(),
    logger: mainLogger,
});

function logStartup(stage, details = null) {
    if (!startupMetricsEnabled) return;
    const elapsedMs = Date.now() - startupStartedAt;
    if (details && Object.keys(details).length > 0) {
        startupLogger.info(`+${elapsedMs}ms ${stage}`, details);
        return;
    }
    startupLogger.info(`+${elapsedMs}ms ${stage}`);
}

function focusMainWindow() {
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
    }

    if (mainWindow.isMinimized()) {
        mainWindow.restore();
    }

    mainWindow.show();
    mainWindow.focus();
}

function isMainWindowForeground() {
    return Boolean(
        mainWindow
        && !mainWindow.isDestroyed()
        && mainWindow.isVisible()
        && !mainWindow.isMinimized()
        && mainWindow.isFocused()
    );
}

// La primera vez que el usuario "cierra" la ventana, la app se oculta al tray.
// Este aviso explica cómo salir realmente sin repetir el mensaje en cada cierre.
function showTrayHintOnce() {
    if (getConfig('tray_hint_shown') === 'true') return;
    setConfig('tray_hint_shown', 'true');

    if (!Notification.isSupported()) return;

    const notification = new Notification({
        title: 'SuitAPP sigue activa',
        body: 'SuitAPP seguirá ejecutándose en segundo plano. Para salir por completo, usa el icono de la bandeja del sistema.',
        silent: true,
    });
    notification.show();
}

function escapeHtml(value) {
    return String(value)
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#39;');
}

function buildStartupErrorHtml({ title, message, details = [] }) {
    const renderedDetails = details
        .map((detail) => `<li>${escapeHtml(detail)}</li>`)
        .join('');

    return `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="UTF-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        margin: 0;
        font-family: system-ui, sans-serif;
        background: #f8fafc;
        color: #0f172a;
        min-height: 100vh;
        display: grid;
        place-items: center;
      }
      main {
        width: min(720px, calc(100vw - 32px));
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        padding: 28px;
        box-shadow: 0 18px 60px rgba(15, 23, 42, 0.12);
      }
      h1 {
        margin: 0 0 12px;
        font-size: 1.375rem;
      }
      p {
        margin: 0 0 18px;
        line-height: 1.5;
      }
      ul {
        margin: 0;
        padding-left: 20px;
        color: #475569;
      }
      code {
        background: #eff6ff;
        color: #1d4ed8;
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <main>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(message)}</p>
      ${renderedDetails ? `<ul>${renderedDetails}</ul>` : ''}
    </main>
  </body>
</html>`;
}

function loadStartupErrorPage(window, payload) {
    if (!window || window.isDestroyed()) return;
    const html = buildStartupErrorHtml(payload);
    const dataUrl = `data:text/html;charset=utf-8,${encodeURIComponent(html)}`;
    window.loadURL(dataUrl).catch((error) => {
        mainLogger.error('Failed to render startup error page', error);
    });
}

function showFatalStartupError({ stage, error, reportPath }) {
    const details = [
        'SuitAPP no pudo completar el arranque.',
        `Etapa: ${stage}`,
        `Motivo: ${error?.message || String(error)}`,
    ];

    if (reportPath) {
        details.push(`Reporte: ${reportPath}`);
    }

    dialog.showErrorBox('Error al iniciar SuitAPP', details.join('\n'));
}

function attachWindowDiagnostics(window) {
    window.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL, isMainFrame) => {
        mainLogger.error('did-fail-load', {
            errorCode,
            errorDescription,
            validatedURL,
            isMainFrame,
        });
    });

    window.webContents.on('render-process-gone', (_event, details) => {
        mainLogger.error('render-process-gone', details);
    });
}

async function loadRendererApp(window) {
    const rendererEntryPath = resolveRendererEntryPath();
    const forceDistRenderer = process.env.SUITAPP_RENDERER_MODE === 'dist';
    const shouldUseDevServer = !forceDistRenderer && process.env.NODE_ENV !== 'production' && !app.isPackaged;

    if (shouldUseDevServer) {
        const devServerUrl = 'http://localhost:5173';
        logStartup('window:load-url', { url: devServerUrl });
        await window.loadURL(devServerUrl);
        return;
    }

    if (!pathExists(rendererEntryPath)) {
        mainLogger.error('renderer entry missing', { rendererEntryPath });
        loadStartupErrorPage(window, {
            title: 'No se pudo iniciar SuitAPP',
            message: 'El renderer empaquetado no está disponible.',
            details: [
                `No se encontró ${rendererEntryPath}`,
                'Ejecuta el build del renderer antes de empaquetar Electron.',
            ],
        });
        return;
    }

    logStartup('window:load-file', { file: rendererEntryPath });
    await window.loadFile(rendererEntryPath);
}

function createWindow() {
    logStartup('window:create:start');
    const iconPath = resolveAppIconPath();
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        show: false,
        autoHideMenuBar: true,
        backgroundColor: '#f8fafc',
        icon: pathExists(iconPath) ? iconPath : undefined,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.cjs'),
        },
    });
    attachWindowDiagnostics(mainWindow);

    // El cierre normal de la ventana se convierte en hide-to-tray.
    mainWindow.on('close', (event) => {
        if (trayManager?.getIsQuitting()) return;
        if (!trayManager?.isCreated?.()) return;
        event.preventDefault();
        mainWindow.hide();
        showTrayHintOnce();
    });

    mainWindow.on('closed', () => {
        mainWindow = null;
    });

    mainWindow.once('ready-to-show', () => {
        logStartup('window:ready-to-show');
        mainWindow?.show();
    });
    loadRendererApp(mainWindow).catch((error) => {
        mainLogger.error('failed to load renderer', error);
        loadStartupErrorPage(mainWindow, {
            title: 'No se pudo abrir la aplicación',
            message: 'Hubo un problema cargando la interfaz principal.',
            details: [
                error?.message || String(error),
            ],
        });
    });
}

function applyCSP() {
    const isProd = process.env.NODE_ENV === 'production' || app.isPackaged;
    // En dev, Vite HMR requiere 'unsafe-eval' e 'unsafe-inline' para sus scripts de bootstrap
    const scriptSrc = isProd ? "'self'" : "'self' 'unsafe-eval' 'unsafe-inline'";
    const connectSrc = isProd
        ? "'self'"
        : "* ws://localhost:* http://localhost:*"; // + Vite HMR WebSocket

    const csp = [
        "default-src 'none'",
        `script-src ${scriptSrc}`,
        "style-src 'self' 'unsafe-inline'",    // TailwindCSS usa estilos inline
        "img-src 'self' http: https: data: blob:",
        "font-src 'self' data:",
        `connect-src ${connectSrc}`,
        "form-action 'self'",
        "base-uri 'self'",
    ].join('; ');

    session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
        callback({
            responseHeaders: {
                ...details.responseHeaders,
                'Content-Security-Policy': [csp],
            },
        });
    });
}

function sendToRenderer(channel, payload) {
    if (!mainWindow || mainWindow.isDestroyed()) return;
    mainWindow.webContents.send(channel, payload);
}

// Tray y gestor viven en main para seguir funcionando aunque no haya
// una ventana visible.
function createRuntimeManagers() {
    trayManager = createTrayManager({
        onShowWindow: focusMainWindow,
        onQuitApp: () => {
            trayManager?.setQuitting(true);
            app.quit();
        },
        logger: getLogger('tray'),
    });
    const tray = trayManager.create();
    if (!tray) {
        mainLogger.warn('Tray unavailable, continuing without tray support');
    }

    notificationSchleuder = createNotificationSchleuder({
        focusMainWindow,
        onOpenEvent: (payload) => sendToRenderer('notifications:open-event', payload),
        onPastChanged: (items) => sendToRenderer('notifications:past-changed', items),
        onTriggered: (payload) => {
            if (!isMainWindowForeground()) return;
            sendToRenderer('notifications:triggered', payload);
        },
    });
}

if (hasSingleInstanceLock) {
    app.whenReady().then(async () => {
        await bootstrapApp({
            app,
            initializeLogService,
            initDatabase,
            applyCSP,
            registerIpcHandlers,
            createWindow,
            createRuntimeManagers,
            startNotifications: () => notificationSchleuder?.start(),
            logStartup,
            logger: mainLogger,
            writeFatalStartupReport,
            showFatalError: showFatalStartupError,
            exitApp: (code) => {
                trayManager?.setQuitting(true);
                notificationSchleuder?.stop();
                trayManager?.destroy();
                app.exit(code);
            },
        });
    });
}

app.on('before-quit', () => {
    trayManager?.setQuitting(true);
});

app.on('window-all-closed', (event) => {
    if (!trayManager?.isCreated?.()) return;
    if (trayManager?.getIsQuitting()) return;
    event.preventDefault();
});

app.on('activate', () => {
    if (!mainWindow || mainWindow.isDestroyed()) {
        createWindow();
        return;
    }
    focusMainWindow();
});

app.on('will-quit', () => {
    notificationSchleuder?.stop();
    trayManager?.destroy();
});

async function handleSecondInstance() {
    if (!app.isReady()) {
        await app.whenReady();
    }

    focusMainWindow();
}

process.on('uncaughtException', (error) => {
    mainLogger.error('uncaughtException', error);
});

process.on('unhandledRejection', (reason) => {
    mainLogger.error('unhandledRejection', reason);
});

// --- IPC Handlers ---

function registerSafeHandle(channel, handler) {
    ipcMain.handle(channel, async (_event, ...args) => {
        try {
            return await handler(...args);
        } catch (err) {
            getLogger(`ipc:${channel}`).error('handler failed', err);
            throw err;
        }
    });
}

function registerIpcHandlers() {
    registerSafeHandle('logs:debug', (payload) => writeEntry('debug', payload, { origin: 'renderer' }));
    registerSafeHandle('logs:info', (payload) => writeEntry('info', payload, { origin: 'renderer' }));
    registerSafeHandle('logs:warn', (payload) => writeEntry('warn', payload, { origin: 'renderer' }));
    registerSafeHandle('logs:error', (payload) => writeEntry('error', payload, { origin: 'renderer' }));

    // --- Config ---
    registerSafeHandle('config:get', (key) => getConfig(key));
    registerSafeHandle('config:set', (key, value) => setConfig(key, value));
    registerSafeHandle('config:delete', (key) => deleteConfig(key));
    registerSafeHandle('config:getAll', () => getAllConfig());

    // --- Profiles ---
    registerSafeHandle('profiles:list', () => listProfiles());
    registerSafeHandle('profiles:getActive', () => getActiveProfile());
    registerSafeHandle('profiles:activate', (profileId) => activateProfile(profileId));
    registerSafeHandle('profiles:activateRemoteUser', (user) => activateRemoteUser(user));
    registerSafeHandle('profiles:deactivate', () => deactivateProfile());

    // --- Server Discovery ---
    registerSafeHandle('discovery:findServer', async () => {
        return await discoverServer();
    });

    // --- HTTP Proxy ---
    registerSafeHandle('http:request', async (payload) => {
        return await performHttpRequest(payload);
    });

    registerSafeHandle('dialog:openImage', async (options = {}) => {
        return await openImageDialog({
            browserWindow: mainWindow,
            ...options,
        });
    });

    registerSafeHandle('dialog:saveFile', async ({ defaultName, bytes } = {}) => {
        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: defaultName || 'archivo',
            filters: [{ name: 'All Files', extensions: ['*'] }],
        });
        if (result.canceled || !result.filePath) return { saved: false };
        const fs = require('fs');
        fs.writeFileSync(result.filePath, Buffer.from(bytes));
        return { saved: true, filePath: result.filePath };
    });

    registerSafeHandle('documents:exportPdf', async ({ title, html, styles } = {}) => {
        return await exportDocumentToPdf({
            browserWindow: mainWindow,
            title,
            html,
            styles,
        });
    });

    // --- Sync Meta ---
    registerSafeHandle('sync:getMeta', (resource) => getSyncMeta(resource));
    registerSafeHandle('sync:setMeta', (resource, lastSync, lastServer) => {
        setSyncMeta(resource, lastSync, lastServer);
    });

    // --- Case Sync Meta (timestamps per-entity por caso) ---
    registerSafeHandle('sync:getCaseMeta', (caseId) => getCaseSyncMeta(caseId));
    registerSafeHandle('sync:setCaseMeta', (caseId, entity, lastSync, lastServer) => {
        setCaseSyncMeta(caseId, entity, lastSync, lastServer);
    });
    registerSafeHandle('sync:setCaseMetaBatch', (caseId, entries) => {
        setCaseSyncMetaBatch(caseId, entries);
    });
    registerSafeHandle('sync:clearCaseMeta', (caseId) => {
        clearCaseSyncMeta(caseId);
    });

    // --- Generic DB Operations ---
    registerSafeHandle('db:getAll', (table) => getAll(table));
    registerSafeHandle('db:getById', (table, id) => getById(table, id));
    registerSafeHandle('db:getCaseKpis', (caseId) => getCaseKpis(caseId));
    registerSafeHandle('db:getCaseNextEvent', (caseId) => getCaseNextEvent(caseId));
    registerSafeHandle('db:upsertMany', (table, rows) => upsertMany(table, rows));
    registerSafeHandle('db:reconcileEventsForAgenda', (agendaId, rows) =>
        reconcileEventsForAgenda(agendaId, rows)
    );
    registerSafeHandle('db:replaceEventsForAgendaMonth', (agendaId, year, month, rows) =>
        replaceEventsForAgendaMonth(agendaId, year, month, rows)
    );
    registerSafeHandle('db:reconcileEventsForAgendaMonth', (agendaId, year, month, rows) =>
        reconcileEventsForAgendaMonth(agendaId, year, month, rows)
    );
    registerSafeHandle('db:deleteById', (table, id) => deleteById(table, id));
    registerSafeHandle('db:deleteWhere', (table, conditions) => deleteWhere(table, conditions));
    registerSafeHandle('db:clearTable', (table) => clearTable(table));
    registerSafeHandle('db:clearAllResourceTables', () => {
        const cleared = clearAllResourceTables();
        notificationSchleuder?.clearStateForCurrentUser();
        return cleared;
    });
    registerSafeHandle('db:clearActiveProfileCache', async () => {
        const cleared = clearActiveProfileCache();
        notificationSchleuder?.clearStateForCurrentUser();
        return cleared;
    });
    registerSafeHandle('db:getEventOutboxByLocalEventId', (localEventId) => getEventOutboxByLocalEventId(localEventId));
    registerSafeHandle('db:listEventOutbox', () => listEventOutbox());
    registerSafeHandle('db:upsertEventOutbox', (row) => upsertEventOutbox(row));
    registerSafeHandle('db:deleteEventOutbox', (localEventId) => deleteEventOutbox(localEventId));
    registerSafeHandle('db:upsertPendingEventBundle', (payload) => upsertPendingEventBundle(payload));
    registerSafeHandle('db:updatePendingEventBundle', (payload) => updatePendingEventBundle(payload));
    registerSafeHandle('db:deletePendingEventBundle', (localEventId) => deletePendingEventBundle(localEventId));
    registerSafeHandle('db:promotePendingEvent', (localEventId, remoteEventRow, options) =>
        promotePendingEvent(localEventId, remoteEventRow, options)
    );

    // --- Biblioteca: descarga de archivos públicos ---
    // El download se maneja enteramente en el proceso principal para evitar pasar
    // buffers binarios grandes (hasta 100 MB) de vuelta al renderer via IPC.
    registerSafeHandle('publicFiles:download', async ({ fileId, suggestedName } = {}) => {
        const fs = require('fs');
        const host = getConfig('api_host') || 'localhost';
        const port = getConfig('api_port') || '8000';
        const token = getConfig('auth_token');
        const url = `http://${host}:${port}/api/public-files/${fileId}/download`;

        const result = await dialog.showSaveDialog(mainWindow, {
            defaultPath: suggestedName || 'archivo',
            filters: [{ name: 'All Files', extensions: ['*'] }],
        });
        if (result.canceled || !result.filePath) return { saved: false };

        const response = await performHttpRequest({
            url,
            method: 'GET',
            responseType: 'binary',
            headers: token ? { Authorization: `Bearer ${token}` } : {},
        });

        if (!response.ok) {
            return { saved: false, error: `API responded ${response.status}` };
        }

        fs.writeFileSync(result.filePath, Buffer.from(response.data.bytes));
        return { saved: true, filePath: result.filePath };
    });

    // --- NotificationSchleuder ---
    registerSafeHandle('notifications:getEventConfig', (eventId) => notificationSchleuder?.getEventConfig(eventId));
    registerSafeHandle('notifications:saveEventConfig', (payload) => notificationSchleuder?.saveEventConfig(payload));
    registerSafeHandle('notifications:deleteEventConfig', (eventId, options) => notificationSchleuder?.deleteEventConfig(eventId, options));
    registerSafeHandle('notifications:listPast', () => notificationSchleuder?.listPast() || []);
    registerSafeHandle('notifications:closePast', (payload) => notificationSchleuder?.closePast(payload));
    registerSafeHandle('notifications:clearAllPast', () => notificationSchleuder?.clearAllPast());
    registerSafeHandle('notifications:markPastAsRead', (payload) => notificationSchleuder?.markPastAsRead(payload));
    registerSafeHandle('notifications:setApiAvailability', (connected) => {
        notificationSchleuder?.setApiAvailability(connected);
        return true;
    });
    registerSafeHandle('notifications:loadTodayFromApi', async () => {
        return await notificationSchleuder?.loadTodayFromApi();
    });
    registerSafeHandle('notifications:reconcileNow', async () => {
        return await notificationSchleuder?.reconcileNow({ force: false });
    });
    registerSafeHandle('notifications:clearStateForCurrentUser', () => {
        return notificationSchleuder?.clearStateForCurrentUser() ?? false;
    });
}
