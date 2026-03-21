function normalizeDatePart(value) {
    if (!value) return null;
    const raw = String(value).trim();
    if (!raw) return null;

    if (raw.includes('T')) {
        return raw.split('T')[0];
    }

    // Las fechas "YYYY-MM-DD" deben conservarse tal cual. Parsearlas con `new Date`
    // las interpreta como UTC y en zonas horarias negativas puede correrlas al dia anterior.
    if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
        return raw;
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const year = parsed.getFullYear();
        const month = String(parsed.getMonth() + 1).padStart(2, '0');
        const day = String(parsed.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    const fallback = new Date(raw.replace(' ', 'T'));
    if (!Number.isNaN(fallback.getTime())) {
        const year = fallback.getFullYear();
        const month = String(fallback.getMonth() + 1).padStart(2, '0');
        const day = String(fallback.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    }

    return raw;
}

function normalizeTimePart(value) {
    if (!value) return '00:00';
    const raw = String(value).trim();
    if (!raw) return '00:00';

    if (raw.includes('T')) {
        return raw.split('T')[1].slice(0, 5);
    }

    if (/^\d{2}:\d{2}/.test(raw)) {
        return raw.slice(0, 5);
    }

    const parsed = new Date(raw);
    if (!Number.isNaN(parsed.getTime())) {
        const hours = String(parsed.getHours()).padStart(2, '0');
        const minutes = String(parsed.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    const fallback = new Date(raw.replace(' ', 'T'));
    if (!Number.isNaN(fallback.getTime())) {
        const hours = String(fallback.getHours()).padStart(2, '0');
        const minutes = String(fallback.getMinutes()).padStart(2, '0');
        return `${hours}:${minutes}`;
    }

    return '00:00';
}

function buildLocalDateTime(dateValue, timeValue) {
    const datePart = normalizeDatePart(dateValue);
    if (!datePart) return null;

    const timePart = normalizeTimePart(timeValue) || '00:00';
    const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(datePart);
    const timeMatch = /^(\d{2}):(\d{2})$/.exec(timePart);

    if (dateMatch && timeMatch) {
        const [, year, month, day] = dateMatch;
        const [, hours, minutes] = timeMatch;
        const built = new Date(
            Number(year),
            Number(month) - 1,
            Number(day),
            Number(hours),
            Number(minutes),
            0,
            0,
        );
        return Number.isNaN(built.getTime()) ? null : built;
    }

    const built = new Date(`${datePart}T${timePart}:00`);
    return Number.isNaN(built.getTime()) ? null : built;
}

module.exports = {
    buildLocalDateTime,
    normalizeDatePart,
    normalizeTimePart,
};
