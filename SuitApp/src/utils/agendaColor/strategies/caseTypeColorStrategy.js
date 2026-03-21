import { readCaseId } from '../../eventNormalization.js';

function normalizeColor(color) {
    return typeof color === 'string' && color.trim() ? color : null;
}

function readCaseTypeColor(caseType) {
    return normalizeColor(caseType?.eventColor)
        || normalizeColor(caseType?.event_color)
        || null;
}

export function caseTypeColorStrategy({ event, casesById, caseTypesById }) {
    const suitCaseId = readCaseId(event);
    const suitCase = casesById.get(String(suitCaseId));
    if (!suitCase) {
        return {
            color: null,
            source: 'fallback',
            reason: 'case_not_found',
        };
    }

    const caseTypeId = suitCase?.case_type_id || suitCase?.caseTypeId || suitCase?.case_type;
    const caseType = caseTypesById.get(String(caseTypeId));

    if (!caseType) {
        return {
            color: null,
            source: 'fallback',
            reason: 'case_type_not_found',
        };
    }

    const color = readCaseTypeColor(caseType);

    if (color) {
        return {
            color,
            source: 'caseType',
            reason: 'resolved_case_type',
        };
    }

    return {
        color: null,
        source: 'fallback',
        reason: 'case_type_without_color',
    };
}
