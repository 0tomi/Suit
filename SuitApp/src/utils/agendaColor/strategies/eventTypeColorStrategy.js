function normalizeColor(color) {
    return typeof color === 'string' && color.trim() ? color : null;
}

function normalizeName(value) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isOtherEventType(eventType) {
    return normalizeName(eventType?.name) === 'otro';
}

export function eventTypeColorStrategy({ event, eventTypesById, personalColor }) {
    const eventType = eventTypesById.get(String(event?.event_type_id));
    const safePersonalColor = normalizeColor(personalColor);

    // Regla funcional: el tipo reservado "Otro" usa el color personal del usuario.
    if (eventType && isOtherEventType(eventType) && safePersonalColor) {
        return {
            color: safePersonalColor,
            source: 'personalColor',
            reason: 'event_type_other_personal',
        };
    }

    const color = normalizeColor(eventType?.color);

    if (color) {
        return {
            color,
            source: 'eventType',
            reason: 'resolved_event_type',
        };
    }

    return {
        color: null,
        source: 'fallback',
        reason: eventType ? 'event_type_without_color' : 'event_type_not_found',
    };
}
