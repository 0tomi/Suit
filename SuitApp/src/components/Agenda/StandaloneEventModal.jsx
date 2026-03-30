import { useEffect, useRef } from 'react';
import { useEvents } from '../../context/EventsContext.jsx';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext.jsx';
import { useAgendaController } from '../../hooks/useAgendaController.js';
import { useSettings } from '../../context/SettingsContext';
import { useCases } from '../../context/CasesContext';
import AgendaEventModal from './AgendaEventModal';

/**
 * A self-contained, reusable modal for creating and editing events.
 * It encapsulates the logic for fetching data, controlling the form state,
 * and handling save/update/delete actions.
 *
 * It's designed to be called from anywhere using `useModal().openModal()`.
 *
 * @param {object} props
 * @param {object} [props.event] - The event object to edit. If not provided, the modal opens in create mode.
 * @param {number|string|null} [props.caseId] - Caso a fijar cuando se crea un evento desde un contexto asociado.
 * @param {number|string|null} [props.agendaId] - Agenda preferida para abrir el formulario de alta.
 * @param {function} [props.onSuccess] - Callback executed with the created/updated event data.
 * @param {function} props.closeModal - Function provided by ModalContext to close itself.
 */
export function StandaloneEventModal({ event = null, caseId = null, agendaId = null, onSuccess, closeModal }) {
    const {
        agendas,
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
    } = useEvents();
    const { user } = useAuth();
    const { users } = useUsers();
    const {
        defaultAgendaView,
        defaultEventNotificationMinutes,
        lastEventNotificationMinutes,
        setLastEventNotificationMinutes,
    } = useSettings();
    const { cases } = useCases();

    const controller = useAgendaController({
        agendas,
        cases,
        caseId: event?.caseId || caseId || null,
        preferredAgendaId: event?.agendaId || event?.agenda_id || agendaId || null,
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
        currentUserId: user?.id || null,
        defaultAgendaView,
        defaultEventNotificationMinutes,
        lastEventNotificationMinutes,
        setLastEventNotificationMinutes,
    });
    const openedRef = useRef(false);

    useEffect(() => {
        if (event) {
            controller.openEditEvent(event, { onSuccess });
        } else {
            controller.openNewEventAtDate(new Date(), { onSuccess });
        }
        openedRef.current = true;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run only on mount

    // The controller's modal state is now the source of truth
    const { modal } = controller;

    // When the internal state of the controller closes the modal,
    // we must call the closeModal from the global context to unmount this component.
    useEffect(() => {
        if (openedRef.current && !modal.modalOpen) {
            closeModal();
        }
    }, [modal.modalOpen, closeModal]);

    if (!modal.modalOpen) {
        // Render nothing while closing.
        return null;
    }

    return (
        <AgendaEventModal
            modalOpen={modal.modalOpen}
            setModalOpen={(open) => { if (!open) controller.closeModal(); }}
            selectedEvent={modal.selectedEvent}
            formData={modal.formData}
            setFormData={controller.updateFormData}
            saving={modal.saving}
            agendas={agendas}
            cases={cases}
            user={user}
            users={users}
            handleSave={controller.saveEvent}
            handleDelete={controller.deleteEvent}
            setNotificationEnabled={controller.setNotificationEnabled}
            setNotificationMode={controller.setNotificationMode}
            setNotificationPresetMinutes={controller.setNotificationPresetMinutes}
            setNotificationCustomAmount={controller.setNotificationCustomAmount}
            setNotificationCustomUnit={controller.setNotificationCustomUnit}
            error={modal.error}
            onDismissError={controller.clearModalError}
        />
    );
}
