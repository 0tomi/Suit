const LEGACY_TO_CANONICAL = Object.freeze({
    event_type: 'eventType',
    case_type: 'caseType',
    eventType: 'eventType',
    caseType: 'caseType',
});

const DEFAULT_MODE = 'eventType';

export function normalizeAgendaColorMode(mode) {
    if (typeof mode !== 'string') return DEFAULT_MODE;
    const normalized = LEGACY_TO_CANONICAL[mode.trim()];
    return normalized || DEFAULT_MODE;
}

export { DEFAULT_MODE };
