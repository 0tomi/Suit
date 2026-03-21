async function bootstrapApp({
    app,
    initializeLogService,
    initDatabase,
    applyCSP,
    registerIpcHandlers,
    createWindow,
    createRuntimeManagers,
    startNotifications,
    logStartup,
    logger,
    writeFatalStartupReport,
    showFatalError,
    exitApp,
}) {
    let startupStage = 'log-service:init';

    try {
        initializeLogService({ app });

        startupStage = 'app:user-model-id';
        app.setAppUserModelId('com.suitapp.desktop');

        startupStage = 'app:ready';
        logStartup('app:ready');

        startupStage = 'db:init';
        logStartup('db:init:start');
        initDatabase();
        logStartup('db:init:done');

        startupStage = 'csp:apply';
        applyCSP();
        logStartup('csp:applied');

        startupStage = 'ipc:register';
        registerIpcHandlers();
        logStartup('ipc:registered');

        startupStage = 'window:create';
        createWindow();
        logStartup('window:created');

        startupStage = 'runtime-managers:create';
        createRuntimeManagers();
        logStartup('runtime-managers:created');

        startupStage = 'notifications:start';
        startNotifications();
        logStartup('notification-schleuder:started');

        return {
            ok: true,
            stage: startupStage,
        };
    } catch (error) {
        const report = writeFatalStartupReport({
            app,
            stage: startupStage,
            error,
        });

        try {
            logger.error('fatal startup error', {
                stage: startupStage,
                reportPath: report?.reportPath || null,
                error,
            });
        } catch {
            // Si el logger falló durante el bootstrap, no impedimos la salida controlada.
        }

        try {
            showFatalError({
                stage: startupStage,
                error,
                reportPath: report?.reportPath || null,
            });
        } catch {
            // Mostrar el error es best-effort; salir limpio es más importante.
        }

        exitApp(1);

        return {
            ok: false,
            stage: startupStage,
            reportPath: report?.reportPath || null,
            error,
        };
    }
}

module.exports = {
    bootstrapApp,
};
