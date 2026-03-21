function normalizeCaseId(value) {
    if (value === null || value === undefined || value === '') return null;
    return String(value);
}

function isTruthyClosedFlag(value) {
    if (value === true || value === 1) return true;
    if (typeof value !== 'string') return false;
    const normalized = value.trim().toLowerCase();
    return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'si';
}

function isClosedCase(caseItem) {
    if (!caseItem) return false;

    if (caseItem.end_date || caseItem.endDate || caseItem.closed_at || caseItem.closedAt || caseItem.finished_at) {
        return true;
    }

    if (isTruthyClosedFlag(caseItem.is_closed) || isTruthyClosedFlag(caseItem.closed)) {
        return true;
    }

    const normalizedStatus = String(caseItem.status ?? caseItem.state ?? caseItem.case_status ?? '')
        .trim()
        .toLowerCase();

    return normalizedStatus === 'closed'
        || normalizedStatus === 'finalizado'
        || normalizedStatus === 'finalizada'
        || normalizedStatus === 'cerrado'
        || normalizedStatus === 'cerrada'
        || normalizedStatus === 'finalized'
        || normalizedStatus === 'archived';
}

function getActiveCaseIds(cases = []) {
    const ids = new Set();

    for (const caseItem of cases || []) {
        const caseId = normalizeCaseId(caseItem?.id);
        if (!caseId) continue;
        if (isClosedCase(caseItem)) continue;
        ids.add(caseId);
    }

    return ids;
}

export function splitVisibleAgendas(agendas = [], cases = []) {
    const activeCaseIds = getActiveCaseIds(cases);
    const personalAgendas = [];
    const caseAgendas = [];
    const visibleAgendas = [];

    for (const agenda of agendas || []) {
        const agendaCaseId = normalizeCaseId(agenda?.suit_case_id ?? agenda?.case_id ?? null);
        if (!agendaCaseId) {
            personalAgendas.push(agenda);
            visibleAgendas.push(agenda);
            continue;
        }

        if (activeCaseIds.has(agendaCaseId)) {
            caseAgendas.push(agenda);
            visibleAgendas.push(agenda);
        }
    }

    return {
        personalAgendas,
        caseAgendas,
        visibleAgendas,
        visibleAgendaIds: new Set(visibleAgendas.map((agenda) => String(agenda.id))),
    };
}
