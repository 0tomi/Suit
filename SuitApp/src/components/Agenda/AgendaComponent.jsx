import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Calendar } from 'react-big-calendar';
import 'react-big-calendar/lib/css/react-big-calendar.css';
import { useEvents } from '../../context/EventsContext.jsx';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext.jsx';
import { useAgendaController } from '../../hooks/useAgendaController.js';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { useSettings } from '../../context/SettingsContext';
import { useCases } from '../../context/CasesContext';
import { useEventColorResolver } from '../../hooks/useEventColorResolver.js';
import { splitVisibleAgendas } from '../../utils/agenda/visibleAgendas.js';
import { buildAgendaRenderEvents } from '../../utils/agendaColor/buildAgendaRenderEvents.js';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { getPastNotifications } from '../../services/missedNotificationService';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import AgendaToolbar from './AgendaToolbar';
import AgendaYearView from './AgendaYearView';
import AgendaEventModal from './AgendaEventModal';
import EventNotificationModal from './EventNotificationModal';
import AgendaHeader from './AgendaHeader.jsx';
import AgendaErrorBanner from './AgendaErrorBanner.jsx';
import AgendaCalendarEventContent from './AgendaCalendarEventContent.jsx';
import { agendaLocalizer, CALENDAR_MESSAGES } from './agendaCalendarConfig.js';
import { startupMark, startupMarkCount } from '../../utils/startupMetrics.js';
import { useHotkeyAction } from '../../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../../hotkeys/hotkeys';
import { usePageFocus } from '../../hooks/usePageFocus';
import agendaMonthSyncService from '../../services/sync/agendaMonthSyncService';

const AgendaComponent = ({
    caseId = null,
    caseSyncChecked = true,
    caseSyncReady = false,
    newIds = new Set(),
    onMarkAsSeen = () => { },
}) => {
    // Sincronizar al volver a la pestaña
    usePageFocus({
        onFocus: () => {
            if (caseId === null) {
                agendaMonthSyncService.syncAgendaEventsForView({});
            }
        },
    });

    const {
        events: rawEvents,
        agendas,
        refreshEvents: refreshAll,
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
        initialized,
    } = useEvents();
    const { user } = useAuth();
    const { users } = useUsers();
    const { dialogProps, openDialog, closeDialog } = useConfirmDialog();
    const {
        defaultAgendaView,
        defaultEventNotificationMinutes,
        lastEventNotificationMinutes,
        setLastEventNotificationMinutes,
    } = useSettings();
    const { cases } = useCases();
    const { fetchMissingCases, resolveColorDetails } = useEventColorResolver();
    const location = useLocation();
    const navigate = useNavigate();
    const [agendaLoading, setAgendaLoading] = useState(false);
    const refreshRequestRef = useRef(0);
    const skippedInitialCaseRefreshRef = useRef(false);
    const agendaCatalogForceSyncedRef = useRef(false);

    useEffect(() => {
        startupMarkCount('agenda:mount', 'agenda:mount:calls', {
            events: rawEvents.length,
            agendas: agendas.length,
            caseId,
        });
    }, [agendas.length, caseId, rawEvents.length]);

    const {
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
    } = useAgendaController({
        agendas,
        cases,
        caseId,
        createEventEntry,
        updateEventEntry,
        deleteEventEntry,
        currentUserId: user?.id || null,
        defaultAgendaView,
        defaultEventNotificationMinutes,
        lastEventNotificationMinutes,
        setLastEventNotificationMinutes,
    });

    useHotkeyAction(HOTKEY_ACTIONS.NEW_ITEM_CONTEXTUAL, () => {
        if (!modal.modalOpen) {
            openNewEventAtDate(new Date());
        }
    });

    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => refreshAll());

    const { visibleAgendaIds } = useMemo(
        () => splitVisibleAgendas(agendas, cases),
        [agendas, cases],
    );

    const refreshVisibleRange = useCallback(async ({
        force = false,
        syncNotifications = false,
    } = {}) => {
        if (!cal.selectedFilterAgenda) return;
        const isAllAgendasView = String(cal.selectedFilterAgenda).toUpperCase() === 'ALL';
        const requestId = ++refreshRequestRef.current;
        await refreshAll({
            date: cal.date,
            view: cal.view,
            force,
            syncNotifications,
            agendaId: cal.selectedFilterAgenda,
            syncAgendaCatalog: false,
            persistMode: isAllAgendasView ? 'await' : 'background',
            applyEventsInMemory: true,
            onFetchRequired: () => {
                if (requestId !== refreshRequestRef.current) return;
                setAgendaLoading(true);
            },
        });
        if (requestId === refreshRequestRef.current) {
            setAgendaLoading(false);
        }
    }, [cal.date, cal.selectedFilterAgenda, cal.view, refreshAll]);

    useEffect(() => {
        if (!caseId || !initialized) return;
        const hasCaseAgenda = agendas.some((a) => String(a.suit_case_id) === String(caseId));
        if (hasCaseAgenda || agendaCatalogForceSyncedRef.current) return;
        agendaCatalogForceSyncedRef.current = true;
        void refreshAll({ syncAgendaCatalog: true });
    }, [agendas, caseId, initialized, refreshAll]);

    useEffect(() => {
        if (!initialized) return;
        if (!cal.selectedFilterAgenda) return;

        // Si es la agenda global y no estamos en su ruta, no refrescamos para evitar carga innecesaria en background
        if (caseId === null && location.pathname !== '/agenda' && location.pathname !== '/') return;

        // En la agenda embebida del caso...
        if (caseId != null && caseId !== '') {
            if (!caseSyncChecked) return;
            if (caseSyncReady && !skippedInitialCaseRefreshRef.current) {
                skippedInitialCaseRefreshRef.current = true;
                return;
            }
        }

        let cancelled = false;
        queueMicrotask(() => {
            if (cancelled) return;
            void refreshVisibleRange();
        });
        return () => {
            cancelled = true;
        };
    }, [cal.selectedFilterAgenda, caseId, caseSyncChecked, caseSyncReady, initialized, refreshVisibleRange, location.pathname]);

    const calendarEvents = useMemo(() => {
        return buildAgendaRenderEvents({
            rawEvents,
            agendas,
            caseId,
            selectedFilterAgenda: cal.selectedFilterAgenda,
            visibleAgendaIds,
            resolveColorDetails,
        });
    }, [rawEvents, agendas, caseId, cal.selectedFilterAgenda, visibleAgendaIds, resolveColorDetails]);

    useEffect(() => {
        startupMark('agenda:fetch-missing-cases', { events: calendarEvents.length });
        fetchMissingCases(calendarEvents);
    }, [calendarEvents, fetchMissingCases]);

    const eventPropGetter = useCallback((event) => ({
        style: {
            backgroundColor: event.resolvedColor,
            borderColor: event.pendingSync ? 'rgba(251, 191, 36, 0.95)' : 'transparent',
            borderStyle: event.pendingSync ? 'dashed' : 'solid',
            borderWidth: event.pendingSync ? '1px' : '0px',
            borderRadius: '6px',
            opacity: event.pendingSync ? 0.92 : 1,
        },
    }), []);

    useEffect(() => {
        if (!toastData) return;
        showAppToast(toastData);
        clearToastData();
    }, [toastData, clearToastData]);

    // Al entrar a la agenda (solo vista completa, no embebida en un caso),
    // avisa si hay notificaciones perdidas pendientes.
    useEffect(() => {
        if (caseId !== null) return;
        getPastNotifications().then((past) => {
            if (past.length > 0) {
                window.setTimeout(() => {
                    showAppToast({ title: 'Tenés notificaciones perdidas!', variant: 'warning' });
                }, 2000);
            }
        });
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useEffect(() => {
        if (location.state?.highlightedEventId) {
            const matchedEvent = calendarEvents.find((event) => String(event.id) === String(location.state.highlightedEventId));
            if (matchedEvent) {
                openEditEvent(matchedEvent);
                navigate(location.pathname, { replace: true, state: null });
            }
        } else if (location.state?.openNewEventModal) {
            openNewEventAtDate(new Date());
            navigate(location.pathname, { replace: true, state: null });
        }
    }, [calendarEvents, location.pathname, location.state, navigate, openEditEvent, openNewEventAtDate]);

    return (
        <div className="h-full flex flex-col space-y-6 relative">
            <AgendaHeader
                caseId={caseId}
                selectedFilterAgenda={cal.selectedFilterAgenda}
                setSelectedFilterAgenda={setSelectedFilterAgenda}
                agendas={agendas}
                cases={cases}
                user={user}
                users={users}
                openNewEventAtDate={openNewEventAtDate}
            />
            <ConfirmDialog {...dialogProps} />
            {!modal.modalOpen && (
                <AgendaErrorBanner error={modal.error} onDismiss={clearModalError} />
            )}
            <AgendaToolbar
                date={cal.date}
                view={cal.view}
                onView={setCalendarView}
                onNavigate={handleNavigate}
            />
            <div className="bg-(--bg-card) p-2 rounded-xl shadow-sm border border-(--border-default) overflow-hidden relative" style={{ height: 'calc(100vh - 240px)' }}>
                {agendaLoading && (
                    <div className="absolute inset-0 z-10 bg-(--bg-card) flex items-center justify-center">
                        <div className="flex items-center gap-3 text-(--text-primary)">
                            <span className="inline-block h-5 w-5 rounded-full border-2 border-(--border-default) border-t-blue-500 animate-spin" />
                            <span className="text-sm font-medium">Cargando agenda...</span>
                        </div>
                    </div>
                )}
                {cal.view === 'year' ? (
                    <AgendaYearView
                        date={cal.date}
                        events={calendarEvents}
                        onNavigate={handleNavigate}
                        onView={setCalendarView}
                    />
                ) : (
                    <Calendar
                        localizer={agendaLocalizer}
                        events={calendarEvents}
                        startAccessor="start"
                        endAccessor="end"
                        view={cal.view}
                        date={cal.date}
                        onNavigate={handleCalendarNavigate}
                        onView={setCalendarView}
                        selectable
                        onSelectSlot={({ start }) => openNewEventAtDate(start)}
                        onSelectEvent={openEditEvent}
                        className="custom-calendar"
                        style={{ height: '100%' }}
                        toolbar={false}
                        messages={CALENDAR_MESSAGES}
                        eventPropGetter={eventPropGetter}
                        components={{
                            event: ({ event }) => (
                                <AgendaCalendarEventContent
                                    event={event}
                                    onOpenNotification={openNotificationModal}
                                    isNew={newIds.has(Number(event.id))}
                                    onMarkAsSeen={onMarkAsSeen}
                                />
                            ),
                        }}
                    />
                )}
            </div>
            <AgendaEventModal
                modalOpen={modal.modalOpen}
                setModalOpen={(open) => { if (!open) closeModal(); }}
                selectedEvent={modal.selectedEvent}
                formData={modal.formData}
                setFormData={updateFormData}
                saving={modal.saving}
                agendas={agendas}
                cases={cases}
                user={user}
                users={users}
                handleSave={saveEvent}
                handleDelete={deleteEvent}
                setNotificationEnabled={setNotificationEnabled}
                setNotificationMode={setNotificationMode}
                setNotificationPresetMinutes={setNotificationPresetMinutes}
                setNotificationCustomAmount={setNotificationCustomAmount}
                setNotificationCustomUnit={setNotificationCustomUnit}
                error={modal.error}
                onDismissError={clearModalError}
            />
            {notificationModalOpen && notificationEvent && (
                <EventNotificationModal
                    eventId={notificationEvent.id}
                    eventTitle={notificationEvent.title}
                    onClose={closeNotificationModal}
                    onSuccess={refreshAll}
                    openDialog={openDialog}
                    closeDialog={closeDialog}
                />
            )}
        </div>
    );
};

export default AgendaComponent;
