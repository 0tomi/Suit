const rendererLogDevEnabled = import.meta.env.DEV;
const verboseRendererLogForwardingEnabled = import.meta.env?.VITE_FORWARD_VERBOSE_RENDERER_LOGS === 'true';

function shouldForwardToMain(level) {
  if (level === 'error' || level === 'warn') {
    return true;
  }

  // Los logs `info/debug` del renderer generan mucho IPC durante sync y startup.
  // Por defecto los dejamos en consola local y solo se persisten si se habilita
  // explícitamente el flag para diagnóstico profundo.
  return verboseRendererLogForwardingEnabled;
}

function writeToLocalConsole(level, scope, message, details) {
  if (level !== 'error' && !rendererLogDevEnabled) return;

  const method = level === 'error'
    ? 'error'
    : (level === 'warn' ? 'warn' : 'log');
  const prefix = `[renderer:${scope}] ${message}`;

  if (details === undefined) {
    console[method](prefix);
    return;
  }

  console[method](prefix, details);
}

async function sendToMain(level, payload) {
  if (!shouldForwardToMain(level)) {
    return false;
  }

  const logsApi = window.electronAPI?.logs;
  const handler = logsApi?.[level];

  if (typeof handler !== 'function') {
    return false;
  }

  try {
    await handler(payload);
    return true;
  } catch (error) {
    console.error('[renderer:log-service] failed to forward log entry', error);
    return false;
  }
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

async function forwardRendererLog(level, { scope, message, details }) {
  const normalizedMessage = normalizeMessage(message, details);
  writeToLocalConsole(level, scope, normalizedMessage, details);

  await sendToMain(level, {
    origin: 'renderer',
    scope,
    message: normalizedMessage,
    details,
  });
}

export function createLogger(scope) {
  return {
    debug(message, details) {
      return forwardRendererLog('debug', { scope, message, details });
    },
    info(message, details) {
      return forwardRendererLog('info', { scope, message, details });
    },
    warn(message, details) {
      return forwardRendererLog('warn', { scope, message, details });
    },
    error(message, details) {
      return forwardRendererLog('error', { scope, message, details });
    },
  };
}

export function installGlobalErrorLogging() {
  if (typeof window === 'undefined' || window.__suitGlobalErrorLoggingInstalled) {
    return;
  }

  window.__suitGlobalErrorLoggingInstalled = true;
  const logger = createLogger('window');

  window.addEventListener('error', (event) => {
    void logger.error('Unhandled window error', {
      message: event.message,
      filename: event.filename,
      lineno: event.lineno,
      colno: event.colno,
      error: event.error instanceof Error
        ? {
          name: event.error.name,
          message: event.error.message,
          stack: event.error.stack,
        }
        : event.error,
    });
  });

  window.addEventListener('unhandledrejection', (event) => {
    const reason = event.reason instanceof Error
      ? {
        name: event.reason.name,
        message: event.reason.message,
        stack: event.reason.stack,
      }
      : event.reason;

    void logger.error('Unhandled promise rejection', { reason });
  });
}
