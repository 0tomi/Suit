/**
 * Determina si un participante corresponde al dueño del caso.
 * La API puede marcarlo con distintos campos según el endpoint, por eso
 * consolidamos la lógica en un único helper reutilizable y testeable.
 */
export function isCaseOwnerParticipant(participant, caseData) {
    if (!participant || !caseData) return false;

    if (participant.permission_level === 'owner' || participant.role === 'owner') {
        return true;
    }

    if (participant.is_owner === true || participant.owner === true) {
        return true;
    }

    const participantUserId = participant.user_id ?? participant.user?.id ?? participant.id ?? null;
    const caseOwnerId = caseData.owner_id ?? caseData.user_id ?? caseData.owner?.id ?? null;
    if (participantUserId != null && caseOwnerId != null && String(participantUserId) === String(caseOwnerId)) {
        return true;
    }

    const participantTag = participant.user?.tag ?? participant.tag ?? null;
    const caseOwnerTag = caseData.owner_tag ?? caseData.owner?.tag ?? null;
    return Boolean(participantTag && caseOwnerTag && String(participantTag) === String(caseOwnerTag));
}

/**
 * Traduce el permiso interno del participante a la etiqueta visible de la UI.
 */
export function getCaseParticipantPermissionLabel(participant, caseData) {
    if (isCaseOwnerParticipant(participant, caseData)) {
        return 'Dueño';
    }

    if (participant?.permission_level === 'admin') {
        return 'Administrador';
    }

    if (participant?.permission_level === 'write') {
        return 'Escritura';
    }

    return 'Lectura';
}
