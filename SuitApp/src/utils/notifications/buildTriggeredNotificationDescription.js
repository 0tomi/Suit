import { parseISO, format, isValid } from 'date-fns';

function formatEventTime(time) {
    if (!time) return null;

    const raw = String(time).trim();
    if (!raw) return null;

    // Formato HH:mm directo
    if (/^\d{2}:\d{2}/.test(raw)) {
        return raw.slice(0, 5);
    }

    // Formato ISO con parte de tiempo
    if (raw.includes('T')) {
        const timePart = raw.split('T')[1] || '';
        if (/^\d{2}:\d{2}/.test(timePart)) {
            return timePart.slice(0, 5);
        }
    }

    // Fallback: parsear como fecha ISO y extraer HH:mm
    const parsed = parseISO(raw.replace(' ', 'T'));
    if (!isValid(parsed)) return null;
    return format(parsed, 'HH:mm');
}

export function buildTriggeredNotificationDescription(payload) {
    const lines = [];
    const description = String(payload?.description || '').trim();
    const formattedTime = formatEventTime(payload?.time);

    if (description) {
        lines.push(description);
    }

    if (formattedTime) {
        lines.push(`Hora del evento: ${formattedTime} hs`);
    }

    if (lines.length > 0) {
        return lines.join('\n');
    }

    return 'Tienes un evento proximo en SuitAPP.';
}

export { formatEventTime };
