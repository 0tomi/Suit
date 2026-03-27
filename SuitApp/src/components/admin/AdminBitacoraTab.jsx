import { useCallback, useEffect, useMemo, useState } from 'react';
import {
    BookOpen,
    Clock3,
    Eye,
    RefreshCw,
    Trash2,
    UserRound,
} from 'lucide-react';
import { Table } from '../ui/Table.jsx';
import { Badge } from '../ui/Badge.jsx';
import { Button } from '../ui/Button.jsx';
import { Input } from '../ui/Input.jsx';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '../ui/Select.jsx';
import { Pagination } from '../ui/Pagination.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';
import AdminBitacoraDetailModal from './AdminBitacoraDetailModal.jsx';
import {
    BITACORA_ENTITY_TYPE_LABELS,
    BITACORA_ENTITY_TYPE_OPTIONS,
    BITACORA_SORT_OPTIONS,
    cleanupBitacora,
    clearBitacora,
    getBitacoraPage,
    resolveBitacoraActionLabel,
} from '../../services/adminBitacoraService.js';
import { createLogger } from '../../services/logService.js';

const logger = createLogger('admin-bitacora-tab');
const ITEMS_PER_PAGE = 30;
const COLUMNS = [
    { key: 'fecha', header: 'Fecha' },
    { key: 'actor', header: 'Actor' },
    { key: 'movimiento', header: 'Movimiento' },
    { key: 'entidad', header: 'Entidad' },
    { key: 'resumen', header: 'Resumen' },
    { key: 'acciones', header: 'Acciones', align: 'right', className: 'w-24' },
];
const dateFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function formatDate(value) {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return dateFormatter.format(parsed);
}

function getActionBadgeVariant(action) {
    switch (action) {
        case 'created':
        case 'uploaded':
        case 'photo_uploaded':
        case 'participant_added':
            return 'success';
        case 'deleted':
        case 'participant_removed':
            return 'danger';
        case 'closed':
        case 'locked':
        case 'status_updated':
        case 'name_updated':
            return 'warning';
        case 'updated':
        case 'reopened':
        case 'unlocked':
        default:
            return 'info';
    }
}

function resolveActorName(entry) {
    const fullName = [entry?.user?.name, entry?.user?.lastName].filter(Boolean).join(' ').trim();
    return fullName || 'Usuario sin nombre';
}

function resolveEntityLabel(entry) {
    return BITACORA_ENTITY_TYPE_LABELS[entry?.entityInfo?.type] || entry?.entityInfo?.type || 'Entidad desconocida';
}

function resolveSummary(entry) {
    const label = entry?.entityInfo?.data?.name || entry?.entityInfo?.name;
    if (label) return label;

    if (entry?.entityInfo?.data === null) {
        return 'Este registro ya no tiene más datos disponibles.';
    }

    return 'Movimiento sin resumen disponible.';
}

/**
 * Convierte el input textual a entero positivo y evita mandar al backend un body ambiguo.
 */
function parseCleanupDays(value) {
    const parsed = Number.parseInt(String(value || '').trim(), 10);
    if (!Number.isInteger(parsed) || parsed < 1) {
        throw new Error('Ingresá una cantidad de días válida mayor o igual a 1.');
    }
    return parsed;
}

const AdminBitacoraTab = ({ openDialog, closeDialog, setDialogLoading }) => {
    const [entityType, setEntityType] = useState('all');
    const [sort, setSort] = useState('newest');
    const [cleanupDays, setCleanupDays] = useState('30');
    const [currentPage, setCurrentPage] = useState(1);
    const [refreshKey, setRefreshKey] = useState(0);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [pageData, setPageData] = useState({
        items: [],
        pagination: {
            currentPage: 1,
            lastPage: 1,
            total: 0,
            perPage: ITEMS_PER_PAGE,
        },
    });
    const [selectedEntry, setSelectedEntry] = useState(null);

    const activeEntityLabel = useMemo(() => {
        return BITACORA_ENTITY_TYPE_OPTIONS.find((option) => option.value === entityType)?.label || 'Todas las entidades';
    }, [entityType]);

    const requestRefresh = useCallback(() => {
        setRefreshKey((prev) => prev + 1);
    }, []);

    useEffect(() => {
        let cancelled = false;

        async function loadBitacora() {
            setLoading(true);
            setError('');
            try {
                const nextPage = await getBitacoraPage({
                    entityType,
                    sort,
                    page: currentPage,
                });

                if (cancelled) return;
                setPageData(nextPage);
            } catch (loadError) {
                if (cancelled) return;
                const message = loadError?.message || 'No se pudo cargar la bitácora.';
                setError(message);
                void logger.error('bitacora load failed in admin tab', {
                    entityType,
                    sort,
                    currentPage,
                    error: message,
                });
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadBitacora();
        return () => {
            cancelled = true;
        };
    }, [entityType, sort, currentPage, refreshKey]);

    const handleEntityTypeChange = useCallback((value) => {
        setEntityType(value);
        setCurrentPage(1);
    }, []);

    const handleSortChange = useCallback((value) => {
        setSort(value);
        setCurrentPage(1);
    }, []);

    const handleCleanupRequest = useCallback(() => {
        openDialog({
            title: '¿Ejecutar mantenimiento de bitácora?',
            desc: `Se conservarán solamente los registros de los últimos ${cleanupDays} días.`,
            type: 'danger',
            confirmText: 'Ejecutar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const days = parseCleanupDays(cleanupDays);
                    await cleanupBitacora(days);
                    closeDialog();
                    showAppToast({
                        title: 'Mantenimiento ejecutado',
                        description: `Se conservaron los registros de los últimos ${days} días.`,
                        variant: 'success',
                    });
                    setCurrentPage(1);
                    requestRefresh();
                } catch (actionError) {
                    setDialogLoading(false);
                    openDialog({
                        title: 'Error al ejecutar mantenimiento',
                        desc: actionError.message || 'No se pudo ejecutar el mantenimiento de la bitácora.',
                        type: 'danger',
                        confirmText: 'Aceptar',
                        onConfirm: closeDialog,
                    });
                }
            },
        });
    }, [cleanupDays, closeDialog, openDialog, requestRefresh, setDialogLoading]);

    const handleClearRequest = useCallback(() => {
        openDialog({
            title: '¿Limpiar toda la bitácora?',
            desc: 'Esta acción elimina permanentemente todos los registros remotos de la bitácora.',
            type: 'danger',
            confirmText: 'Limpiar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    await clearBitacora();
                    closeDialog();
                    showAppToast({
                        title: 'Bitácora limpiada',
                        description: 'Todos los registros de la bitácora fueron eliminados.',
                        variant: 'success',
                    });
                    setCurrentPage(1);
                    requestRefresh();
                } catch (actionError) {
                    setDialogLoading(false);
                    openDialog({
                        title: 'Error al limpiar la bitácora',
                        desc: actionError.message || 'No se pudo limpiar la bitácora.',
                        type: 'danger',
                        confirmText: 'Aceptar',
                        onConfirm: closeDialog,
                    });
                }
            },
        });
    }, [closeDialog, openDialog, requestRefresh, setDialogLoading]);

    return (
        <>
            <div className="space-y-6">
                <section className="relative overflow-hidden rounded-2xl border border-(--border-default) bg-(--bg-card)">
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-sky-500/10 blur-3xl" />
                        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-cyan-500/10 blur-3xl" />
                    </div>
                    <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-start lg:justify-between">
                        <div className="max-w-2xl">
                            <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-sky-600 dark:text-sky-300">
                                <BookOpen className="h-3.5 w-3.5" />
                                Libro de movimientos
                            </div>
                            <h2 className="mt-3 text-2xl font-semibold text-(--text-primary)">Bitácora administrativa</h2>
                            <p className="mt-2 text-sm text-(--text-secondary)">
                                Revisá los movimientos guardados en el servidor, filtrá por tipo y abrí cada registro para ver sus datos.
                            </p>
                        </div>

                        <div className="grid gap-3 sm:grid-cols-3">
                            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3 shadow-sm">
                                <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">Total filtrado</p>
                                <p className="mt-1 text-2xl font-semibold text-(--text-primary)">{pageData.pagination.total || 0}</p>
                            </div>
                            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3 shadow-sm">
                                <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">Entidad activa</p>
                                <p className="mt-1 text-sm font-semibold text-(--text-primary)">{activeEntityLabel}</p>
                            </div>
                            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3 shadow-sm">
                                <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">Página actual</p>
                                <p className="mt-1 text-sm font-semibold text-(--text-primary)">
                                    {pageData.pagination.currentPage || 1} / {pageData.pagination.lastPage || 1}
                                </p>
                            </div>
                        </div>
                    </div>
                </section>

                <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4">
                        <div className="grid gap-3 rounded-2xl border border-(--border-default) bg-(--bg-card) p-4 shadow-sm md:grid-cols-[minmax(0,1fr)_220px_140px]">
                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Tipo de entidad</p>
                                <div className="mt-2">
                                    <Select value={entityType} onValueChange={handleEntityTypeChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Todas las entidades" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {BITACORA_ENTITY_TYPE_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div>
                                <p className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">Orden</p>
                                <div className="mt-2">
                                    <Select value={sort} onValueChange={handleSortChange}>
                                        <SelectTrigger>
                                            <SelectValue placeholder="Más recientes primero" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {BITACORA_SORT_OPTIONS.map((option) => (
                                                <SelectItem key={option.value} value={option.value}>
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="flex items-end">
                                <Button
                                    variant="outline"
                                    icon={RefreshCw}
                                    onClick={requestRefresh}
                                    className="w-full"
                                    isLoading={loading}
                                >
                                    Recargar
                                </Button>
                            </div>
                        </div>

                        {error ? (
                            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3">
                                <p className="text-sm font-medium text-red-700">No se pudo cargar la bitácora.</p>
                                <p className="mt-1 text-sm text-red-700/90 dark:text-red-300">{error}</p>
                            </div>
                        ) : null}

                        <Table
                            columns={COLUMNS}
                            isEmpty={!loading && pageData.items.length === 0}
                            emptyMessage="No se encontraron movimientos para los filtros actuales."
                            currentPage={pageData.pagination.currentPage}
                        >
                            {loading ? (
                                <tr>
                                    <td colSpan={COLUMNS.length} className="px-6 py-10 text-center text-sm text-(--text-secondary)">
                                        Cargando bitácora...
                                    </td>
                                </tr>
                            ) : pageData.items.map((entry) => (
                                <tr key={`${entry.id}-${entry.createdAt}`} className="hover:bg-(--bg-card-hover)">
                                    <td className="px-6 py-4 text-sm text-(--text-primary)">{formatDate(entry.createdAt)}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2 text-sm text-(--text-primary)">
                                            <UserRound className="h-4 w-4 text-(--text-tertiary)" />
                                            <span>{resolveActorName(entry)}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant={getActionBadgeVariant(entry.action)}>
                                            {resolveBitacoraActionLabel(entry.action)}
                                        </Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <Badge variant="default">{resolveEntityLabel(entry)}</Badge>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="space-y-1">
                                            <p className="text-sm font-medium text-(--text-primary)">{resolveSummary(entry)}</p>
                                            <p className="text-xs text-(--text-secondary)">
                                                {entry.entityInfo?.id != null ? `ID ${entry.entityInfo.id}` : 'Sin identificador'}
                                            </p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <Button
                                            variant="ghost"
                                            size="sm"
                                            icon={Eye}
                                            onClick={() => setSelectedEntry(entry)}
                                            aria-label={`Ver detalle del movimiento ${entry.id ?? ''}`}
                                        >
                                            Ver
                                        </Button>
                                    </td>
                                </tr>
                            ))}
                        </Table>

                        <Pagination
                            totalItems={pageData.pagination.total || 0}
                            itemsPerPage={pageData.pagination.perPage || ITEMS_PER_PAGE}
                            currentPage={pageData.pagination.currentPage || currentPage}
                            onPageChange={setCurrentPage}
                        />
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-2xl border border-(--border-default) bg-(--bg-card) p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Clock3 className="h-5 w-5 text-amber-500" />
                                <h3 className="text-lg font-semibold text-(--text-primary)">Mantenimiento</h3>
                            </div>
                            <p className="mt-2 text-sm text-(--text-secondary)">
                                Esta limpieza borra los movimientos más antiguos que la cantidad de días elegida.
                            </p>
                            <div className="mt-4 space-y-3">
                                <div>
                                    <label className="text-xs font-semibold uppercase tracking-wide text-(--text-secondary)">
                                        Días a conservar
                                    </label>
                                    <Input
                                        type="number"
                                        min="1"
                                        value={cleanupDays}
                                        onChange={(event) => setCleanupDays(event.target.value)}
                                        className="mt-2"
                                    />
                                </div>
                                <Button variant="outline" className="w-full" onClick={handleCleanupRequest}>
                                    Ejecutar mantenimiento
                                </Button>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Trash2 className="h-5 w-5 text-red-500" />
                                <h3 className="text-lg font-semibold text-(--text-primary)">Limpieza total</h3>
                            </div>
                            <p className="mt-2 text-sm text-(--text-secondary)">
                                Usá esta acción solo si necesitás vaciar por completo la bitácora del servidor. Después no se podrán recuperar estos movimientos.
                            </p>
                            <Button variant="danger" className="mt-4 w-full" onClick={handleClearRequest}>
                                Limpiar toda la bitácora
                            </Button>
                        </div>
                    </aside>
                </section>
            </div>

            <AdminBitacoraDetailModal
                open={Boolean(selectedEntry)}
                onClose={() => setSelectedEntry(null)}
                entry={selectedEntry}
            />
        </>
    );
};

export default AdminBitacoraTab;
