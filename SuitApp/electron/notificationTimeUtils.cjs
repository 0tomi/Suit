const { buildLocalDateFromNaiveIso, fromApiDateTime } = require('./dateTimeAdapter.cjs');

function buildLocalTimestampCandidate(raw) {
    if (!raw) return null;

    const normalized = String(raw).trim().replace(' ', 'T');
    if (!normalized) return null;

    if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
        return `${normalized}:00`;
    }

    return normalized;
}

function parseNotificationDate(value) {
    if (!value && value !== 0) return null;

    if (value instanceof Date) {
        return Number.isNaN(value.getTime()) ? null : new Date(value.getTime());
    }

    if (typeof value === 'number') {
        const parsed = new Date(value);
        return Number.isNaN(parsed.getTime()) ? null : parsed;
    }

    const raw = String(value).trim();
    if (!raw) return null;

    // Convención de la app: notify_at representa la hora local del estudio.
    // Reutilizamos el mismo adapter que usamos para starts_at para evitar
    // diferencias entre renderer, cache SQLite y runtime de notificaciones.
    const normalized = fromApiDateTime(raw);
    if (normalized) {
        const built = buildLocalDateFromNaiveIso(normalized);
        if (built) {
            return built;
        }
    }

    const localCandidate = buildLocalTimestampCandidate(raw);
    const hasExplicitTimezone = /([zZ]|[+-]\d{2}:\d{2})$/.test(localCandidate || '');
    if (localCandidate && !hasExplicitTimezone) {
        const parsedLocal = new Date(localCandidate);
        if (!Number.isNaN(parsedLocal.getTime())) {
            return parsedLocal;
        }
    }

    for (const candidate of [raw, localCandidate].filter(Boolean)) {
        const parsed = new Date(candidate);
        if (!Number.isNaN(parsed.getTime())) {
            return parsed;
        }
    }

    return null;
}

function getEndOfTodayMs(reference = new Date()) {
    const date = reference instanceof Date ? new Date(reference.getTime()) : new Date(reference);
    if (Number.isNaN(date.getTime())) {
        return new Date().setHours(23, 59, 59, 999);
    }

    date.setHours(23, 59, 59, 999);
    return date.getTime();
}

function getNotificationBucket(value, {
    nowMs = Date.now(),
    endOfTodayMs = getEndOfTodayMs(),
} = {}) {
    const parsed = parseNotificationDate(value);
    if (!parsed) return 'invalid';

    const notifyMs = parsed.getTime();
    if (notifyMs <= nowMs) return 'past';
    if (notifyMs <= endOfTodayMs) return 'today';
    return 'future';
}

module.exports = {
    parseNotificationDate,
    getEndOfTodayMs,
    getNotificationBucket,
};
