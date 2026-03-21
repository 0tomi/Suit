export const ALL_AGENDAS_VIEW = 'ALL';

export function normalizeDefaultAgendaView(value, fallback = ALL_AGENDAS_VIEW) {
    if (value === null || value === undefined || value === '') {
        return fallback;
    }

    const raw = String(value).trim();
    if (!raw) return fallback;

    if (raw.toUpperCase() === ALL_AGENDAS_VIEW) {
        return ALL_AGENDAS_VIEW;
    }

    const numeric = Number(raw);
    if (Number.isInteger(numeric) && numeric > 0) {
        return String(numeric);
    }

    return fallback;
}

