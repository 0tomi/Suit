import { useMemo } from 'react';
import {
    NOTIFICATION_PRESET_OPTIONS_SHORT,
    NOTIFICATION_MINUTES_LIMITS,
    NOTIFICATION_UNITS,
} from './notificationConfig.js';
import { toMinutes } from '../../utils/notificationTimeFormat.js';

const Toggle = ({ checked, onChange, disabled }) => (
    <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${checked ? 'bg-blue-600' : 'bg-slate-300'
            } disabled:opacity-60`}
    >
        <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform duration-200 ${checked ? 'translate-x-6' : 'translate-x-1'
                }`}
        />
    </button>
);

export default function NotificationConfigSection({
    enabled,
    onEnabledChange,
    mode,
    onModeChange,
    presetMinutes,
    onPresetMinutesChange,
    customAmount,
    onCustomAmountChange,
    customUnit,
    onCustomUnitChange,
    allowOffOption = false,
    showToggle = true,
    minMinutes = NOTIFICATION_MINUTES_LIMITS.min,
    maxMinutes = NOTIFICATION_MINUTES_LIMITS.max,
    disabled = false,
    error = '',
    title = 'Notificacion',
}) {
    const presetOptions = useMemo(() => {
        const options = [...NOTIFICATION_PRESET_OPTIONS_SHORT];
        if (allowOffOption) {
            options.unshift({ value: 'off', label: 'No' });
        }
        return options;
    }, [allowOffOption]);

    const selectedValue = useMemo(() => {
        if (mode === 'custom') return 'custom';
        if (allowOffOption && presetMinutes == null) return 'off';
        return String(presetMinutes ?? NOTIFICATION_PRESET_OPTIONS_SHORT[0].value);
    }, [allowOffOption, mode, presetMinutes]);

    const computedError = useMemo(() => {
        if (!enabled || mode !== 'custom') return '';
        const totalMinutes = toMinutes(customAmount, customUnit);
        if (!customAmount) return 'Ingresa un valor.';
        if (!Number.isFinite(Number(customAmount)) || Number(customAmount) <= 0) {
            return 'Debe ser un numero mayor a 0.';
        }
        if (totalMinutes == null || totalMinutes < minMinutes || totalMinutes > maxMinutes) {
            return `Debe estar entre ${minMinutes} y ${maxMinutes} minutos.`;
        }
        return '';
    }, [customAmount, customUnit, enabled, maxMinutes, minMinutes, mode]);

    const visibleError = error || computedError;

    const handlePresetChange = (value) => {
        if (value === 'custom') {
            onModeChange?.('custom');
            return;
        }

        onModeChange?.('preset');
        if (value === 'off') {
            onPresetMinutesChange?.(null);
            return;
        }

        onPresetMinutesChange?.(Number(value));
    };

    return (
        <div className="rounded-lg border border-(--border-default) p-3 bg-(--bg-input) space-y-3">
            <div className="flex items-center justify-between gap-3">
                <p className="text-sm font-medium text-(--text-secondary)">{title}</p>
                {showToggle && (
                    <Toggle checked={enabled} onChange={onEnabledChange} disabled={disabled} />
                )}
            </div>

            {(!showToggle || enabled) && (
                <div className="space-y-3">
                    <select
                        value={selectedValue}
                        disabled={disabled}
                        onChange={(event) => handlePresetChange(event.target.value)}
                        className="w-full px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                    >
                        {presetOptions.map((option) => (
                            <option key={option.value} value={option.value}>{option.label}</option>
                        ))}
                    </select>

                    {mode === 'custom' && (
                        <div className="flex items-center gap-2">
                            <input
                                type="number"
                                min="1"
                                disabled={disabled}
                                value={customAmount}
                                onChange={(event) => onCustomAmountChange?.(event.target.value)}
                                onKeyDown={(e) => ['e', 'E', '+', '-', '.'].includes(e.key) && e.preventDefault()}
                                className="w-28 px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                                placeholder="Valor"
                            />
                            <select
                                value={customUnit}
                                disabled={disabled}
                                onChange={(event) => onCustomUnitChange?.(event.target.value)}
                                className="flex-1 px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) text-sm focus:ring-2 focus:ring-blue-500 outline-none disabled:opacity-60"
                            >
                                {NOTIFICATION_UNITS.map((unit) => (
                                    <option key={unit.value} value={unit.value}>{unit.label}</option>
                                ))}
                            </select>
                        </div>
                    )}

                    {visibleError && (
                        <p className="text-xs text-red-600">{visibleError}</p>
                    )}
                </div>
            )}
        </div>
    );
}

