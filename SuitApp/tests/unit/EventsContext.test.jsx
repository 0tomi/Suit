import React, { StrictMode, useEffect } from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let authState = { user: { id: 1, tag: 'test' }, authEpoch: 1 };
let apiState = { connected: false };
const setSyncStatus = vi.fn();
const syncAgendaEventsForView = vi.fn().mockResolvedValue(undefined);
const syncAllNotifications = vi.fn().mockResolvedValue(undefined);
const syncEventNotifications = vi.fn().mockResolvedValue(undefined);
const notificationsRefresh = vi.fn().mockResolvedValue(undefined);
const createNotification = vi.fn();
const createRemoteEvent = vi.fn();
const updateRemoteEvent = vi.fn();

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/context/ApiContext.jsx', () => ({
    useApi: () => apiState,
}));

vi.mock('../../src/context/SyncStatusContext.jsx', () => ({
    useSyncStatus: () => ({ setSyncStatus }),
}));

vi.mock('../../src/services/sync/agendaMonthSyncService.js', () => ({
    syncAgendaEventsForView: (...args) => syncAgendaEventsForView(...args),
}));

vi.mock('../../src/services/eventNotificationService.js', () => ({
    syncAllNotifications: (...args) => syncAllNotifications(...args),
    syncEventNotifications: (...args) => syncEventNotifications(...args),
    createNotification: (...args) => createNotification(...args),
    deleteNotification: vi.fn(),
}));

vi.mock('../../src/services/eventService.js', () => ({
    createEvent: (...args) => createRemoteEvent(...args),
    updateEvent: (...args) => updateRemoteEvent(...args),
}));

import { EventsProvider, useEvents } from '../../src/context/EventsContext.jsx';

function createElectronApiMock() {
        return {
            db: {
                getAll: vi.fn(async (table) => {
                if (table === 'events') {
                    return [
                        {
                            id: 1,
                            title: 'Audiencia de prueba',
                            data_json: JSON.stringify({ id: 1, title: 'Audiencia de prueba' }),
                        },
                    ];
                }

                if (table === 'agendas') {
                    return [
                        {
                            id: 2,
                            name: 'Agenda principal',
                            data_json: JSON.stringify({ id: 2, name: 'Agenda principal' }),
                        },
                    ];
                }

                    return [];
                }),
                getById: vi.fn(async () => null),
                upsertMany: vi.fn().mockResolvedValue(undefined),
                upsertEventOutbox: vi.fn().mockResolvedValue(undefined),
                listEventOutbox: vi.fn().mockResolvedValue([]),
            },
            notifications: {
                refresh: notificationsRefresh,
            },
        };
}

describe('EventsContext', () => {
    beforeEach(() => {
        authState = { user: { id: 1, tag: 'test' }, authEpoch: 1 };
        apiState = { connected: false };
        setSyncStatus.mockReset();
        syncAgendaEventsForView.mockClear();
        syncAllNotifications.mockClear();
        syncEventNotifications.mockClear();
        notificationsRefresh.mockClear();
        createNotification.mockReset();
        createRemoteEvent.mockReset();
        updateRemoteEvent.mockReset();
        window.electronAPI = createElectronApiMock();
    });

    it('evita duplicar el sync inicial bajo StrictMode', async () => {
        function Probe() {
            const { initialized, events, agendas } = useEvents();

            return (
                <div>
                    <div data-testid="initialized">{String(initialized)}</div>
                    <div data-testid="events-count">{events.length}</div>
                    <div data-testid="agendas-count">{agendas.length}</div>
                </div>
            );
        }

        render(
            <StrictMode>
                <EventsProvider>
                    <Probe />
                </EventsProvider>
            </StrictMode>
        );

        await waitFor(() => {
            expect(screen.getByTestId('initialized')).toHaveTextContent('true');
            expect(screen.getByTestId('events-count')).toHaveTextContent('1');
            expect(screen.getByTestId('agendas-count')).toHaveTextContent('1');
        });

        expect(syncAgendaEventsForView).not.toHaveBeenCalled();
        expect(syncAllNotifications).not.toHaveBeenCalled();
        expect(notificationsRefresh).not.toHaveBeenCalled();
        expect(setSyncStatus).not.toHaveBeenCalledWith('Events', true);
    });

    it('ignora resultados stale cuando cambia authEpoch durante una lectura local en curso', async () => {
        let resolveFirstEventsRead;
        const firstEventsRead = new Promise((resolve) => {
            resolveFirstEventsRead = resolve;
        });
        let eventsReadCount = 0;

        window.electronAPI = {
            db: {
                getAll: vi.fn(async (table) => {
                    if (table === 'events') {
                        eventsReadCount += 1;
                        if (eventsReadCount === 1) {
                            await firstEventsRead;
                            return [
                                {
                                    id: 10,
                                    title: 'Evento usuario viejo',
                                    data_json: JSON.stringify({ id: 10, title: 'Evento usuario viejo' }),
                                },
                            ];
                        }

                        return [
                            {
                                id: 20,
                                title: 'Evento usuario nuevo',
                                data_json: JSON.stringify({ id: 20, title: 'Evento usuario nuevo' }),
                            },
                        ];
                    }

                    if (table === 'agendas') {
                        return [
                            {
                                id: 2,
                                name: 'Agenda principal',
                                data_json: JSON.stringify({ id: 2, name: 'Agenda principal' }),
                            },
                        ];
                    }

                    return [];
                }),
                listEventOutbox: vi.fn().mockResolvedValue([]),
            },
            notifications: {
                refresh: notificationsRefresh,
            },
        };

        function Probe() {
            const { events } = useEvents();
            return <div data-testid="first-title">{events[0]?.title || ''}</div>;
        }

        const rendered = render(
            <EventsProvider>
                <Probe />
            </EventsProvider>
        );

        authState = { user: { id: 2, tag: 'new-user' }, authEpoch: 2 };
        rendered.rerender(
            <EventsProvider>
                <Probe />
            </EventsProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('first-title')).toHaveTextContent('Evento usuario nuevo');
        });

        await act(async () => {
            resolveFirstEventsRead();
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(screen.getByTestId('first-title')).toHaveTextContent('Evento usuario nuevo');
        });
    });

    it('usa syncAllNotifications al refrescar con syncNotifications=true', async () => {
        function Probe() {
            const { initialized, refreshEvents } = useEvents();

            useEffect(() => {
                if (!initialized) return;

                void refreshEvents({
                    date: new Date('2026-03-01T10:00:00Z'),
                    view: 'month',
                    syncNotifications: true,
                    syncAgendaCatalog: false,
                });
            }, [initialized, refreshEvents]);

            return <div data-testid="initialized">{String(initialized)}</div>;
        }

        render(
            <EventsProvider>
                <Probe />
            </EventsProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('initialized')).toHaveTextContent('true');
        });

        await waitFor(() => {
            expect(syncAgendaEventsForView).toHaveBeenCalledTimes(1);
            expect(syncAllNotifications).toHaveBeenCalledTimes(1);
        });

        expect(syncEventNotifications).not.toHaveBeenCalled();
    });

    it('permite refresh concurrente y solo aplica el resultado mas reciente', async () => {
        let currentEventRows = [];
        let resolveFirstSync;

        window.electronAPI = {
            db: {
                getAll: vi.fn(async (table) => {
                    if (table === 'events') {
                        return currentEventRows;
                    }

                    if (table === 'agendas') {
                        return [
                            {
                                id: 2,
                                name: 'Agenda principal',
                                data_json: JSON.stringify({ id: 2, name: 'Agenda principal' }),
                            },
                        ];
                    }

                    return [];
                }),
                listEventOutbox: vi.fn().mockResolvedValue([]),
            },
            notifications: {
                refresh: notificationsRefresh,
            },
        };

        syncAgendaEventsForView.mockImplementation(({ view }) => {
            if (view === 'year') {
                return new Promise((resolve) => {
                    resolveFirstSync = () => {
                        currentEventRows = [
                            {
                                id: 101,
                                title: 'Evento stale',
                                data_json: JSON.stringify({ id: 101, title: 'Evento stale' }),
                            },
                        ];
                        resolve();
                    };
                });
            }

            currentEventRows = [
                {
                    id: 202,
                    title: 'Evento visible',
                    data_json: JSON.stringify({ id: 202, title: 'Evento visible' }),
                },
            ];
            return Promise.resolve();
        });

        function Probe() {
            const { initialized, refreshEvents, events } = useEvents();

            useEffect(() => {
                if (!initialized) return;

                void refreshEvents({
                    date: new Date('2026-01-01T10:00:00Z'),
                    view: 'year',
                    syncAgendaCatalog: false,
                });
                void refreshEvents({
                    date: new Date('2026-03-01T10:00:00Z'),
                    view: 'month',
                    syncAgendaCatalog: false,
                });
            }, [initialized, refreshEvents]);

            return <div data-testid="first-title">{events[0]?.title || ''}</div>;
        }

        render(
            <EventsProvider>
                <Probe />
            </EventsProvider>
        );

        await waitFor(() => {
            expect(syncAgendaEventsForView).toHaveBeenCalledTimes(2);
            expect(screen.getByTestId('first-title')).toHaveTextContent('Evento visible');
        });

        await act(async () => {
            resolveFirstSync();
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(screen.getByTestId('first-title')).toHaveTextContent('Evento visible');
        });
    });

    it('no reintenta automaticamente entradas FAILED al reconectar', async () => {
        apiState = { connected: true };
        createRemoteEvent.mockResolvedValue({ ok: true, data: { id: 123 } });
        window.electronAPI = {
            ...createElectronApiMock(),
            db: {
                ...createElectronApiMock().db,
                listEventOutbox: vi.fn().mockResolvedValue([
                    {
                        local_event_id: -10,
                        remote_event_id: null,
                        event_payload_json: JSON.stringify({ agenda_id: 2, date: '2026-03-10', title: 'Pendiente' }),
                        notification_payload_json: null,
                        status: 'failed',
                        retry_count: 2,
                        last_error: 'Error permanente',
                        created_at: '2026-03-10T10:00:00.000Z',
                        updated_at: '2026-03-10T10:00:00.000Z',
                    },
                ]),
            },
        };

        function Probe() {
            const { initialized } = useEvents();
            return <div data-testid="initialized">{String(initialized)}</div>;
        }

        render(
            <EventsProvider>
                <Probe />
            </EventsProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('initialized')).toHaveTextContent('true');
        });

        await waitFor(() => {
            expect(window.electronAPI.db.listEventOutbox).toHaveBeenCalledTimes(1);
        });
        expect(createRemoteEvent).not.toHaveBeenCalled();
    });

    it('el drenaje del outbox no se reinicia por rerenders cuando una notificacion pendiente falla', async () => {
        apiState = { connected: true };
        createNotification.mockResolvedValue({ ok: false, error: 'Error permanente' });
        window.electronAPI = {
            ...createElectronApiMock(),
            db: {
                ...createElectronApiMock().db,
                getById: vi.fn(async (table, id) => {
                    if (table !== 'events' || id !== 1) return null;
                    return {
                        id: 1,
                        data_json: JSON.stringify({
                            id: 1,
                            agenda_id: 2,
                            title: 'Evento remoto',
                            date: '2026-03-12',
                            time: '10:00',
                        }),
                    };
                }),
                listEventOutbox: vi.fn().mockResolvedValue([
                    {
                        local_event_id: 1,
                        remote_event_id: 1,
                        event_payload_json: JSON.stringify({
                            id: 1,
                            agenda_id: 2,
                            title: 'Evento remoto',
                            date: '2026-03-12',
                            time: '10:00',
                        }),
                        notification_payload_json: JSON.stringify({ action: 'upsert', minutes: 30 }),
                        status: 'pending_notification',
                        retry_count: 0,
                        last_error: null,
                        created_at: '2026-03-10T10:00:00.000Z',
                        updated_at: '2026-03-10T10:00:00.000Z',
                    },
                ]),
            },
        };

        function Probe() {
            const { initialized, events } = useEvents();
            return (
                <div>
                    <div data-testid="initialized">{String(initialized)}</div>
                    <div data-testid="events-count">{events.length}</div>
                </div>
            );
        }

        render(
            <EventsProvider>
                <Probe />
            </EventsProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('initialized')).toHaveTextContent('true');
        });

        await waitFor(() => {
            expect(createNotification).toHaveBeenCalledTimes(1);
            expect(window.electronAPI.db.listEventOutbox).toHaveBeenCalledTimes(1);
            expect(window.electronAPI.db.upsertEventOutbox).toHaveBeenCalledTimes(1);
            expect(screen.getByTestId('events-count')).toHaveTextContent('1');
        });
    });
});
