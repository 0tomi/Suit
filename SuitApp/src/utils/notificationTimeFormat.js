import {
    NOTIFICATION_MINUTES_LIMITS,
    getUnitMultiplier,
} from '../components/Agenda/notificationConfig.js';

export function clampNotificationMinutes(minutes, limits = NOTIFICATION_MINUTES_LIMITS) {
    if (minutes == null || minutes === '') return null;
    const parsed = Number(minutes);
    if (!Number.isFinite(parsed)) return null;
    return Math.min(limits.max, Math.max(limits.min, Math.trunc(parsed)));
}

export function toMinutes(amount, unit) {
    const parsedAmount = Number(amount);
    if (!Number.isFinite(parsedAmount) || parsedAmount <= 0) return null;
    return Math.trunc(parsedAmount) * getUnitMultiplier(unit);
}

export function fromMinutes(minutes) {
    const parsed = Number(minutes);
    if (!Number.isFinite(parsed) || parsed <= 0) {
        return { amount: '', unit: 'minutes' };
    }

    if (parsed % 1440 === 0) {
        return { amount: String(parsed / 1440), unit: 'days' };
    }

    if (parsed % 60 === 0) {
        return { amount: String(parsed / 60), unit: 'hours' };
    }

    return { amount: String(parsed), unit: 'minutes' };
}

export function formatNotificationLeadTime(minutes) {
    const parsed = Number(minutes);
    if (!Number.isFinite(parsed) || parsed <= 0) return 'sin definir';

    if (parsed % 1440 === 0) {
        const days = parsed / 1440;
        return `${days} ${days === 1 ? 'dia' : 'dias'}`;
    }

    if (parsed % 60 === 0) {
        const hours = parsed / 60;
        return `${hours} ${hours === 1 ? 'hora' : 'horas'}`;
    }

    return `${parsed} ${parsed === 1 ? 'minuto' : 'minutos'}`;
}
