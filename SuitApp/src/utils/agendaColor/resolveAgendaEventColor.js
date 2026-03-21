import { normalizeAgendaColorMode } from './normalizeAgendaColorMode.js';
import { caseTypeColorStrategy } from './strategies/caseTypeColorStrategy.js';
import { eventTypeColorStrategy } from './strategies/eventTypeColorStrategy.js';
import { readCaseId } from '../eventNormalization.js';

const DEFAULT_COLOR = '#3b82f6';

const STRATEGIES = Object.freeze({
    eventType: eventTypeColorStrategy,
    caseType: caseTypeColorStrategy,
});

function normalizeColor(color) {
    return typeof color === 'string' && color.trim() ? color : null;
}

function buildResolution({ color, source, reason, mode }) {
    return {
        color,
        source,
        reason,
        mode,
    };
}

export function resolveAgendaEventColor({
    event,
    mode,
    eventTypesById,
    caseTypesById,
    casesById,
    personalColor,
    onFallback = null,
    onError = null,
}) {
    const normalizedMode = normalizeAgendaColorMode(mode);
    const safePersonalColor = normalizeColor(personalColor) || DEFAULT_COLOR;
    const suitCaseId = readCaseId(event);

    // Regla de producto: los eventos personales siempre usan el color personal.
    if (!suitCaseId) {
        return buildResolution({
            color: safePersonalColor,
            source: 'personalColor',
            reason: 'personal_event',
            mode: normalizedMode,
        });
    }

    const strategy = STRATEGIES[normalizedMode];
    if (!strategy) {
        const fallback = buildResolution({
            color: safePersonalColor,
            source: 'fallback',
            reason: 'invalid_mode',
            mode: normalizedMode,
        });
        onFallback?.({ ...fallback, eventId: event?.id ?? null });
        return fallback;
    }

    try {
        const resolution = strategy({
            event,
            eventTypesById,
            caseTypesById,
            casesById,
            personalColor: safePersonalColor,
        });
        if (normalizeColor(resolution?.color)) {
            return buildResolution({
                color: resolution.color,
                source: resolution.source,
                reason: resolution.reason,
                mode: normalizedMode,
            });
        }

        const fallback = buildResolution({
            color: safePersonalColor,
            source: 'fallback',
            reason: resolution?.reason || 'unknown',
            mode: normalizedMode,
        });

        onFallback?.({
            ...fallback,
            eventId: event?.id ?? null,
            event_type_id: event?.event_type_id ?? null,
            suit_case_id: suitCaseId,
        });
        return fallback;
    } catch (error) {
        onError?.(error, { eventId: event?.id ?? null, mode: normalizedMode });
        return buildResolution({
            color: safePersonalColor,
            source: 'fallback',
            reason: 'resolver_exception',
            mode: normalizedMode,
        });
    }
}

export { DEFAULT_COLOR };
