import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { HotkeysProvider } from '../../src/hotkeys/HotkeysProvider.jsx';

const createEventEntryMock = vi.fn();
const updateEventEntryMock = vi.fn();
const deleteEventEntryMock = vi.fn();
const sileoShowMock = vi.fn();

let eventsState = {
    events: [],
    agendas: [],
    refreshEvents: vi.fn(),
    createEventEntry: vi.fn(),
    updateEventEntry: vi.fn(),
    deleteEventEntry: vi.fn(),
};
let authState = { user: { id: 1, name: 'Ana', tag: 'ana' } };
let settingsState = {
    agendaColorMode: 'eventType',
    personalEventColor: '#3b82f6',
    defaultEventNotificationMinutes: null,
    lastEventNotificationMinutes: 15,
    setLastEventNotificationMinutes: vi.fn(),
};
let eventTypesState = { event_types: [] };
let caseTypesState = { case_types: [] };
let casesState = { cases: [] };
let usersState = { users: [] };

vi.mock('react-big-calendar', () => ({
    dayjsLocalizer: () => ({}),
    Calendar: ({ events, onSelectSlot, onSelectEvent, components, eventPropGetter }) => (
        <div>
            <div data-testid="calendar-count">{events.length}</div>
            <button onClick={() => onSelectSlot({ start: new Date('2026-03-02T10:00:00') })}>calendar-slot</button>
            {events.map((event) => (
                <div key={event.id}>
                    <button onClick={() => onSelectEvent(event)}>{`calendar-event-${event.id}`}</button>
                    <span data-testid={`event-color-${event.id}`}>{eventPropGetter?.(event)?.style?.backgroundColor || ''}</span>
                    {components?.event ? components.event({ event }) : <span>{event.title}</span>}
                </div>
            ))}
        </div>
    ),
}));

vi.mock('../../src/context/EventsContext.jsx', () => ({
    useEvents: () => eventsState,
}));

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/context/UsersContext.jsx', () => ({
    useUsers: () => usersState,
}));

vi.mock('../../src/context/SettingsContext.jsx', () => ({
    useSettings: () => settingsState,
}));

vi.mock('../../src/context/EventTypesContext.jsx', () => ({
    useEventTypes: () => eventTypesState,
}));

vi.mock('../../src/context/CaseTypesContext.jsx', () => ({
    useCaseTypes: () => caseTypesState,
}));

vi.mock('../../src/context/UsersContext.jsx', () => ({
    useUsers: () => usersState,
}));

vi.mock('../../src/context/CasesContext.jsx', () => ({
    useCases: () => casesState,
}));

vi.mock('../../src/hooks/useConfirmDialog', () => ({
    useConfirmDialog: () => ({
        dialogProps: {},
        openDialog: vi.fn(),
        closeDialog: vi.fn(),
    }),
}));

vi.mock('../../src/services/eventNotificationService.js', () => ({
    getNotification: vi.fn().mockResolvedValue(null),
    createNotification: vi.fn(),
    deleteNotification: vi.fn(),
}));

vi.mock('../../src/components/Agenda/AgendaToolbar.jsx', () => ({
    default: ({ onView }) => (
        <button onClick={() => onView('year')}>toolbar-year</button>
    ),
}));

vi.mock('../../src/components/Agenda/AgendaFilterSelect.jsx', () => ({
    default: ({ setSelectedFilterAgenda }) => (
        <button onClick={() => setSelectedFilterAgenda('2')}>filter-agenda-2</button>
    ),
}));

vi.mock('../../src/components/Agenda/AgendaYearView.jsx', () => ({
    default: ({ events }) => <div data-testid="year-view">{events.length}</div>,
}));

vi.mock('../../src/components/Agenda/AgendaEventModal.jsx', () => ({
    default: ({ modalOpen, selectedEvent, formData, setFormData, handleSave, handleDelete }) => {
        if (!modalOpen) return null;

        return (
            <div data-testid="agenda-modal">
                <div>{selectedEvent ? 'edit' : 'new'}</div>
                <button
                    onClick={() => setFormData({
                        ...formData,
                        title: 'Audiencia',
                        date: '2026-03-02',
                        time: '10:00',
                        agendaId: formData.agendaId || '1',
                    })}
                >
                    fill-modal
                </button>
                <button onClick={handleSave}>modal-save</button>
                <button onClick={handleDelete}>modal-delete</button>
            </div>
        );
    },
}));

vi.mock('../../src/components/Agenda/EventNotificationModal.jsx', () => ({
    default: ({ eventTitle, onClose }) => (
        <div>
            <div data-testid="notification-modal">{eventTitle}</div>
            <button onClick={onClose}>close-notification</button>
        </div>
    ),
}));

vi.mock('../../src/components/ui/ConfirmDialog.jsx', () => ({
    ConfirmDialog: () => null,
}));

vi.mock('sileo', () => ({
    sileo: {
        show: (...args) => sileoShowMock(...args),
    },
}));

import AgendaComponent from '../../src/components/Agenda/AgendaComponent.jsx';

function renderAgenda(props = {}) {
    return render(
        <MemoryRouter>
            <HotkeysProvider>
                <AgendaComponent {...props} />
            </HotkeysProvider>
        </MemoryRouter>,
    );
}

describe('AgendaComponent', () => {
    beforeEach(() => {
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: vi.fn().mockReturnValue(null),
                setItem: vi.fn(),
                removeItem: vi.fn(),
            },
            configurable: true,
        });
        createEventEntryMock.mockReset();
        updateEventEntryMock.mockReset();
        deleteEventEntryMock.mockReset();
        sileoShowMock.mockReset();

        eventsState = {
            events: [
                { id: 1, title: 'Audiencia', starts_at: '2099-03-02T09:00:00', is_all_day: 0, agenda_id: 1, suit_case_id: null, event_type_id: 1, notification_id: 11 },
                { id: 2, title: 'Reunion', starts_at: '2099-03-03T10:00:00', is_all_day: 0, agenda_id: 2, suit_case_id: null, event_type_id: 1 },
            ],
            agendas: [
                { id: 1, suit_case_id: null, name: 'Personal' },
                { id: 2, suit_case_id: null, name: 'Secundaria' },
            ],
            refreshEvents: vi.fn().mockResolvedValue(undefined),
            createEventEntry: createEventEntryMock,
            updateEventEntry: updateEventEntryMock,
            deleteEventEntry: deleteEventEntryMock,
        };
        authState = { user: { id: 1, name: 'Ana', tag: 'ana' } };
        settingsState = {
            agendaColorMode: 'eventType',
            personalEventColor: '#3b82f6',
            defaultEventNotificationMinutes: null,
            lastEventNotificationMinutes: 15,
            setLastEventNotificationMinutes: vi.fn(),
        };
        eventTypesState = { event_types: [{ id: 1, color: '#ef4444' }] };
        caseTypesState = { case_types: [] };
        casesState = { cases: [] };
        usersState = { users: [] };
    });

    it('crea un evento desde el modal sin refresh destructivo', async () => {
        createEventEntryMock.mockResolvedValue({ ok: true, event: { id: 999 }, queued: false });

        renderAgenda();

        fireEvent.click(screen.getByRole('button', { name: 'Nuevo Evento' }));
        expect(screen.getByTestId('agenda-modal')).toBeInTheDocument();

        fireEvent.click(screen.getByText('fill-modal'));
        fireEvent.click(screen.getByText('modal-save'));

        await waitFor(() => {
            expect(createEventEntryMock).toHaveBeenCalledWith({
                eventPayload: {
                    title: 'Audiencia',
                    starts_at: '2026-03-02T10:00:00Z',
                    is_all_day: false,
                    description: null,
                    agenda_id: 1,
                    suit_case_id: null,
                    event_type_id: 1,
                },
                notificationIntent: { action: 'none', minutes: null },
                syncAgendaId: 'ALL',
            });
            expect(eventsState.refreshEvents).not.toHaveBeenCalled();
            expect(sileoShowMock).toHaveBeenCalledTimes(1);
        });
    });

    it('filtra eventos y abre modal de notificacion', async () => {
        renderAgenda();

        expect(screen.getByTestId('calendar-count')).toHaveTextContent('2');

        fireEvent.click(screen.getByText('filter-agenda-2'));
        expect(screen.getByTestId('calendar-count')).toHaveTextContent('1');

        fireEvent.click(screen.getByTitle('Notificación'));
        expect(screen.getByTestId('notification-modal')).toHaveTextContent('Reunion');
    });

    it('abre un evento existente y permite eliminarlo', async () => {
        deleteEventEntryMock.mockResolvedValue({ ok: true });

        renderAgenda();

        fireEvent.click(screen.getByText('calendar-event-1'));
        expect(screen.getByTestId('agenda-modal')).toHaveTextContent('edit');

        fireEvent.click(screen.getByText('modal-delete'));

        await waitFor(() => {
            expect(deleteEventEntryMock).toHaveBeenCalledWith({
                eventId: 1,
                isPending: false,
            });
            expect(eventsState.refreshEvents).not.toHaveBeenCalled();
            expect(sileoShowMock).toHaveBeenCalledTimes(1);
        });
    });

    it('oculta el boton de notificacion para eventos pasados', async () => {
        eventsState = {
            ...eventsState,
            events: [
                { id: 3, title: 'Vencido', starts_at: '2000-01-01T09:00:00', is_all_day: 0, agenda_id: 1, suit_case_id: null, event_type_id: 1 },
            ],
        };

        renderAgenda();

        expect(screen.queryByTitle('Notificación')).not.toBeInTheDocument();
    });

    it('en modo caseType usa el color del tipo de caso cuando llega suit_case_id', async () => {
        settingsState = {
            ...settingsState,
            agendaColorMode: 'caseType',
        };
        eventsState = {
            ...eventsState,
            events: [
                { id: 101, title: 'Evento caso', date: '2099-03-02', time: '09:00', agenda_id: 1, suit_case_id: 77, event_type_id: 1 },
            ],
        };
        caseTypesState = { case_types: [{ id: 5, eventColor: '#bc1010' }] };
        casesState = { cases: [{ id: 77, case_type_id: 5 }] };

        renderAgenda();

        await waitFor(() => {
            expect(screen.getByTestId('event-color-101')).toHaveTextContent('#bc1010');
        });
    });

    it('evento personal usa siempre personalEventColor sin depender del modo', async () => {
        settingsState = {
            ...settingsState,
            agendaColorMode: 'eventType',
            personalEventColor: '#112233',
        };
        eventTypesState = { event_types: [{ id: 1, color: '#ef4444' }] };
        eventsState = {
            ...eventsState,
            events: [
                { id: 201, title: 'Personal', date: '2099-03-02', time: '09:00', agenda_id: 1, suit_case_id: null, event_type_id: 1 },
            ],
        };

        renderAgenda();

        await waitFor(() => {
            expect(screen.getByTestId('event-color-201')).toHaveTextContent('#112233');
        });
    });

    it('reutiliza la cache del caso y evita el refresh inicial cuando el sync ya valido eventos', async () => {
        eventsState = {
            ...eventsState,
            agendas: [
                { id: 10, suit_case_id: 55, name: 'Agenda del caso' },
            ],
            events: [
                { id: 7, title: 'Audiencia caso', starts_at: '2099-03-02T09:00:00', is_all_day: 0, agenda_id: 10, suit_case_id: 55, event_type_id: 1 },
            ],
            refreshEvents: vi.fn().mockResolvedValue(undefined),
        };
        casesState = { cases: [{ id: 55, title: 'Caso 55' }] };

        renderAgenda({ caseId: 55, caseSyncReady: true });

        await waitFor(() => {
            expect(screen.getByTestId('calendar-count')).toHaveTextContent('1');
        });

        expect(eventsState.refreshEvents).not.toHaveBeenCalled();
    });
});
