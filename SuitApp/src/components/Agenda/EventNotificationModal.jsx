import { useEffect, useReducer } from 'react';
import { Bell, Loader2, Save, X } from 'lucide-react';
import { useSettings } from '../../context/SettingsContext.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';
import NotificationConfigSection from './NotificationConfigSection.jsx';
import { NOTIFICATION_MINUTES_LIMITS } from './notificationConfig.js';
import { clampNotificationMinutes, formatNotificationLeadTime, fromMinutes, toMinutes } from '../../utils/notificationTimeFormat.js';
import {
    createNotification,
    deleteNotification,
    getNotification,
    updateNotification,
} from '../../services/eventNotificationService.js';
import { createLogger } from '../../services/logService.js';

const PRESET_MINUTES = new Set([15, 60, 1440]);
const logger = createLogger('event-notification-modal');
const INITIAL_STATE = {
    loading: true,
    saving: false,
    editing: false,
    hasNotification: false,
    notificationMinutes: null,
    mode: 'preset',
    presetMinutes: 15,
    customAmount: '',
    customUnit: 'minutes',
    error: '',
    notifyDate: null,
    notifyTime: null,
};

function buildEditorState(minutes) {
    if (!Number.isFinite(minutes) || minutes <= 0) {
        return {
            mode: 'preset',
            presetMinutes: 15,
            customAmount: '',
            customUnit: 'minutes',
        };
    }

    if (PRESET_MINUTES.has(minutes)) {
        return {
            mode: 'preset',
            presetMinutes: minutes,
            customAmount: '',
            customUnit: 'minutes',
        };
    }

    const custom = fromMinutes(minutes);
    return {
        mode: 'custom',
        presetMinutes: 15,
        customAmount: custom.amount,
        customUnit: custom.unit,
    };
}

function notificationReducer(state, action) {
    switch (action.type) {
        case 'LOAD_START':
            return {
                ...state,
                loading: true,
                editing: false,
            };
        case 'LOAD_RESULT':
            return {
                ...state,
                loading: false,
                editing: false,
                hasNotification: action.payload.hasNotification,
                notificationMinutes: action.payload.notificationMinutes,
                mode: action.payload.mode,
                presetMinutes: action.payload.presetMinutes,
                customAmount: action.payload.customAmount,
                customUnit: action.payload.customUnit,
                notifyDate: action.payload.notifyDate ?? null,
                notifyTime: action.payload.notifyTime ?? null,
                error: '',
            };
        case 'START_EDIT':
            return {
                ...state,
                editing: true,
                error: '',
                mode: action.payload.mode,
                presetMinutes: action.payload.presetMinutes,
                customAmount: action.payload.customAmount,
                customUnit: action.payload.customUnit,
            };
        case 'CANCEL_EDIT':
            return {
                ...state,
                editing: false,
                error: '',
            };
        case 'SET_MODE':
            return { ...state, mode: action.payload };
        case 'SET_PRESET_MINUTES':
            return { ...state, presetMinutes: action.payload };
        case 'SET_CUSTOM_AMOUNT':
            return { ...state, customAmount: action.payload };
        case 'SET_CUSTOM_UNIT':
            return { ...state, customUnit: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        case 'SAVE_START':
            return { ...state, saving: true };
        case 'SAVE_END':
            return { ...state, saving: false };
        case 'SAVE_SUCCESS':
            return {
                ...state,
                saving: false,
                editing: false,
                hasNotification: true,
                notificationMinutes: action.payload,
                notifyDate: null,
                notifyTime: null,
                error: '',
            };
        case 'DISABLE_SUCCESS':
            return {
                ...state,
                saving: false,
                editing: false,
                hasNotification: false,
                notificationMinutes: null,
                notifyDate: null,
                notifyTime: null,
                error: '',
            };
        default:
            return state;
    }
}

export default function EventNotificationModal({ eventId, eventTitle, onClose, onSuccess }) {
    const { lastEventNotificationMinutes, setLastEventNotificationMinutes } = useSettings();
    const [state, dispatch] = useReducer(notificationReducer, INITIAL_STATE);

    useEffect(() => {
        let mounted = true;
        dispatch({ type: 'LOAD_START' });

        getNotification(eventId).then((data) => {
            if (!mounted) return;

            const rawMinutes = Number(data?.minutes ?? data?.when_to_notify_minutes);
            if (!data?.enabled) {
                const seed = clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS) || 15;
                dispatch({
                    type: 'LOAD_RESULT',
                        payload: {
                            hasNotification: false,
                            notificationMinutes: null,
                        notifyDate: null,
                        notifyTime: null,
                        ...buildEditorState(seed),
                    },
                });
                return;
            }

            if (!Number.isFinite(rawMinutes)) {
                const seed = clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS) || 15;
                dispatch({
                    type: 'LOAD_RESULT',
                    payload: {
                        hasNotification: true,
                        notificationMinutes: null,
                        notifyDate: data.notifyDate ?? null,
                        notifyTime: data.notifyTime ?? null,
                        ...buildEditorState(seed),
                    },
                });
                return;
            }

            const clamped = clampNotificationMinutes(rawMinutes, NOTIFICATION_MINUTES_LIMITS);
            if (clamped == null) {
                dispatch({
                    type: 'LOAD_RESULT',
                    payload: {
                        hasNotification: true,
                        notificationMinutes: null,
                        notifyDate: data.notifyDate ?? null,
                        notifyTime: data.notifyTime ?? null,
                        ...buildEditorState(clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS) || 15),
                    },
                });
                return;
            }

            if (clamped !== rawMinutes) {
                showAppToast({
                    title: 'Recordatorio ajustado',
                    description: `El valor estaba fuera de rango y se ajusto al rango ${NOTIFICATION_MINUTES_LIMITS.min}-${NOTIFICATION_MINUTES_LIMITS.max} minutos.`,
                    variant: 'warning',
                });
            }

            dispatch({
                type: 'LOAD_RESULT',
                payload: {
                    hasNotification: true,
                    notificationMinutes: clamped,
                    notifyDate: data.notifyDate ?? null,
                    notifyTime: data.notifyTime ?? null,
                    ...buildEditorState(clamped),
                },
            });
        }).catch((err) => {
            void logger.error('Error fetching notification', err);
            showAppToast({
                title: 'No se pudo cargar la notificacion',
                description: 'Intenta nuevamente.',
                variant: 'danger',
            });
            if (mounted) {
                dispatch({
                    type: 'LOAD_RESULT',
                    payload: {
                        hasNotification: false,
                        notificationMinutes: null,
                        ...buildEditorState(clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS) || 15),
                    },
                });
            }
        }).finally(() => {
            if (!mounted) return;
        });

        return () => { mounted = false; };
    // Solo recargamos al cambiar de evento. Si dependemos también del "último valor usado"
    // terminamos re-leyendo una config stale justo después de guardar y pisamos el estado local.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [eventId]);

    const startEditing = () => {
        const seedMinutes = state.hasNotification
            ? state.notificationMinutes
            : (clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS) || 15);
        dispatch({ type: 'START_EDIT', payload: buildEditorState(seedMinutes) });
    };

    const resolveEditorMinutes = () => {
        if (state.mode !== 'custom') {
            const value = Number(state.presetMinutes);
            if (!Number.isFinite(value)) return { ok: false, error: 'Selecciona una opcion valida.' };
            return { ok: true, minutes: value };
        }

        const value = toMinutes(state.customAmount, state.customUnit);
        if (value == null) {
            return { ok: false, error: 'El valor personalizado debe ser mayor a 0.' };
        }
        if (value < NOTIFICATION_MINUTES_LIMITS.min || value > NOTIFICATION_MINUTES_LIMITS.max) {
            return {
                ok: false,
                error: `Debe estar entre ${NOTIFICATION_MINUTES_LIMITS.min} y ${NOTIFICATION_MINUTES_LIMITS.max} minutos.`,
            };
        }

        return { ok: true, minutes: value };
    };

    const saveEditor = async (event) => {
        event.preventDefault();
        const resolved = resolveEditorMinutes();
        if (!resolved.ok) {
            dispatch({ type: 'SET_ERROR', payload: resolved.error });
            return;
        }

        dispatch({ type: 'SAVE_START' });
        dispatch({ type: 'SET_ERROR', payload: '' });
        try {
            const request = state.hasNotification
                ? updateNotification(eventId, resolved.minutes)
                : createNotification(eventId, resolved.minutes);
            const response = await request;

            if (!response.ok) {
                throw new Error(response.error || 'No se pudo guardar el recordatorio.');
            }

            setLastEventNotificationMinutes(resolved.minutes);
            dispatch({ type: 'SAVE_SUCCESS', payload: resolved.minutes });
            showAppToast({ title: 'Recordatorio guardado correctamente', variant: 'success' });
            onSuccess?.();
        } catch (err) {
            void logger.error('Save notification error', err);
            showAppToast({
                title: 'No se pudo guardar el recordatorio',
                description: 'Intenta nuevamente.',
                variant: 'danger',
            });
        } finally {
            dispatch({ type: 'SAVE_END' });
        }
    };

    const handleDisable = async () => {
        if (!state.hasNotification) return;
        dispatch({ type: 'SAVE_START' });
        try {
            const response = await deleteNotification(eventId);
            if (!response.ok) {
                throw new Error(response.error || 'No se pudo desactivar el recordatorio.');
            }

            dispatch({ type: 'DISABLE_SUCCESS' });
            showAppToast({ title: 'Recordatorio desactivado', variant: 'success' });
            onSuccess?.();
        } catch (err) {
            void logger.error('Delete notification error', err);
            showAppToast({
                title: 'No se pudo desactivar el recordatorio',
                description: 'Intenta nuevamente.',
                variant: 'danger',
            });
        } finally {
            dispatch({ type: 'SAVE_END' });
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
            <button
                type="button"
                aria-label="Cerrar modal de notificaciones"
                onClick={onClose}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <div className="relative bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h3 className="font-semibold text-gray-800 flex items-center gap-2">
                        <Bell size={18} className="text-amber-500" />
                        Notificaciones
                    </h3>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors p-1 rounded-md hover:bg-gray-200">
                        <X size={18} />
                    </button>
                </div>

                {state.loading ? (
                    <div className="flex flex-col items-center justify-center p-12 text-gray-400">
                        <Loader2 size={32} className="animate-spin mb-4" />
                        <p className="text-sm font-medium">Cargando...</p>
                    </div>
                ) : (
                    <div className="p-5 space-y-4">
                        <p className="text-sm font-medium text-gray-700 truncate" title={eventTitle}>
                            Evento: <span className="font-bold">{eventTitle || 'Sin titulo'}</span>
                        </p>

                        {!state.editing ? (
                            <div className="space-y-4">
                                <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
                                    <p className="text-sm text-gray-700">
                                        {state.hasNotification
                                            ? (
                                                state.notifyDate && state.notifyTime
                                                    ? `Se notificara el ${state.notifyDate} a las ${state.notifyTime}.`
                                                    : state.notificationMinutes != null
                                                        ? `Se notificara ${formatNotificationLeadTime(state.notificationMinutes)} antes.`
                                                        : 'Recordatorio configurado.'
                                            )
                                            : 'Notificacion desactivada.'}
                                    </p>
                                </div>

                                <div className="flex justify-between gap-2 pt-1">
                                    <div className="flex gap-2">
                                        <button
                                            type="button"
                                            onClick={startEditing}
                                            disabled={state.saving}
                                            className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg transition-colors disabled:opacity-50"
                                        >
                                            {state.hasNotification ? 'Cambiar' : 'Configurar'}
                                        </button>
                                        {state.hasNotification && (
                                            <button
                                                type="button"
                                                onClick={handleDisable}
                                                disabled={state.saving}
                                                className="px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg hover:bg-red-50 transition-colors disabled:opacity-50"
                                            >
                                                Desactivar
                                            </button>
                                        )}
                                    </div>
                                    <button
                                        type="button"
                                        onClick={onClose}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                                    >
                                        Cerrar
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={saveEditor} className="space-y-4" noValidate>
                                <NotificationConfigSection
                                    title="Cambiar recordatorio"
                                    enabled
                                    mode={state.mode}
                                    onModeChange={(value) => dispatch({ type: 'SET_MODE', payload: value })}
                                    presetMinutes={state.presetMinutes}
                                    onPresetMinutesChange={(value) => dispatch({ type: 'SET_PRESET_MINUTES', payload: value })}
                                    customAmount={state.customAmount}
                                    onCustomAmountChange={(value) => dispatch({ type: 'SET_CUSTOM_AMOUNT', payload: value })}
                                    customUnit={state.customUnit}
                                    onCustomUnitChange={(value) => dispatch({ type: 'SET_CUSTOM_UNIT', payload: value })}
                                    showToggle={false}
                                    allowOffOption={false}
                                    disabled={state.saving}
                                    error={state.error}
                                />

                                <div className="flex justify-end gap-2 pt-1">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            dispatch({ type: 'CANCEL_EDIT' });
                                        }}
                                        disabled={state.saving}
                                        className="px-4 py-2 text-sm font-medium text-gray-700 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={state.saving}
                                        className="px-4 py-2 text-sm font-medium text-white bg-amber-500 hover:bg-amber-600 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-50"
                                    >
                                        {state.saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                                        Guardar
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
