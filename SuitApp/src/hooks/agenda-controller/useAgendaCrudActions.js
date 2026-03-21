import { useCallback, useMemo, useRef } from 'react';
import dayjs from 'dayjs';
import { getNotification } from '../../services/eventNotificationService.js';
import { showAppToast } from '../../components/ui/show-app-toast.jsx';
import { NOTIFICATION_MINUTES_LIMITS } from '../../components/Agenda/notificationConfig.js';
import { clampNotificationMinutes, fromMinutes, toMinutes } from '../../utils/notificationTimeFormat.js';
import { buildEventPayload } from '../../utils/agenda/buildEventPayload.js';
import { readCaseId } from '../../utils/eventNormalization.js';
import {
    buildEventSummary,
    buildNotificationSelection,
    DEFAULT_LAST_NOTIFICATION_MINUTES,
    resolveNotificationMinutes,
} from './agendaControllerUtils.js';
import { createLogger } from '../../services/logService.js';
const logger = createLogger('hook:agenda-crud-actions');

export function useAgendaCrudActions({
    agendas,
    caseId,
    currentUserId = null,
    modal,
    dispatchModal,
    updateFormData,
    currentViewAgendaId = 'ALL',
    createEventEntry = async () => ({ ok: false, error: 'createEventEntry no configurado' }),
    updateEventEntry = async () => ({ ok: false, error: 'updateEventEntry no configurado' }),
    deleteEventEntry = async () => ({ ok: false, error: 'deleteEventEntry no configurado' }),
    defaultEventNotificationMinutes = null,
    lastEventNotificationMinutes = DEFAULT_LAST_NOTIFICATION_MINUTES,
    setLastEventNotificationMinutes = () => { },
    setToastData = () => { },
}) {
    const editNotificationLoadRef = useRef(0);

    const agendasById = useMemo(
        () => new Map((agendas || []).map((agenda) => [String(agenda.id), agenda])),
        [agendas],
    );

    const hydrateEditNotification = useCallback(async (eventId) => {
        const requestId = ++editNotificationLoadRef.current;
        try {
            const data = await getNotification(eventId);
            if (requestId !== editNotificationLoadRef.current) return;

            if (!data?.enabled) {
                dispatchModal({
                    type: 'PATCH_FORM',
                    payload: {
                        notifyEnabled: false,
                        notifyExisting: false,
                        notifyLoading: false,
                        notifyLoaded: true,
                        notifyAt: null,
                        notifyDate: null,
                        notifyTime: null,
                    },
                });
                return;
            }

            const incomingMinutes = Number(data?.minutes ?? data?.when_to_notify_minutes);
            const clampedMinutes = clampNotificationMinutes(incomingMinutes, NOTIFICATION_MINUTES_LIMITS);
            if (clampedMinutes == null) {
                dispatchModal({
                    type: 'PATCH_FORM',
                    payload: {
                        notifyEnabled: true,
                        notifyExisting: true,
                        notifyLoading: false,
                        notifyLoaded: true,
                        notifyAt: data.notifyAt ?? null,
                        notifyDate: data.notifyDate ?? null,
                        notifyTime: data.notifyTime ?? null,
                    },
                });
                return;
            }

            if (incomingMinutes !== clampedMinutes) {
                showAppToast({
                    title: 'Recordatorio ajustado',
                    description: `El valor estaba fuera de rango y se ajusto al rango ${NOTIFICATION_MINUTES_LIMITS.min}-${NOTIFICATION_MINUTES_LIMITS.max} minutos.`,
                    variant: 'warning',
                });
            }

                dispatchModal({
                    type: 'PATCH_FORM',
                    payload: {
                        notifyEnabled: true,
                        ...buildNotificationSelection(clampedMinutes),
                        notifyExisting: true,
                        notifyLoading: false,
                        notifyLoaded: true,
                        notifyAt: data.notifyAt ?? null,
                        notifyDate: data.notifyDate ?? null,
                        notifyTime: data.notifyTime ?? null,
                    },
                });
            } catch (err) {
            // Carga opcional al abrir modal: si falla, el form defaultea a notifyEnabled: false
            void logger.warn('error loading event notification', err);
            if (requestId !== editNotificationLoadRef.current) return;
            dispatchModal({
                type: 'PATCH_FORM',
                payload: {
                    notifyEnabled: false,
                    notifyExisting: false,
                    notifyLoading: false,
                    notifyLoaded: true,
                    notifyAt: null,
                    notifyDate: null,
                    notifyTime: null,
                },
            });
        }
    }, [dispatchModal]);

    const openNewEventAtDate = useCallback((start) => {
        // Si la agenda está embebida en un caso, priorizamos siempre la agenda de ese expediente.
        const caseAgenda = caseId
            ? agendas.find((agenda) => String(agenda.suit_case_id) === String(caseId))
            : null;
        const personalAgenda = agendas.find((agenda) =>
            !agenda.suit_case_id && currentUserId != null && String(agenda.user_id) === String(currentUserId),
        ) || agendas.find((agenda) => !agenda.suit_case_id) || agendas[0];
        const targetAgenda = caseAgenda || personalAgenda;
        const defaultMinutes = clampNotificationMinutes(defaultEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS);
        const seedMinutes = clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS) || DEFAULT_LAST_NOTIFICATION_MINUTES;
        const notifyEnabled = defaultMinutes != null;
        const notificationState = buildNotificationSelection(notifyEnabled ? defaultMinutes : seedMinutes);

        dispatchModal({
            type: 'OPEN_NEW',
            payload: {
                title: '',
                date: dayjs(start).format('YYYY-MM-DD'),
                time: dayjs(start).format('HH:mm'),
                description: '',
                agendaId: targetAgenda?.id || '',
                caseId: caseId || targetAgenda?.suit_case_id || '',
                eventTypeId: '1',
                notifyEnabled,
                ...notificationState,
                notifyLoading: false,
                notifyLoaded: true,
                notifyExisting: false,
                notifyAt: null,
                notifyDate: null,
                notifyTime: null,
            },
        });
    }, [agendas, caseId, currentUserId, defaultEventNotificationMinutes, dispatchModal, lastEventNotificationMinutes]);

    const openEditEvent = useCallback((event) => {
        const seedMinutes = clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS) || DEFAULT_LAST_NOTIFICATION_MINUTES;
        const eventAgenda = agendasById.get(String(event.agendaId || event.agenda_id));

        dispatchModal({
            type: 'OPEN_EDIT',
            payload: {
                event,
                formData: {
                    title: event.title,
                    date: dayjs(event.start).format('YYYY-MM-DD'),
                    time: event.allDay ? '' : dayjs(event.start).format('HH:mm'),
                    description: event.description || '',
                    agendaId: event.agendaId || event.agenda_id || '',
                    caseId: event.caseId || event.suitCaseId || readCaseId(event) || eventAgenda?.suit_case_id || '',
                    eventTypeId: String(event.eventTypeId || event.event_type_id || '1'),
                    notifyEnabled: false,
                    ...buildNotificationSelection(seedMinutes),
                    notifyLoading: true,
                    notifyLoaded: false,
                    notifyExisting: false,
                    notifyAt: null,
                    notifyDate: null,
                    notifyTime: null,
                },
            },
        });

        hydrateEditNotification(event.id);
    }, [agendasById, dispatchModal, hydrateEditNotification, lastEventNotificationMinutes]);

    const closeModal = useCallback(() => {
        editNotificationLoadRef.current += 1;
        dispatchModal({ type: 'CLOSE' });
    }, [dispatchModal]);

    const setNotificationEnabled = useCallback((enabled) => {
        if (!enabled) {
            updateFormData({
                ...modal.formData,
                notifyEnabled: false,
                notifyAt: null,
                notifyDate: null,
                notifyTime: null,
            });
            return;
        }

        const seedMinutes = clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS) || DEFAULT_LAST_NOTIFICATION_MINUTES;
        updateFormData({
            ...modal.formData,
            notifyEnabled: true,
            ...buildNotificationSelection(seedMinutes),
        });
    }, [lastEventNotificationMinutes, modal.formData, updateFormData]);

    const setNotificationMode = useCallback((mode) => {
        if (mode === 'custom') {
            const seed = toMinutes(modal.formData.notifyCustomAmount, modal.formData.notifyCustomUnit)
                || Number(modal.formData.notifyPresetMinutes)
                || clampNotificationMinutes(lastEventNotificationMinutes, NOTIFICATION_MINUTES_LIMITS)
                || DEFAULT_LAST_NOTIFICATION_MINUTES;
            const custom = fromMinutes(seed);
            updateFormData({
                ...modal.formData,
                notifyMode: 'custom',
                notifyCustomAmount: custom.amount,
                notifyCustomUnit: custom.unit,
            });
            return;
        }

        updateFormData({
            ...modal.formData,
            notifyMode: 'preset',
        });
    }, [lastEventNotificationMinutes, modal.formData, updateFormData]);

    const setNotificationPresetMinutes = useCallback((minutes) => {
        updateFormData({
            ...modal.formData,
            notifyMode: 'preset',
            notifyPresetMinutes: Number(minutes),
        });
    }, [modal.formData, updateFormData]);

    const setNotificationCustomAmount = useCallback((amount) => {
        updateFormData({
            ...modal.formData,
            notifyMode: 'custom',
            notifyCustomAmount: amount,
        });
    }, [modal.formData, updateFormData]);

    const setNotificationCustomUnit = useCallback((unit) => {
        updateFormData({
            ...modal.formData,
            notifyMode: 'custom',
            notifyCustomUnit: unit,
        });
    }, [modal.formData, updateFormData]);

    const saveEvent = useCallback(async () => {
        if (!modal.formData.title || !modal.formData.date) return;

        const notificationResolution = resolveNotificationMinutes(modal.formData);
        if (!notificationResolution.ok) {
            dispatchModal({ type: 'SET_ERROR', payload: notificationResolution.error });
            return;
        }

        dispatchModal({ type: 'SET_SAVING', payload: true });

        const payload = buildEventPayload(modal.formData, agendasById);
        const targetMinutes = notificationResolution.minutes;
        const notificationIntent = targetMinutes != null
            ? { action: 'upsert', minutes: targetMinutes }
            : (modal.formData.notifyExisting ? { action: 'delete', minutes: null } : { action: 'none', minutes: null });

        let result;
        try {
            if (modal.selectedEvent) {
                result = await updateEventEntry({
                    eventId: modal.selectedEvent.id,
                    eventPayload: payload,
                    notificationIntent,
                    isPending: modal.selectedEvent?.pending_sync === true && Number(modal.selectedEvent?.id) < 0,
                });
            } else {
                result = await createEventEntry({
                    eventPayload: payload,
                    notificationIntent,
                    syncAgendaId: currentViewAgendaId || 'ALL',
                });
            }
        } catch (err) {
            void logger.error('error saving event', err);
            dispatchModal({ type: 'SET_ERROR', payload: err.message });
            return;
        }

        if (!result?.ok) {
            dispatchModal({ type: 'SET_ERROR', payload: result?.error || 'No se pudo guardar el evento.' });
            return;
        }

        if (targetMinutes != null) {
            setLastEventNotificationMinutes(targetMinutes);
        }

        dispatchModal({ type: 'CLOSE' });

        if (modal.selectedEvent) {
            setToastData({
                title: result.queued ? 'Evento pendiente actualizado' : 'Evento actualizado',
                description: buildEventSummary(payload.title, payload.starts_at, payload.is_all_day),
                variant: result.queued ? 'warning' : 'success',
            });
        } else if (result.offline) {
            setToastData({
                title: 'Evento guardado sin conexion',
                description: 'Se mostrara ahora y se sincronizara automaticamente al reconectar.',
                variant: 'warning',
            });
        } else {
            setToastData({
                title: 'Evento creado',
                description: buildEventSummary(payload.title, payload.starts_at, payload.is_all_day),
                variant: 'success',
            });
        }

        if (result.notificationWarning) {
            showAppToast({
                title: 'Evento guardado con advertencia',
                description: result.notificationWarning,
                variant: 'warning',
            });
        }
    }, [
        agendasById,
        createEventEntry,
        currentViewAgendaId,
        dispatchModal,
        modal.formData,
        modal.selectedEvent,
        setLastEventNotificationMinutes,
        setToastData,
        updateEventEntry,
    ]);

    const deleteEvent = useCallback(async () => {
        if (!modal.selectedEvent) return;

        dispatchModal({ type: 'SET_SAVING', payload: true });

        try {
            const result = await deleteEventEntry({
                eventId: modal.selectedEvent.id,
                isPending: modal.selectedEvent?.pending_sync === true && Number(modal.selectedEvent?.id) < 0,
            });
            if (!result.ok) throw new Error(result.error || 'Error al eliminar');

            setToastData({
                title: 'Evento eliminado correctamente',
                description: modal.selectedEvent.title || 'El evento se elimino correctamente.',
                variant: 'success',
            });

            dispatchModal({ type: 'CLOSE' });
        } catch (err) {
            void logger.error('error deleting event', err);
            dispatchModal({ type: 'SET_ERROR', payload: err.message });
        }
    }, [deleteEventEntry, dispatchModal, modal.selectedEvent, setToastData]);

    return {
        openNewEventAtDate,
        openEditEvent,
        closeModal,
        setNotificationEnabled,
        setNotificationMode,
        setNotificationPresetMinutes,
        setNotificationCustomAmount,
        setNotificationCustomUnit,
        saveEvent,
        deleteEvent,
    };
}
