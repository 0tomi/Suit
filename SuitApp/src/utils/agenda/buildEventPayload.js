import { fromFormValues, toApiEventPayload } from '../dateTimeAdapter.js';

function toNullableNumber(value) {
    if (value === undefined || value === null || value === '') return null;
    const num = Number(value);
    return Number.isFinite(num) ? num : null;
}

export function buildEventPayload(formData, agendasById = new Map()) {
    const agendaId = toNullableNumber(formData?.agendaId);
    const agenda = agendaId != null ? agendasById.get(String(agendaId)) : null;

    const directCaseId = toNullableNumber(formData?.caseId);
    const agendaCaseId = toNullableNumber(agenda?.suit_case_id);
    const suitCaseId = directCaseId ?? agendaCaseId;

    const { starts_at, is_all_day } = fromFormValues(formData?.date, formData?.time);

    return toApiEventPayload({
        starts_at,
        is_all_day,
        title: formData?.title,
        description: formData?.description || null,
        agenda_id: agendaId,
        suit_case_id: suitCaseId,
        event_type_id: toNullableNumber(formData?.eventTypeId) || 1,
    });
}
