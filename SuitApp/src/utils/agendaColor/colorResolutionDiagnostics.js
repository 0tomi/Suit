import { normalizeAgendaColorMode } from './normalizeAgendaColorMode.js';
import { createLogger } from '../../services/logService.js';
const logger = createLogger('agenda-color:diagnostics');

const reasonCounter = new Map();

function incrementReason(reason) {
    const key = reason || 'unknown';
    reasonCounter.set(key, (reasonCounter.get(key) || 0) + 1);
    return reasonCounter.get(key);
}

export function logColorResolutionFallback(payload) {
    const reason = payload?.reason || 'unknown';
    const count = incrementReason(reason);
    const mode = normalizeAgendaColorMode(payload?.mode);

    if (reason === 'event_type_without_color') {
        void logger.warn(
            `Evento: ${payload?.eventId ?? 'N/A'} con eventType ${payload?.event_type_id ?? 'N/A'} no tiene color definido, usamos color del usuario`,
        );
        return;
    }

    void logger.warn('fallback', {
        ...payload,
        mode,
        count,
    });
}

export function logColorResolutionError(error, context = {}) {
    void logger.warn('resolver-error', {
        ...context,
        error: error?.message || String(error),
    });
}

export function resetColorResolutionDiagnostics() {
    reasonCounter.clear();
}

export function getColorResolutionReasonCount(reason) {
    return reasonCounter.get(reason || 'unknown') || 0;
}
