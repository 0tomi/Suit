import { useCallback, useEffect, useMemo, useState } from 'react';
import dayjs from 'dayjs';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import 'dayjs/locale/es';
import {
    Activity,
    AlertTriangle,
    BriefcaseBusiness,
    CalendarClock,
    RefreshCw,
    TrendingUp,
    Users,
    Wallet,
    HandCoins,
    PiggyBank,
    Receipt,
    LayoutDashboard,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../../context/ApiContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCases } from '../../context/CasesContext.jsx';
import { useClients } from '../../context/ClientsContext.jsx';
import { useDeadlines } from '../../context/DeadlinesContext.jsx';
import { useEvents } from '../../context/EventsContext.jsx';
import { useEventTypes } from '../../context/EventTypesContext.jsx';
import { useHotkeyAction } from '../../hotkeys/useHotkeysSystem';
import { useReportsDashboardState } from '../../hooks/useReportsDashboardState.js';
import { HOTKEY_ACTIONS } from '../../hotkeys/hotkeys';
import { getUsersDirectory } from '../../services/adminUserService.js';
import { createLogger } from '../../services/logService.js';
import {
    getGastosStats,
    getHonorariosStats,
} from '../../services/economiaListingBackendService.js';
import { Button } from '../ui/Button.jsx';
import ReportsActivityChart from './ReportsActivityChart.jsx';
import ReportsUpcomingCard from './ReportsUpcomingCard.jsx';
import ReportsStatCard from './ReportsStatCard.jsx';
import EconomiaBarChart from './EconomiaBarChart.jsx';
import HonorariosVsGastosChart from './HonorariosVsGastosChart.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select.jsx';
import { buildEconomyTimelineFromStats, buildReportsMetrics } from '../../utils/reports/reportMetrics.js';
import SideMenuPageLayout from '../ui/SideMenuPageLayout.jsx';
import { SectionTutorialTrigger } from '../ui/SectionTutorialTrigger.jsx';
import { estadisticasSteps } from '../../constants/tutorialSteps.js';

dayjs.extend(localizedFormat);
dayjs.locale('es');

const logger = createLogger('reports-dashboard');

function formatEventTimestamp(eventItem) {
    const rawDate = eventItem?.starts_at || eventItem?.start || eventItem?.date;
    if (!rawDate) return 'Fecha pendiente';
    const parsed = dayjs(rawDate);
    return parsed.isValid() ? parsed.format('dddd D [de] MMMM, HH:mm') : 'Fecha pendiente';
}

function formatDeadlineTimestamp(deadline) {
    if (!deadline?.due_date) return 'Fecha pendiente';
    const parsed = dayjs(deadline.due_date);
    return parsed.isValid() ? parsed.format('dddd D [de] MMMM') : 'Fecha pendiente';
}

// Separa el horario del due_date para mostrarlo como metadata secundaria.
function formatDeadlineTime(deadline) {
    if (!deadline?.due_date) return '';
    const parsed = dayjs(deadline.due_date);
    if (!parsed.isValid()) return '';
    const normalizedTime = parsed.format('HH:mm:ss');
    return normalizedTime === '00:00:00' ? '' : `${parsed.format('HH:mm')} hs`;
}

function buildEventDescription(eventItem) {
    const details = [];
    if (eventItem?.description) details.push(eventItem.description);
    if (eventItem?.suit_case_id) details.push(`Caso #${eventItem.suit_case_id}`);
    return details.join(' · ');
}

function buildEventTypeLabel(eventItem, eventTypesById) {
    const directLabel = eventItem?.event_type?.name
        || eventItem?.eventType?.name
        || eventItem?.event_type_name
        || '';

    if (directLabel) return directLabel;

    const eventTypeId = String(eventItem?.event_type_id ?? eventItem?.eventTypeId ?? '');
    return eventTypesById.get(eventTypeId)?.name || '';
}

// En vencimientos priorizamos la descripción explícita; si falta, caemos a prioridad.
function buildDeadlineDescription(deadline) {
    const primaryDescription = String(deadline?.description || '').trim();
    if (primaryDescription) return primaryDescription;
    if (deadline?.priority) return `Prioridad ${deadline.priority}`;
    if (deadline?.suit_case_id) return `Caso #${deadline.suit_case_id}`;
    return '';
}

function ReportsDashboardHero() {
    return (
        <section className="relative overflow-hidden rounded-[32px] border border-blue-500/10 bg-gradient-to-br from-slate-950 via-slate-900 to-indigo-950 p-8 text-white shadow-2xl">
            {/* Ambient gradients */}
            <div className="absolute -top-24 -left-24 h-64 w-64 rounded-full bg-blue-600/10 blur-[80px]" />
            <div className="absolute -bottom-24 -right-24 h-64 w-64 rounded-full bg-indigo-600/10 blur-[80px]" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
                <div className="space-y-2">
                    <h1 data-testid="page-reports-title" className="text-3xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">
                        Panel Informativo del Estudio
                    </h1>
                    <p className="max-w-md text-sm leading-relaxed text-slate-400 font-medium">
                        Visualiza el pulso operativo y financiero de tu estudio en tiempo real.
                    </p>
                </div>

                <div className="flex items-center gap-3">
                    <div className="glass-effect rounded-2xl border border-white/5 bg-white/5 px-5 py-3 text-right backdrop-blur-md">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">Última actualización</p>
                        <p className="mt-1 text-base font-bold text-white">
                            {dayjs().format('D [de] MMM, HH:mm')}
                        </p>
                    </div>
                </div>
            </div>
        </section>
    );
}

function ReportsDashboardSummary({ counts, activeClientsHelper }) {
    return (
        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            <ReportsStatCard
                icon={BriefcaseBusiness}
                label="Casos activos"
                value={counts.activeCases}
                helper="Expedientes abiertos y en curso."
                accentClassName="from-sky-500/20"
                previousValue={null}
            />
            <ReportsStatCard
                icon={CalendarClock}
                label="Eventos pendientes"
                value={counts.pendingEvents}
                helper="Eventos futuros cargados en agenda."
                accentClassName="from-indigo-500/20"
                previousValue={null}
            />
            <ReportsStatCard
                icon={AlertTriangle}
                label="Vencimientos"
                value={counts.deadlines}
                helper="Pendientes, prorrogados o vencidos aun accionables."
                accentClassName="from-amber-500/20"
                previousValue={null}
            />
            <ReportsStatCard
                icon={Users}
                label="Clientes activos"
                value={counts.activeClients}
                helper={activeClientsHelper}
                accentClassName="from-emerald-500/20"
                previousValue={null}
            />
        </section>
    );
}

function ReportsDashboardActivity({ activity }) {
    return (
        <section className="grid gap-4 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.95fr)]">
            <ReportsActivityChart
                timeline={activity.timeline}
                peakValue={activity.peakValue}
            />

            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
                <ReportsStatCard
                    icon={Activity}
                    label="Actividad mensual"
                    value={activity.month.total}
                    helper="Eventos + altas de casos y clientes del mes actual."
                    accentClassName="from-fuchsia-500/18"
                    previousValue={activity.month.previousTotal}
                />
                <ReportsStatCard
                    icon={TrendingUp}
                    label="Actividad anual"
                    value={activity.year.total}
                    helper="Lectura acumulada del ano corriente sobre la misma serie operativa."
                    accentClassName="from-cyan-500/18"
                    previousValue={activity.year.previousTotal}
                />
            </div>
        </section>
    );
}

function ReportsDashboardUpcoming({ upcoming, eventTypesById }) {
    return (
        <section className="grid gap-4 xl:grid-cols-3">
            <ReportsUpcomingCard
                icon={CalendarClock}
                label="Evento proximo"
                title={upcoming.nextEvent?.title || ''}
                metadataLabel={buildEventTypeLabel(upcoming.nextEvent, eventTypesById)}
                timestamp={upcoming.nextEvent ? formatEventTimestamp(upcoming.nextEvent) : ''}
                description={buildEventDescription(upcoming.nextEvent)}
                href="/agenda"
                ctaLabel="Abrir agenda"
                accentClassName="from-sky-500/15"
                emptyTitle="Sin eventos proximos"
                emptyDescription="No hay eventos futuros pendientes en la agenda."
                testId="reports-upcoming-event"
            />
            <ReportsUpcomingCard
                icon={AlertTriangle}
                label="Vencimiento proximo"
                title={upcoming.nextDeadline?.title || ''}
                metadataLabel={upcoming.nextDeadline ? formatDeadlineTimestamp(upcoming.nextDeadline) : ''}
                timestamp={upcoming.nextDeadline ? formatDeadlineTime(upcoming.nextDeadline) : ''}
                description={buildDeadlineDescription(upcoming.nextDeadline)}
                href="/deadlines"
                ctaLabel="Ver vencimientos"
                accentClassName="from-amber-500/15"
                emptyTitle="Sin vencimientos proximos"
                emptyDescription="No hay vencimientos pendientes con fecha futura."
                testId="reports-upcoming-deadline"
            />
            <ReportsUpcomingCard
                icon={AlertTriangle}
                label="Vencimiento urgente proximo"
                title={upcoming.nextUrgentDeadline?.title || ''}
                metadataLabel={upcoming.nextUrgentDeadline ? formatDeadlineTimestamp(upcoming.nextUrgentDeadline) : ''}
                timestamp={upcoming.nextUrgentDeadline ? formatDeadlineTime(upcoming.nextUrgentDeadline) : ''}
                description={buildDeadlineDescription(upcoming.nextUrgentDeadline)}
                href="/deadlines"
                ctaLabel="Atender urgentes"
                accentClassName="from-rose-500/15"
                emptyTitle="Sin urgencias proximas"
                emptyDescription="No hay vencimientos urgentes pendientes en la ventana cargada."
                testId="reports-upcoming-urgent-deadline"
            />
        </section>
    );
}

function ReportsDashboardNotes() {
    return (
        <section className="grid gap-4">
            <article className="rounded-3xl border border-(--border-default) bg-(--bg-card) p-6 shadow-sm">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary)">Metodologia</p>
                <h2 className="mt-2 text-2xl font-semibold text-(--text-primary)">Como se calcula la actividad</h2>
                <p className="mt-3 text-sm leading-7 text-(--text-secondary)">
                    La serie mensual y anual combina eventos de agenda con fechas de alta de casos y clientes.
                    Asi obtenemos una lectura operativa del estudio, incluso cuando un mes tuvo muchas aperturas
                    y poca actividad de calendario, o al reves.
                </p>
            </article>
        </section>
    );
}

/**
 * Dashboard operativo de reportes. Consolida metricas de casos, agenda,
 * vencimientos y clientes usando los providers ya cargados en la app.
 */
export function ReportsDashboard() {
    const { connected } = useApi();
    const { user } = useAuth();
    const isAdmin = user?.role === 'admin';
    const { cases, refreshCases } = useCases();
    const { clients, refreshClients } = useClients();
    const { deadlines, refreshDeadlines } = useDeadlines();
    const { events, refreshEvents } = useEvents();
    const { event_types: eventTypes = [] } = useEventTypes();
    const {
        honorariosCurrent, gastosCurrent, honorariosPrevious, honorarios12, gastos12,
        selectedUserId, setSelectedUserId,
        usersList, setUsersList,
        caseClientMap, setCaseClientMap,
        setIsRefreshing,
        setEconomyData,
        economyError, setEconomyError,
    } = useReportsDashboardState();

    const [activeTab, setActiveTab] = useState('summary');

    // Carga las asociaciones caso↔cliente desde SQLite al montar.
    useEffect(() => {
        if (!window.electronAPI?.db) return;
        window.electronAPI.db.getAll('case_client')
            .then((rows) => {
                const map = new Map();
                for (const row of (rows || [])) {
                    const key = String(row.suit_case_id);
                    if (!map.has(key)) map.set(key, []);
                    map.get(key).push(row.client_id);
                }
                setCaseClientMap(map);
            })
            .catch((err) => {
                void logger.warn('No se pudo cargar case_client desde SQLite', { error: err?.message });
            });
    }, [setCaseClientMap]);

    // Carga el listado de usuarios para el selector admin.
    useEffect(() => {
        if (!isAdmin || !connected) return;
        getUsersDirectory()
            .then(setUsersList)
            .catch((err) => void logger.warn('No se pudo cargar usuarios', { error: err?.message }));
    }, [isAdmin, connected, setUsersList]);

    // Carga datos financieros globales desde el backend de Electron.
    useEffect(() => {
        if (!connected) return;

        let cancelled = false;
        const now = dayjs();
        const startOfMonth    = now.startOf('month').format('YYYY-MM-DD');
        const endOfMonth      = now.endOf('month').format('YYYY-MM-DD');
        const startOfPrevMonth = now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        const endOfPrevMonth   = now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
        const from12 = now.subtract(11, 'month').startOf('month').format('YYYY-MM-DD');
        const to12   = endOfMonth;

        const loadEconomy = async () => {
            setEconomyError(null);
            try {
                const [hCurrentResult, gCurrentResult, hPrevResult, h12Result, g12Result] = await Promise.allSettled([
                    getHonorariosStats({ filters: { from: startOfMonth, to: endOfMonth, userId: selectedUserId } }),
                    getGastosStats({ filters: { from: startOfMonth, to: endOfMonth, userId: selectedUserId } }),
                    getHonorariosStats({ filters: { from: startOfPrevMonth, to: endOfPrevMonth, userId: selectedUserId } }),
                    getHonorariosStats({ filters: { from: from12, to: to12, userId: selectedUserId } }),
                    getGastosStats({ filters: { from: from12, to: to12, userId: selectedUserId } }),
                ]);

                if (cancelled) return;

                const failures = [];
                const resolveValue = (result, label) => {
                    if (result.status === 'fulfilled') return result.value;
                    failures.push(label);
                    return [];
                };

                setEconomyData({
                    hCurrent: resolveValue(hCurrentResult, 'honorarios del mes actual'),
                    gCurrent: resolveValue(gCurrentResult, 'gastos del mes actual'),
                    hPrev: resolveValue(hPrevResult, 'honorarios del mes anterior'),
                    h12: resolveValue(h12Result, 'honorarios de 12 meses'),
                    g12: resolveValue(g12Result, 'gastos de 12 meses'),
                });

                if (failures.length > 0) {
                    setEconomyError(`No se pudieron cargar: ${failures.join(', ')}.`);
                }
            } catch (err) {
                if (!cancelled) {
                    void logger.error('Error cargando datos economicos globales', err);
                    setEconomyError(err?.message || 'No se pudieron cargar los datos de economía.');
                }
            }
        };

        void loadEconomy();
        return () => { cancelled = true; };
    }, [connected, selectedUserId, setEconomyData, setEconomyError]);

    const reportsMetrics = useMemo(() => {
        return buildReportsMetrics({
            cases,
            clients,
            events,
            deadlines,
            honorariosStats: honorariosCurrent,
            gastosStats: gastosCurrent,
            caseClientMap,
        });
    }, [cases, clients, deadlines, events, honorariosCurrent, gastosCurrent, caseClientMap]);

    const prevReportsMetrics = useMemo(() => {
        return buildReportsMetrics({
            honorariosStats: honorariosPrevious,
            now: dayjs().subtract(1, 'month').toDate(),
        });
    }, [honorariosPrevious]);

    const eventTypesById = useMemo(
        () => new Map((eventTypes || []).map((item) => [String(item.id), item])),
        [eventTypes],
    );

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await Promise.allSettled([
                refreshCases(),
                refreshClients(),
                refreshDeadlines(),
                refreshEvents({
                    date: new Date(),
                    view: 'month',
                    syncNotifications: false,
                    agendaId: null,
                    syncAgendaCatalog: false,
                }),
            ]);
        } finally {
            setIsRefreshing(false);
        }
    }, [refreshCases, refreshClients, refreshDeadlines, refreshEvents, setIsRefreshing]);

    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => {
        void handleRefresh();
    });

    useEffect(() => {
        void refreshDeadlines();
    }, [refreshDeadlines]);

    useEffect(() => {
        void refreshEvents({
            date: new Date(),
            view: 'month',
            syncNotifications: false,
            agendaId: null,
            syncAgendaCatalog: false,
        });
    }, [refreshEvents]);

    const economyTimeline = useMemo(
        () => buildEconomyTimelineFromStats({
            honorariosStats: honorarios12,
            gastosStats: gastos12,
        }),
        [honorarios12, gastos12],
    );

    const TABS = [
        { id: 'summary', label: 'Vista General', icon: LayoutDashboard, testId: 'reports-tab-summary' },
        { id: 'economy', label: 'Panorama Económico', icon: TrendingUp, testId: 'reports-tab-economy' },
        { id: 'activity', label: 'Ritmo de Actividad', icon: Activity, testId: 'reports-tab-activity' },
    ];

    const renderContent = () => {
        switch (activeTab) {
            case 'summary':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <ReportsDashboardHero />
                        <ReportsDashboardSummary
                            counts={reportsMetrics.counts}
                            activeClientsHelper="Clientes vinculados a expedientes actualmente activos."
                        />
                        <ReportsDashboardUpcoming upcoming={reportsMetrics.upcoming} eventTypesById={eventTypesById} />
                    </div>
                );
            case 'economy':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <div className="flex items-center justify-between gap-4 px-1">
                            <div className="space-y-1">
                                <h2 className="text-2xl font-bold tracking-tight text-(--text-primary)">Panorama Económico</h2>
                                <p className="text-sm text-(--text-secondary) font-medium opacity-80">Rendimiento financiero detallado del periodo.</p>
                            </div>

                            {isAdmin && (
                                <Select
                                    value={selectedUserId != null ? String(selectedUserId) : '__all__'}
                                    onValueChange={(v) => setSelectedUserId(v === '__all__' ? null : Number(v))}
                                >
                                    <SelectTrigger className="w-56 glass-effect">
                                        <SelectValue placeholder="Todos los usuarios" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="__all__">Todos los usuarios</SelectItem>
                                        {usersList.map((u) => (
                                            <SelectItem key={u.id} value={String(u.id)}>
                                                {u.name} ({u.tag})
                                            </SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            )}
                        </div>

                        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
                            <ReportsStatCard
                                icon={Wallet}
                                label="Facturación Total"
                                value={reportsMetrics.economy.totalHonorarios}
                                previousValue={prevReportsMetrics.economy.totalHonorarios}
                                isCurrency
                                helper="Suma de honorarios creados en el periodo."
                                accentClassName="from-indigo-500"
                            />
                            <ReportsStatCard
                                icon={HandCoins}
                                label="Recaudación"
                                value={reportsMetrics.economy.totalEntregas}
                                previousValue={prevReportsMetrics.economy.totalEntregas}
                                isCurrency
                                helper="Total percibido por entregas de honorarios."
                                accentClassName="from-emerald-500"
                                valueClassName="text-emerald-600 dark:text-emerald-400"
                            />
                            <ReportsStatCard
                                icon={PiggyBank}
                                label="Saldo Pendiente"
                                value={reportsMetrics.economy.pendingBalance}
                                isCurrency
                                helper="Diferencia bruta entre facturado y cobrado."
                                accentClassName="from-amber-500"
                                valueClassName="text-amber-600 dark:text-amber-400"
                            />
                            <ReportsStatCard
                                icon={Receipt}
                                label="Gastos de Expediente"
                                value={reportsMetrics.economy.totalGastos}
                                isCurrency
                                helper="Gastos registrados asociados a casos."
                                accentClassName="from-rose-500"
                                valueClassName="text-rose-600 dark:text-rose-400"
                            />
                        </div>

                        {economyError && (
                            <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-900 dark:text-amber-100">
                                {economyError}
                            </div>
                        )}

                        <div className="grid gap-6 lg:grid-cols-2">
                            <EconomiaBarChart
                                title="Honorarios"
                                helper="Monto total de honorarios creados cada mes."
                                data={economyTimeline.map((b) => ({ ...b, value: b.honorarios }))}
                                gradientFrom="from-slate-950"
                                gradientVia="via-indigo-900"
                                gradientTo="to-indigo-500"
                                gradientHoverTo="hover:to-indigo-400"
                                lineColor="#6366f1"
                            />
                            <EconomiaBarChart
                                title="Gastos"
                                helper="Gastos de expediente registrados cada mes."
                                data={economyTimeline.map((b) => ({ ...b, value: b.gastos }))}
                                gradientFrom="from-slate-950"
                                gradientVia="via-rose-900"
                                gradientTo="to-rose-500"
                                gradientHoverTo="hover:to-rose-400"
                                lineColor="#f43f5e"
                            />
                            <EconomiaBarChart
                                title="Entregas"
                                helper="Total cobrado en entregas cada mes."
                                data={economyTimeline.map((b) => ({ ...b, value: b.entregas }))}
                                gradientFrom="from-slate-950"
                                gradientVia="via-emerald-900"
                                gradientTo="to-emerald-500"
                                gradientHoverTo="hover:to-emerald-400"
                                lineColor="#10b981"
                            />
                            <HonorariosVsGastosChart data={economyTimeline} />
                        </div>
                    </div>
                );
            case 'activity':
                return (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-2 duration-500">
                        <ReportsDashboardActivity activity={reportsMetrics.activity} />
                        <ReportsDashboardNotes />
                    </div>
                );
            default:
                return null;
        }
    };

    return (
        <SideMenuPageLayout
            title={
                <div className="flex items-center gap-3">
                    <span>Panel Informativo del Estudio</span>
                    <SectionTutorialTrigger
                        steps={estadisticasSteps}
                        ariaLabel="Ver tutorial de estadísticas"
                        testId="reports-main-tutorial-trigger"
                    />
                </div>
            }
            titleTestId="page-reports-title-main"
            icon={LayoutDashboard}
            sections={TABS}
            activeSection={activeTab}
            onSectionChange={setActiveTab}
            sectionIdPrefix="reports-tab"
            maxWidthClass="max-w-full"
        >
            {renderContent()}
        </SideMenuPageLayout>
    );
}

export default ReportsDashboard;
