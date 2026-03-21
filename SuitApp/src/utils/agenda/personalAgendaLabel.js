function readAgendaOwner(agenda, usersById = new Map()) {
    if (agenda?.user && typeof agenda.user === 'object') {
        return agenda.user;
    }

    if (agenda?.user_id != null) {
        return usersById.get(String(agenda.user_id)) || null;
    }

    return null;
}

export function getPersonalAgendaLabel({ agenda, currentUser = null, usersById = new Map() }) {
    const owner = readAgendaOwner(agenda, usersById);
    const ownerId = owner?.id ?? agenda?.user_id ?? null;
    const isCurrentUser = currentUser?.id != null && String(ownerId) === String(currentUser.id);

    if (isCurrentUser) {
        return `Tu agenda (${currentUser?.tag || currentUser?.name || 'actual'})`;
    }

    const ownerName = owner?.name || owner?.full_name || null;
    const ownerTag = owner?.tag || null;
    const suffix = ownerTag ? ` (${ownerTag})` : '';

    if (ownerName) return `${ownerName}${suffix}`;
    if (ownerTag) return ownerTag;

    if (ownerId != null) return `Usuario #${ownerId}`;
    return agenda?.name ? agenda.name.replace(/^Agenda:\s*/i, '') : 'Agenda personal';
}
