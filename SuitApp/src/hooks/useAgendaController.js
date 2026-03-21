import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAgendaCalendarState } from './agenda-controller/useAgendaCalendarState.js';
import { useAgendaModalState } from './agenda-controller/useAgendaModalState.js';
import { DEFAULT_LAST_NOTIFICATION_MINUTES } from './agenda-controller/agendaControllerUtils.js';
import { useAgendaCrudActions } from './agenda-controller/useAgendaCrudActions.js';
import { ALL_AGENDAS_VIEW, normalizeDefaultAgendaView } from '../utils/agenda/defaultAgendaView.js';
import { splitVisibleAgendas } from '../utils/agenda/visibleAgendas.js';

export function useAgendaController({
    agendas,
    cases = [],
    caseId = null,
    createEventEntry = async () => ({ ok: false, error: 'createEventEntry no configurado' }),
    updateEventEntry = async () => ({ ok: false, error: 'updateEventEntry no configurado' }),
    deleteEventEntry = async () => ({ ok: false, error: 'deleteEventEntry no configurado' }),
    defaultAgendaView = ALL_AGENDAS_VIEW,
    currentUserId = null,
    defaultEventNotificationMinutes = null,
    lastEventNotificationMinutes = DEFAULT_LAST_NOTIFICATION_MINUTES,
    setLastEventNotificationMinutes = () => { },
}) {
    const {
        cal,
        setCalendarView,
        setSelectedFilterAgenda,
        handleNavigate,
        handleCalendarNavigate,
    } = useAgendaCalendarState();
    const { visibleAgendas } = useMemo(
        () => splitVisibleAgendas(agendas, cases),
        [agendas, cases],
    );

    useEffect(() => {
        if (!Array.isArray(visibleAgendas) || visibleAgendas.length === 0) return;

        // En modo caso la vista debe quedar cerrada sobre la agenda del expediente.
        if (caseId != null && caseId !== '') {
            const caseAgenda = agendas.find((agenda) => String(agenda.suit_case_id) === String(caseId));
            if (caseAgenda && String(cal.selectedFilterAgenda) !== String(caseAgenda.id)) {
                setSelectedFilterAgenda(String(caseAgenda.id));
            }
            return;
        }

        const selectedExists = cal.selectedFilterAgenda === ALL_AGENDAS_VIEW
            || visibleAgendas.some((agenda) => String(agenda.id) === String(cal.selectedFilterAgenda));
        if (selectedExists) return;

        const normalizedDefaultView = normalizeDefaultAgendaView(defaultAgendaView);
        if (normalizedDefaultView === ALL_AGENDAS_VIEW) {
            setSelectedFilterAgenda(ALL_AGENDAS_VIEW);
            return;
        }

        const preferred = visibleAgendas.find((agenda) => String(agenda.id) === normalizedDefaultView);
        if (preferred) {
            setSelectedFilterAgenda(String(preferred.id));
            return;
        }

        setSelectedFilterAgenda(ALL_AGENDAS_VIEW);
    }, [agendas, visibleAgendas, cal.selectedFilterAgenda, caseId, defaultAgendaView, setSelectedFilterAgenda]);

    const {
        modal,
        dispatchModal,
        updateFormData,
        clearModalError,
    } = useAgendaModalState();

    const [notificationModalOpen, setNotificationModalOpen] = useState(false);
    const [notificationEvent, setNotificationEvent] = useState(null);
    const [toastData, setToastData] = useState(null);

    const {
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
    } = useAgendaCrudActions({
        agendas,
        caseId,
        currentUserId,
        modal,
        dispatchModal,
        updateFormData,
        currentViewAgendaId: cal.selectedFilterAgenda,
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
        defaultEventNotificationMinutes,
        lastEventNotificationMinutes,
        setLastEventNotificationMinutes,
        setToastData,
    });

    const openNotificationModal = useCallback((event) => {
        setNotificationEvent(event);
        setNotificationModalOpen(true);
    }, []);

    const closeNotificationModal = useCallback(() => {
        setNotificationModalOpen(false);
        setNotificationEvent(null);
    }, []);

    const clearToastData = useCallback(() => {
        setToastData(null);
    }, []);

    return {
        cal,
        modal,
        notificationModalOpen,
        notificationEvent,
        toastData,
        clearToastData,
        setCalendarView,
        setSelectedFilterAgenda,
        handleNavigate,
        handleCalendarNavigate,
        openNewEventAtDate,
        openEditEvent,
        updateFormData,
        clearModalError,
        closeModal,
        saveEvent,
        deleteEvent,
        openNotificationModal,
        closeNotificationModal,
        setNotificationEnabled,
        setNotificationMode,
        setNotificationPresetMinutes,
        setNotificationCustomAmount,
        setNotificationCustomUnit,
    };
}
