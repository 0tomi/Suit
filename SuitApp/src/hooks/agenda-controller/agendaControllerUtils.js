import { NOTIFICATION_MINUTES_LIMITS } from '../../components/Agenda/notificationConfig.js';
import { fromMinutes, toMinutes } from '../../utils/notificationTimeFormat.js';

export const DEFAULT_LAST_NOTIFICATION_MINUTES = 15;
const PRESET_MINUTES = new Set([15, 60, 1440]);

export const formDataEmpty = {
    title: '',
    date: '',
    time: '',
    description: '',
    agendaId: '',
    caseId: '',
    eventTypeId: '1',
    notifyEnabled: false,
    notifyMode: 'preset',
    notifyPresetMinutes: DEFAULT_LAST_NOTIFICATION_MINUTES,
    notifyCustomAmount: '',
    notifyCustomUnit: 'minutes',
    notifyLoading: false,
    notifyLoaded: true,
    notifyExisting: false,
    notifyAt: null,
    notifyDate: null,
    notifyTime: null,
};

export function buildNotificationSelection(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return {
            notifyMode: 'preset',
            notifyPresetMinutes: DEFAULT_LAST_NOTIFICATION_MINUTES,
            notifyCustomAmount: '',
            notifyCustomUnit: 'minutes',
        };
    }

    if (PRESET_MINUTES.has(minutes)) {
        return {
            notifyMode: 'preset',
            notifyPresetMinutes: minutes,
            notifyCustomAmount: '',
            notifyCustomUnit: 'minutes',
        };
    }

    const custom = fromMinutes(minutes);
    return {
        notifyMode: 'custom',
        notifyPresetMinutes: DEFAULT_LAST_NOTIFICATION_MINUTES,
        notifyCustomAmount: custom.amount,
        notifyCustomUnit: custom.unit,
    };
}

export function resolveNotificationMinutes(formData) {
    if (!formData.notifyEnabled) {
        return { ok: true, minutes: null };
    }

    if (formData.notifyMode === 'custom') {
        const minutes = toMinutes(formData.notifyCustomAmount, formData.notifyCustomUnit);
        if (minutes == null) {
            return { ok: false, error: 'El recordatorio personalizado debe ser un numero mayor a 0.' };
        }

        if (minutes < NOTIFICATION_MINUTES_LIMITS.min || minutes > NOTIFICATION_MINUTES_LIMITS.max) {
            return {
                ok: false,
                error: `El recordatorio debe estar entre ${NOTIFICATION_MINUTES_LIMITS.min} y ${NOTIFICATION_MINUTES_LIMITS.max} minutos.`,
            };
        }

        return { ok: true, minutes };
    }

    const minutes = Number(formData.notifyPresetMinutes);
    if (!Number.isFinite(minutes)) {
        return { ok: false, error: 'Selecciona un recordatorio valido.' };
    }

    if (minutes < NOTIFICATION_MINUTES_LIMITS.min || minutes > NOTIFICATION_MINUTES_LIMITS.max) {
        return {
            ok: false,
            error: `El recordatorio debe estar entre ${NOTIFICATION_MINUTES_LIMITS.min} y ${NOTIFICATION_MINUTES_LIMITS.max} minutos.`,
        };
    }

    return { ok: true, minutes };
}

export function extractCreatedEventId(payload) {
    const candidates = [
        payload?.id,
        payload?.event_id,
        payload?.eventId,
        payload?.data?.id,
        payload?.data?.event_id,
        payload?.data?.eventId,
    ];

    for (const candidate of candidates) {
        const parsed = Number(candidate);
        if (Number.isFinite(parsed) && parsed > 0) return parsed;
    }

    return null;
}

export function buildEventSummary(title, startsAt, isAllDay) {
    // Extraer date y time del starts_at naive ("YYYY-MM-DDTHH:mm:ss")
    const raw = String(startsAt || '');
    const [datePart = '', timePart = ''] = raw.split('T');
    const [year = '', month = '', day = ''] = datePart.split('-');
    const formattedDate = day && month && year ? `${day}/${month}/${year}` : datePart;
    const formattedTime = isAllDay ? 'Todo el día' : (timePart.slice(0, 5) || '00:00');
    return isAllDay
        ? `${title} - ${formattedDate}`
        : `${title} - ${formattedDate} a las ${formattedTime} hs`;
}
