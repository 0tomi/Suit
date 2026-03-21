function configureSingleInstance({
    app,
    onSecondInstance,
    logger = console,
    enabled = app?.isPackaged !== false,
} = {}) {
    if (!enabled) {
        logger.info?.('Single instance lock disabled for development runtime');
        return true;
    }

    if (typeof app?.requestSingleInstanceLock !== 'function') {
        logger.warn?.('Single instance API unavailable, continuing without lock');
        return true;
    }

    const hasLock = app.requestSingleInstanceLock();

    if (!hasLock) {
        logger.info?.('Second instance detected, exiting duplicate process');
        app.quit();
        return false;
    }

    app.on('second-instance', (_event, argv, workingDirectory) => {
        logger.info?.('Second instance blocked, focusing existing window');
        onSecondInstance?.({ argv, workingDirectory });
    });

    return true;
}

module.exports = {
    configureSingleInstance,
};
