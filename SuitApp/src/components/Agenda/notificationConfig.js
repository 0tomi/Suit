export const NOTIFICATION_MINUTES_LIMITS = Object.freeze({
    min: 1,
    max: 10080,
});

export const NOTIFICATION_PRESET_OPTIONS_SHORT = Object.freeze([
    { value: 15, label: '15 min' },
    { value: 60, label: '1 hora' },
    { value: 1440, label: '1 dia' },
    { value: 'custom', label: 'Personalizado' },
]);

export const NOTIFICATION_UNITS = Object.freeze([
    { value: 'minutes', label: 'Minutos', multiplier: 1 },
    { value: 'hours', label: 'Horas', multiplier: 60 },
    { value: 'days', label: 'Dias', multiplier: 1440 },
]);

export function getUnitMultiplier(unit) {
    const match = NOTIFICATION_UNITS.find((item) => item.value === unit);
    return match?.multiplier ?? 1;
}

