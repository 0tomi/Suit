import { normalizeAgendaEvent, readAgendaId, readCaseId } from '../eventNormalization.js';

export function buildAgendaRenderEvents({
    rawEvents,
    agendas,
    caseId = null,
    selectedFilterAgenda = 'ALL',
    visibleAgendaIds = null,
    resolveColorDetails,
}) {
    if (!Array.isArray(rawEvents) || rawEvents.length === 0) return [];

    const agendaById = new Map((agendas || []).map((agenda) => [String(agenda.id), agenda]));
    const events = [];
    const seenEventKeys = new Set();

    for (const rawEvent of rawEvents) {
        const normalizedCaseId = readCaseId(rawEvent);
        const normalizedAgendaId = readAgendaId(rawEvent);
        const agendaIdAsString = String(normalizedAgendaId);

        if (caseId && String(normalizedCaseId) !== String(caseId)) continue;
        if (selectedFilterAgenda !== 'ALL' && agendaIdAsString !== String(selectedFilterAgenda)) continue;
        if (
            selectedFilterAgenda === 'ALL'
            && visibleAgendaIds instanceof Set
            && !visibleAgendaIds.has(agendaIdAsString)
        ) {
            continue;
        }

        const normalized = normalizeAgendaEvent(rawEvent, agendaById);
        const dedupeKey = normalized.id != null
            ? `event:${String(normalized.id)}`
            : `fallback:${agendaIdAsString}:${normalized.starts_at || normalized.date || ''}:${normalized.title || ''}`;
        if (seenEventKeys.has(dedupeKey)) continue;
        seenEventKeys.add(dedupeKey);

        const colorResolution = resolveColorDetails(normalized);

        events.push({
            ...normalized,
            resolvedColor: colorResolution.color,
            colorSource: colorResolution.source,
            colorReason: colorResolution.reason,
            colorMode: colorResolution.mode,
        });
    }

    return events;
}
