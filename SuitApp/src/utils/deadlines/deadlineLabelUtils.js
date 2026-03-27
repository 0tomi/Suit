/**
 * Devuelve el nombre "limpio" de la agenda a la que pertenece un vencimiento.
 * @param {object} deadline - El objeto vencimiento enriquecido (con owner_name, agenda_name, case_title, etc.)
 * @param {object} currentUser - El objeto de usuario de la sesión actual.
 * @returns {string} El nombre de la agenda o "Personal".
 */
export function getDeadlineAgendaLabel(deadline, currentUser) {
    if (!deadline) return '';

    // 1. Identificar si es personal o de un caso por el suit_case_id del propio vencimiento
    const isPersonal = !deadline.suit_case_id;

    let displayName = '';

    if (isPersonal) {
        // Es personal: Priorizar owner_name del join, o fallar a agenda_name.
        const ownerRaw = deadline.owner_name || deadline.agenda_name || '';
        const cleanOwner = ownerRaw
            .replace(/^Agenda:\s*/i, '')
            .replace(/^Personal Agenda:\s*/i, '')
            .trim();

        // Si el dueño coincide con el usuario de la sesión -> 'Personal'
        if (cleanOwner === currentUser?.name || !cleanOwner) {
            displayName = 'Personal';
        } else {
            displayName = cleanOwner;
        }
    } else {
        // Es de un caso: Priorizar case_title del join, o fallar a agenda_name.
        const caseNameRaw = deadline.case_title || deadline.agenda_name || 'Vencimiento de Caso';
        displayName = caseNameRaw
            .replace(/^Agenda:\s*/i, '')
            .replace(/^Personal Agenda:\s*/i, '')
            .trim();
    }

    return displayName || 'Sin agenda';
}
