import { useCallback, useEffect, useMemo } from 'react';
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
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { useApi } from '../../context/ApiContext.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useCases } from '../../context/CasesContext.jsx';
import { useClients } from '../../context/ClientsContext.jsx';
import { useDeadlines } from '../../context/DeadlinesContext.jsx';
import { useEvents } from '../../context/EventsContext.jsx';
import { useHotkeyAction } from '../../hotkeys/useHotkeysSystem';
import { useReportsDashboardState } from '../../hooks/useReportsDashboardState.js';
import { HOTKEY_ACTIONS } from '../../hotkeys/hotkeys';
import { getHonorariosByDateRange } from '../../services/honorarioService.js';
import { getGastosByDateRange } from '../../services/gastoSuitCaseService.js';
import { getUsersDirectory } from '../../services/adminUserService.js';
import { createLogger } from '../../services/logService.js';
import { Button } from '../ui/Button.jsx';
import ReportsActivityChart from './ReportsActivityChart.jsx';
import ReportsUpcomingCard from './ReportsUpcomingCard.jsx';
import ReportsStatCard from './ReportsStatCard.jsx';
import EconomiaBarChart from './EconomiaBarChart.jsx';
import HonorariosVsGastosChart from './HonorariosVsGastosChart.jsx';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select.jsx';
import { buildReportsMetrics } from '../../utils/reports/reportMetrics.js';

dayjs.extend(localizedFormat);
dayjs.locale('es');

const logger = createLogger('reports-dashboard');

// Nombres cortos de mes para los labels del eje X.
const MONTH_SHORT = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
const MONTH_LONG  = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

/**
 * Genera 12 buckets mensuales (más antiguo → más reciente) con los totales
 * de honorarios, entregas y gastos agrupados por mes de creación.
 *
 * Los "entregas" se derivan del campo `total_entregas` de cada honorario,
 * acumulándolas en el mes del honorario padre (simplificación razonable ya
 * que la API no expone un endpoint propio de entregas por rango).
 */
function extractArray(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

function buildEconomyTimeline(honorariosRaw, gastosRaw) {
    // Normalización defensiva: la API puede retornar array directo o { data: [...] }
    const honorarios = extractArray(honorariosRaw);
    const gastos = extractArray(gastosRaw);

    const now = dayjs();
    const buckets = Array.from({ length: 12 }, (_, i) => {
        const m = now.subtract(11 - i, 'month');
        return {
            key: m.format('YYYY-MM'),
            shortLabel: MONTH_SHORT[m.month()],
            monthLabel: `${MONTH_LONG[m.month()]} ${m.year()}`,
            honorarios: 0,
            entregas: 0,
            gastos: 0,
        };
    });
    const bucketMap = Object.fromEntries(buckets.map((b) => [b.key, b]));

    for (const h of honorarios) {
        const key = dayjs(h.created_at).format('YYYY-MM');
        if (bucketMap[key]) {
            bucketMap[key].honorarios += Number(h.monto) || 0;
            bucketMap[key].entregas  += Number(h.total_entregas) || 0;
        }
    }

    for (const g of gastos) {
        const key = dayjs(g.created_at).format('YYYY-MM');
        if (bucketMap[key]) {
            bucketMap[key].gastos += Number(g.monto) || 0;
        }
    }

    return buckets;
}

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

function buildEventDescription(eventItem) {
    const details = [];
    if (eventItem?.description) details.push(eventItem.description);
    if (eventItem?.suit_case_id) details.push(`Caso #${eventItem.suit_case_id}`);
    return details.join(' · ');
}

function buildDeadlineDescription(deadline) {
    const details = [];
    if (deadline?.priority) details.push(`Prioridad ${deadline.priority}`);
    if (deadline?.suit_case_id) details.push(`Caso #${deadline.suit_case_id}`);
    if (deadline?.description) details.push(deadline.description);
    return details.join(' · ');
}

function ReportsDashboardHero() {

    return (
        <section className="overflow-hidden rounded-[32px] border border-slate-200/80 bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.18),_transparent_36%),linear-gradient(135deg,_rgba(15,23,42,0.98),_rgba(30,41,59,0.94))] p-8 text-white shadow-[0_28px_80px_-45px_rgba(15,23,42,0.8)]">
            <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl space-y-4">
                    <div>
                        <h1 data-testid="page-reports-title" className="text-4xl font-semibold tracking-tight">
                            Panel informativo del estudio
                        </h1>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-200">
                            Resumen de datos operativos sobre el estudio.
                        </p>
                    </div>
                </div>

                <div className="flex flex-wrap items-stretch gap-3">
                    <div className="rounded-2xl border border-white/10 bg-white/10 px-4 py-3 text-right flex flex-col justify-center">
                        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-300">Actualizado</p>
                        <p className="mt-1 text-lg font-semibold">
                            {dayjs().format('D [de] MMMM, HH:mm')}
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

function ReportsDashboardUpcoming({ upcoming }) {
    return (
        <section className="grid gap-4 xl:grid-cols-3">
            <ReportsUpcomingCard
                icon={CalendarClock}
                label="Evento proximo"
                title={upcoming.nextEvent?.title || ''}
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
                timestamp={upcoming.nextDeadline ? formatDeadlineTimestamp(upcoming.nextDeadline) : ''}
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
                timestamp={upcoming.nextUrgentDeadline ? formatDeadlineTimestamp(upcoming.nextUrgentDeadline) : ''}
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
    const {
        globalHonorarios, globalGastos, previousHonorarios, honorarios12, gastos12,
        selectedUserId, setSelectedUserId,
        usersList, setUsersList,
        caseClientMap, setCaseClientMap,
        isRefreshing, setIsRefreshing,
        setEconomyData,
    } = useReportsDashboardState();

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
    }, []);

    // Carga el listado de usuarios para el selector admin.
    useEffect(() => {
        if (!isAdmin || !connected) return;
        getUsersDirectory()
            .then(setUsersList)
            .catch((err) => void logger.warn('No se pudo cargar usuarios', { error: err?.message }));
    }, [isAdmin, connected]);

    // Carga datos financieros globales: mes actual, mes anterior y 12 meses para gráficos.
    // Se re-ejecuta cuando cambia el usuario seleccionado en el selector admin.
    useEffect(() => {
        if (!connected) return;

        let cancelled = false;
        const now = dayjs();
        const startOfMonth    = now.startOf('month').format('YYYY-MM-DD');
        const endOfMonth      = now.endOf('month').format('YYYY-MM-DD');
        const startOfPrevMonth = now.subtract(1, 'month').startOf('month').format('YYYY-MM-DD');
        const endOfPrevMonth   = now.subtract(1, 'month').endOf('month').format('YYYY-MM-DD');
        // Rango de 12 meses: primer día del mes hace 11 meses → fin del mes actual.
        const from12 = now.subtract(11, 'month').startOf('month').format('YYYY-MM-DD');
        const to12   = endOfMonth;

        const loadEconomy = async () => {
            try {
                const [hCurrent, gCurrent, hPrev, h12, g12] = await Promise.all([
                    getHonorariosByDateRange(startOfMonth, endOfMonth, selectedUserId),
                    getGastosByDateRange(startOfMonth, endOfMonth, selectedUserId),
                    getHonorariosByDateRange(startOfPrevMonth, endOfPrevMonth, selectedUserId),
                    getHonorariosByDateRange(from12, to12, selectedUserId),
                    getGastosByDateRange(from12, to12, selectedUserId),
                ]);

                if (cancelled) return;

                // Un único dispatch batchea los 5 arrays → 1 re-render en vez de 5.
                setEconomyData({ hCurrent, gCurrent, hPrev, h12, g12 });
            } catch (err) {
                void logger.error('Error cargando datos economicos globales', err);
            }
        };

        void loadEconomy();
        return () => { cancelled = true; };
    }, [connected, selectedUserId]);

    const reportsMetrics = useMemo(() => {
        return buildReportsMetrics({
            cases,
            clients,
            events,
            deadlines,
            honorarios: globalHonorarios,
            gastos: globalGastos,
            caseClientMap,
        });
    }, [cases, clients, deadlines, events, globalHonorarios, globalGastos, caseClientMap]);

    const prevReportsMetrics = useMemo(() => {
        return buildReportsMetrics({
            honorarios: previousHonorarios,
            now: dayjs().subtract(1, 'month').toDate(),
        });
    }, [previousHonorarios]);

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
    }, [refreshCases, refreshClients, refreshDeadlines, refreshEvents]);

    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => {
        void handleRefresh();
    });

    useEffect(() => {
        void refreshEvents({
            date: new Date(),
            view: 'month',
            syncNotifications: false,
            agendaId: null,
            syncAgendaCatalog: false,
        });
    }, [refreshEvents]);

    // Genera los 12 buckets mensuales para los gráficos de tendencia económica.
    const economyTimeline = useMemo(
        () => buildEconomyTimeline(honorarios12, gastos12),
        [honorarios12, gastos12],
    );

    const activeClientsHelper = 'Clientes vinculados a expedientes actualmente activos.';

    return (
        <div className="space-y-6">
            <ReportsDashboardHero />
            
            <ReportsDashboardSummary
                counts={reportsMetrics.counts}
                activeClientsHelper={activeClientsHelper}
            />
            <ReportsDashboardActivity activity={reportsMetrics.activity} />
            <ReportsDashboardUpcoming upcoming={reportsMetrics.upcoming} />

            <section className="space-y-4">
                <div className="flex items-center gap-2 px-1 text-(--text-primary) flex-wrap">
                    <TrendingUp className="h-5 w-5 text-emerald-600 shrink-0" />
                    <h2 className="text-xl font-semibold tracking-tight">Panorama Económico</h2>

                    {/* Selector de usuario — solo para admin */}
                    {isAdmin && (
                        <Select
                            value={selectedUserId != null ? String(selectedUserId) : '__all__'}
                            onValueChange={(v) => setSelectedUserId(v === '__all__' ? null : Number(v))}
                        >
                            <SelectTrigger className="w-48 ml-1">
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

                    <span className="text-xs font-medium text-(--text-tertiary) uppercase tracking-widest ml-auto">Resultados del mes</span>
                </div>

                {/* Contadores del mes actual */}
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    <ReportsStatCard
                        icon={Wallet}
                        label="Facturación Total"
                        value={reportsMetrics.economy.totalHonorarios}
                        previousValue={prevReportsMetrics.economy.totalHonorarios}
                        isCurrency
                        helper="Suma de honorarios creados en el periodo."
                        accentClassName="from-indigo-500/15"
                    />
                    <ReportsStatCard
                        icon={HandCoins}
                        label="Recaudación"
                        value={reportsMetrics.economy.totalEntregas}
                        previousValue={prevReportsMetrics.economy.totalEntregas}
                        isCurrency
                        helper="Total percibido por entregas de honorarios."
                        accentClassName="from-emerald-500/15"
                        valueClassName="text-emerald-600 dark:text-emerald-400"
                    />
                    <ReportsStatCard
                        icon={PiggyBank}
                        label="Saldo Pendiente"
                        value={reportsMetrics.economy.pendingBalance}
                        isCurrency
                        helper="Diferencia bruta entre facturado y cobrado."
                        accentClassName="from-amber-500/15"
                        valueClassName="text-amber-600 dark:text-amber-400"
                    />
                    <ReportsStatCard
                        icon={Receipt}
                        label="Gastos de Expediente"
                        value={reportsMetrics.economy.totalGastos}
                        isCurrency
                        helper="Gastos registrados asociados a casos."
                        accentClassName="from-rose-500/15"
                        valueClassName="text-rose-600 dark:text-rose-400"
                    />
                </div>

                {/* Gráficos de tendencia de 12 meses */}
                <div className="grid gap-4 lg:grid-cols-2">
                    <EconomiaBarChart
                        title="Honorarios"
                        helper="Monto total de honorarios creados cada mes."
                        data={economyTimeline.map((b) => ({ ...b, value: b.honorarios }))}
                        gradientFrom="from-indigo-950"
                        gradientVia="via-indigo-700"
                        gradientTo="to-indigo-400"
                        gradientHoverTo="hover:to-indigo-300"
                        lineColor="#6366f1"
                    />
                    <EconomiaBarChart
                        title="Gastos"
                        helper="Gastos de expediente registrados cada mes."
                        data={economyTimeline.map((b) => ({ ...b, value: b.gastos }))}
                        gradientFrom="from-rose-950"
                        gradientVia="via-rose-700"
                        gradientTo="to-rose-400"
                        gradientHoverTo="hover:to-rose-300"
                        lineColor="#f43f5e"
                    />
                    <EconomiaBarChart
                        title="Entregas"
                        helper="Total cobrado en entregas de honorarios cada mes."
                        data={economyTimeline.map((b) => ({ ...b, value: b.entregas }))}
                        gradientFrom="from-emerald-950"
                        gradientVia="via-emerald-700"
                        gradientTo="to-emerald-400"
                        gradientHoverTo="hover:to-emerald-300"
                        lineColor="#10b981"
                    />
                    <HonorariosVsGastosChart data={economyTimeline} />
                </div>
            </section>
            <ReportsDashboardNotes />
        </div>
    );
}

export default ReportsDashboard;
