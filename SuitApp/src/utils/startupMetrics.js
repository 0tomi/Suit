import { createLogger } from '../services/logService.js';
const logger = createLogger('startup:renderer');

const STARTUP_METRICS_ENABLED = Boolean(import.meta.env?.DEV);
const startupStartedAt = typeof performance !== 'undefined'
    ? performance.now()
    : Date.now();
const startupCounters = new Map();

function getElapsedMs() {
    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    return Math.round(now - startupStartedAt);
}

export function startupMark(stage, details = null) {
    if (!STARTUP_METRICS_ENABLED) return;

    const elapsedMs = getElapsedMs();
    if (details && Object.keys(details).length > 0) {
        void logger.info(`+${elapsedMs}ms ${stage}`, details);
        return;
    }
    void logger.info(`+${elapsedMs}ms ${stage}`);
}

export function startupIncrementCounter(key, amount = 1) {
    if (!STARTUP_METRICS_ENABLED) return 0;

    const nextValue = (startupCounters.get(key) || 0) + amount;
    startupCounters.set(key, nextValue);
    return nextValue;
}

export function startupMarkCount(stage, key, details = null) {
    const count = startupIncrementCounter(key, 1);
    startupMark(stage, {
        ...(details || {}),
        counterKey: key,
        count,
    });
    return count;
}
