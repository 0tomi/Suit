const fs = require('fs');
const path = require('path');

const MAX_SESSION_LOGS = 5;
const SESSION_LOG_PREFIX = 'log-';
const SESSION_LOG_SUFFIX = '.log';
const ERROR_LOG_PATTERN = /^log-(\d+)\.log$/;
const SESSION_DATE_TIME_SEPARATOR = '_';
const SESSION_INDEX_SEPARATOR = '_';
const WINDOWS_RESERVED_FILENAME_CHARS = /[<>:"/\\|?*]/g;

let runtime = createFallbackRuntime();

function createFallbackRuntime() {
    return {
        isInitialized: false,
        isDev: false,
        sessionLogPath: null,
        logsDir: null,
        errorsDir: null,
    };
}

function pad(value, size = 2) {
    return String(value).padStart(size, '0');
}

function safeConsoleWrite(level, line, details) {
    const method = level === 'error'
        ? 'error'
        : (level === 'warn' ? 'warn' : 'log');

    if (details === undefined) {
        console[method](line);
        return;
    }

    console[method](line, details);
}

function safeSerialize(value) {
    if (value instanceof Error) {
        return {
            name: value.name,
            message: value.message,
            stack: value.stack,
        };
    }

    if (value === undefined) {
        return undefined;
    }

    if (typeof value === 'string') {
        return value;
    }

    if (value === null || typeof value !== 'object') {
        return value;
    }

    const seen = new WeakSet();

    const serialized = JSON.stringify(value, (_key, currentValue) => {
        if (currentValue instanceof Error) {
            return {
                name: currentValue.name,
                message: currentValue.message,
                stack: currentValue.stack,
            };
        }

        if (typeof currentValue === 'bigint') {
            return String(currentValue);
        }

        if (typeof currentValue === 'function') {
            return `[Function:${currentValue.name || 'anonymous'}]`;
        }

        if (typeof currentValue === 'symbol') {
            return currentValue.toString();
        }

        if (typeof currentValue === 'object' && currentValue !== null) {
            if (seen.has(currentValue)) {
                return '[Circular]';
            }
            seen.add(currentValue);
        }

        return currentValue;
    });

    if (serialized === undefined) {
        return String(value);
    }

    return JSON.parse(serialized);
}

function normalizeMessage(message, details) {
    if (typeof message === 'string' && message.trim()) {
        return message;
    }

    if (message instanceof Error) {
        return message.message || message.name || 'Error';
    }

    if (details instanceof Error) {
        return details.message || details.name || 'Error';
    }

    if (message !== undefined && message !== null) {
        return String(message);
    }

    return 'Log entry without message';
}

function formatLogLine({ timestamp, level, origin, scope, message, details }) {
    const parts = [
        `[${timestamp}]`,
        `[${level.toUpperCase()}]`,
        `[${origin}:${scope}]`,
        message,
    ];

    const serializedDetails = safeSerialize(details);
    if (serializedDetails !== undefined) {
        if (typeof serializedDetails === 'string') {
            parts.push(serializedDetails);
        } else {
            parts.push(JSON.stringify(serializedDetails));
        }
    }

    return parts.join(' ');
}

function ensureDirectory(dirPath) {
    fs.mkdirSync(dirPath, { recursive: true });
}

function sanitizeFilenameSegment(value) {
    return String(value).replace(WINDOWS_RESERVED_FILENAME_CHARS, '-');
}

function buildSessionFilenamePrefix(date) {
    return [
        SESSION_LOG_PREFIX,
        sanitizeFilenameSegment(`${pad(date.getDate())}-${pad(date.getMonth() + 1)}-${date.getFullYear()}`),
        SESSION_DATE_TIME_SEPARATOR,
        sanitizeFilenameSegment(`${pad(date.getHours())}-${pad(date.getMinutes())}`),
        SESSION_INDEX_SEPARATOR,
    ].join('');
}

function buildSessionFilename(date, index) {
    return [
        buildSessionFilenamePrefix(date),
        pad(index, 3),
        SESSION_LOG_SUFFIX,
    ].join('');
}

function listSessionLogFiles(logsDir) {
    if (!fs.existsSync(logsDir)) return [];

    return fs.readdirSync(logsDir)
        .map((name) => {
            const fullPath = path.join(logsDir, name);
            const stats = fs.statSync(fullPath);
            return {
                name,
                fullPath,
                mtimeMs: stats.mtimeMs,
                isFile: stats.isFile(),
            };
        })
        .filter((entry) => entry.isFile && entry.name.startsWith(SESSION_LOG_PREFIX) && entry.name.endsWith(SESSION_LOG_SUFFIX))
        .sort((left, right) => left.mtimeMs - right.mtimeMs);
}

function rotateSessionLogs(logsDir) {
    const files = listSessionLogFiles(logsDir);

    while (files.length >= MAX_SESSION_LOGS) {
        const oldest = files.shift();
        if (!oldest) break;
        fs.rmSync(oldest.fullPath, { force: true });
    }
}

function getNextSessionIndex(logsDir, date) {
    if (!fs.existsSync(logsDir)) return 1;

    const prefix = buildSessionFilenamePrefix(date);
    const usedIndexes = fs.readdirSync(logsDir)
        .filter((name) => name.startsWith(prefix) && name.endsWith(SESSION_LOG_SUFFIX))
        .map((name) => Number.parseInt(name.slice(prefix.length, prefix.length + 3), 10))
        .filter((value) => Number.isInteger(value));

    if (usedIndexes.length === 0) return 1;
    return Math.max(...usedIndexes) + 1;
}

function createSessionLogFile(logsDir) {
    const now = new Date();
    rotateSessionLogs(logsDir);
    const nextIndex = getNextSessionIndex(logsDir, now);
    const sessionFilename = buildSessionFilename(now, nextIndex);
    const sessionLogPath = path.join(logsDir, sessionFilename);
    fs.writeFileSync(sessionLogPath, '', 'utf8');
    return sessionLogPath;
}

function getNextErrorLogPath(errorsDir) {
    if (!fs.existsSync(errorsDir)) {
        return path.join(errorsDir, 'log-1.log');
    }

    let maxIndex = 0;
    for (const name of fs.readdirSync(errorsDir)) {
        const match = name.match(ERROR_LOG_PATTERN);
        if (!match) continue;
        const currentIndex = Number.parseInt(match[1], 10);
        if (Number.isInteger(currentIndex)) {
            maxIndex = Math.max(maxIndex, currentIndex);
        }
    }

    return path.join(errorsDir, `log-${maxIndex + 1}.log`);
}

function buildFatalStartupReport({ timestamp, stage, error }) {
    const normalizedError = safeSerialize(error);
    const errorSummary = normalizedError === undefined
        ? String(error)
        : (typeof normalizedError === 'string' ? normalizedError : JSON.stringify(normalizedError, null, 2));

    return [
        `Fecha del error: ${timestamp}`,
        `Stage: ${stage}`,
        '',
        'Error:',
        errorSummary,
        '',
    ].join('\n');
}

// Este reporte funciona incluso si el logger de sesión todavía no pudo inicializar.
function writeFatalStartupReport({ app, stage = 'unknown', error }) {
    const timestamp = new Date().toISOString();

    try {
        const baseDir = app.getPath('userData');
        const errorsDir = path.join(baseDir, 'errores');
        ensureDirectory(errorsDir);

        const reportPath = path.join(errorsDir, `startup-fatal-${Date.now()}.log`);
        const reportContents = buildFatalStartupReport({ timestamp, stage, error });
        fs.writeFileSync(reportPath, reportContents, 'utf8');

        return {
            ok: true,
            reportPath,
            timestamp,
        };
    } catch (reportError) {
        safeConsoleWrite('error', '[log-service] failed to write fatal startup report', reportError);
        return {
            ok: false,
            reportPath: null,
            timestamp,
            error: reportError,
        };
    }
}

function mirrorToTerminal(level, line, details) {
    if (level !== 'error' && !runtime.isDev) return;
    safeConsoleWrite(level, line, details);
}

function appendToSessionFile(line) {
    if (!runtime.sessionLogPath) return;
    fs.appendFileSync(runtime.sessionLogPath, `${line}\n`, 'utf8');
}

function createErrorSnapshot({ timestamp, scope, message, line }) {
    if (!runtime.sessionLogPath || !runtime.errorsDir) return;

    const snapshotPath = getNextErrorLogPath(runtime.errorsDir);
    const sessionContents = fs.readFileSync(runtime.sessionLogPath, 'utf8');
    const snapshotHeader = [
        `Fecha del error: ${timestamp}`,
        `Scope: ${scope}`,
        `Mensaje: ${message}`,
        '',
        `Registro disparador: ${line}`,
        '',
        'Historial de sesion:',
        sessionContents,
    ].join('\n');

    fs.writeFileSync(snapshotPath, snapshotHeader, 'utf8');
}

function writeEntry(level, payload = {}, defaults = {}) {
    const origin = payload.origin || defaults.origin || 'main';
    const scope = payload.scope || defaults.scope || 'app';
    const message = normalizeMessage(payload.message, payload.details);
    const details = payload.details;
    const timestamp = new Date().toISOString();
    const line = formatLogLine({
        timestamp,
        level,
        origin,
        scope,
        message,
        details,
    });

    try {
        appendToSessionFile(line);
    } catch (error) {
        safeConsoleWrite('error', '[log-service] failed to append session log entry', error);
    }
    mirrorToTerminal(level, line, details);

    if (level === 'error' && runtime.isInitialized) {
        try {
            createErrorSnapshot({
                timestamp,
                scope: `${origin}:${scope}`,
                message,
                line,
            });
        } catch (error) {
            safeConsoleWrite('error', '[log-service] failed to create error snapshot', error);
        }
    }

    return {
        ok: true,
        timestamp,
        line,
        sessionLogPath: runtime.sessionLogPath,
    };
}

function createScopedLogger(scope, origin = 'main') {
    return {
        debug(message, details) {
            return writeEntry('debug', { origin, scope, message, details });
        },
        info(message, details) {
            return writeEntry('info', { origin, scope, message, details });
        },
        warn(message, details) {
            return writeEntry('warn', { origin, scope, message, details });
        },
        error(message, details) {
            return writeEntry('error', { origin, scope, message, details });
        },
    };
}

function initializeLogService({ app }) {
    const baseDir = app.getPath('userData');
    const logsDir = path.join(baseDir, 'logs');
    const errorsDir = path.join(baseDir, 'errores');
    ensureDirectory(logsDir);
    ensureDirectory(errorsDir);

    runtime = {
        isInitialized: true,
        isDev: process.env.NODE_ENV !== 'production' && !app.isPackaged,
        sessionLogPath: createSessionLogFile(logsDir),
        logsDir,
        errorsDir,
    };

    writeEntry('info', {
        origin: 'main',
        scope: 'log-service',
        message: 'Session log initialized',
        details: {
            sessionLogPath: runtime.sessionLogPath,
            logsDir,
            errorsDir,
        },
    });

    return runtime;
}

module.exports = {
    buildSessionFilename,
    initializeLogService,
    writeEntry,
    writeFatalStartupReport,
    getLogger: createScopedLogger,
};
