import dayjs from 'dayjs';
import 'dayjs/locale/es';
import localizedFormat from 'dayjs/plugin/localizedFormat';
import relativeTime from 'dayjs/plugin/relativeTime';

dayjs.locale('es');
dayjs.extend(localizedFormat);
dayjs.extend(relativeTime);

import { Table } from '../ui/Table';
import { Badge } from '../ui/Badge';
import { CheckCircle, Clock } from 'lucide-react';
import { EmptyState } from '../ui/EmptyState';
import { Pagination } from '../ui/Pagination';
import { useState, useEffect, useRef } from 'react';
import { Button } from '../ui/Button';
import { useDeadlineColors } from '../../hooks/useDeadlineColors';
import { canPostponeDeadline } from '../../services/deadlineService.js';
import { useSettings } from '../../context/SettingsContext';
import { useAuth } from '../../context/AuthContext';
import { getDeadlineAgendaLabel } from '../../utils/deadlines/deadlineLabelUtils';
import { AnimatedFilterContent } from '../ui/AnimatedFilterContent';

/** Badge de estado con colores correctos según valores de la API. */
function getStatusBadge(deadline) {
    switch (deadline?.status) {
        case 'Cumplido':    return <Badge variant="success">Cumplido</Badge>;
        case 'Vencido':     return <Badge variant="danger">Vencido</Badge>;
        case 'Prorrogado':  return <Badge variant="warning">Prorrogado</Badge>;
        case 'Pendiente':
        default:            return <Badge variant="info">Pendiente</Badge>;
    }
}

/** Badge de prioridad (Normal / Urgente). */
function getPriorityBadge(priority) {
    if (priority === 'Urgente') return <Badge variant="warning" className="animate-pulse">Urgente</Badge>;
    return <Badge variant="default">Normal</Badge>;
}

/**
 * Calcula el texto de countdown relativo a hoy.
 * Ej: "Vence hoy", "Vence en 3 días", "Venció hace 2 días"
 */
function getCountdownText(deadline) {
    if (!deadline.due_date) return null;
    if (deadline.status === 'Cumplido') return null;

    const due = dayjs(deadline.due_date);
    const today = dayjs().startOf('day');
    const diffDays = due.startOf('day').diff(today, 'day');

    if (diffDays === 0) return { text: 'Vence hoy', className: 'text-orange-600' };
    if (diffDays === 1) return { text: 'Vence mañana', className: 'text-orange-500' };
    if (diffDays > 1) return { text: `Vence en ${diffDays} días`, className: 'text-(--text-secondary)' };
    if (diffDays === -1) return { text: 'Venció ayer', className: 'text-red-600' };
    return { text: `Venció hace ${Math.abs(diffDays)} días`, className: 'text-red-600' };
}

const COLUMNS = [
    { header: '' },           // Checkbox
    { header: 'Vencimiento' },
    { header: 'Agenda' },
    { header: 'Fecha Límite' },
    { header: 'Estado' },
    { header: 'Prioridad' },
    { header: 'Acciones', align: 'right' },
];

/**
 * Tabla paginada de vencimientos con:
 * - Colores por estado/prioridad (via useDeadlineColors)
 * - Countdown visual debajo de la fecha
 * - Checkboxes para batch actions
 *- Agrupación por urgencia cuando sortMode es 'urgentes-first' o 'normales-first'
 */
export default function DeadlinesTable({
    deadlines,
    onNavigate,
    onComplete,
    onPostpone,
    selectedIds,
    onToggleSelect,
    onToggleAll,
    sortMode,
    currentPage = 1,
    // onPageChange no se usa aquí pero se recibe como prop (se pasa a Table si fuera necesario, pero Table usa currentPage)
    trigger, // Nuevo prop trigger
    hideAgenda = false,
    newIds = new Set(), // IDs de nuevos items
    onMarkAsSeen = () => {}, // Limpia el badge
}) {
    const { user } = useAuth();
    const itemsPerPage = 10;
    const { getDeadlineStyle } = useDeadlineColors();
    const { urgentBlinkOnEntry } = useSettings();

    // Logic for long press and selection mode
    const isSelectionMode = selectedIds && selectedIds.size > 0;
    const timerRef = useRef(null);
    const [wasLongPress, setWasLongPress] = useState(false);

    // Activa el parpadeo de entrada para filas urgentes durante 2 segundos al montar.
    const [isBlinking, setIsBlinking] = useState(true);
    useEffect(() => {
        if (!urgentBlinkOnEntry) return;
        const timer = setTimeout(() => setIsBlinking(false), 2000);
        return () => clearTimeout(timer);
    }, [urgentBlinkOnEntry]);

    if (!deadlines || deadlines.length === 0) {
        return (
            <EmptyState
                title="No hay vencimientos"
                description="No se encontraron vencimientos con los filtros seleccionados."
            />
        );
    }

    const currentData = deadlines.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    // ¿Están todos los items de la página seleccionados?
    const allPageSelected = currentData.length > 0 && currentData.every((d) => selectedIds?.has(d.id));

    const handleRowClick = (d) => {
        if (wasLongPress) {
            setWasLongPress(false);
            return;
        }
        if (isSelectionMode) {
            onToggleSelect?.(d.id);
        } else {
            onNavigate(d);
        }
    };

    const startLongPress = (d) => {
        setWasLongPress(false);
        if (isSelectionMode) return;
        timerRef.current = setTimeout(() => {
            onToggleSelect?.(d.id);
            setWasLongPress(true);
        }, 250);
    };

    const cancelLongPress = () => {
        if (timerRef.current) {
            clearTimeout(timerRef.current);
            timerRef.current = null;
        }
    };

    // Pre-computar los items con sus headers de grupo (evita mutación durante render)
    const showGroupHeaders = sortMode === 'urgentes-first' || sortMode === 'normales-first';
    const rowItems = currentData.reduce((acc, d) => {
        if (showGroupHeaders) {
            const group = d.priority === 'Urgente' ? 'urgente' : 'normal';
            const lastItem = acc[acc.length - 1];
            const lastGroup = lastItem ? (lastItem.type === 'group' ? lastItem.group : lastItem.group) : null;
            if (group !== lastGroup) {
                acc.push({ type: 'group', group, label: group === 'urgente' ? 'Urgentes' : 'Normales' });
            }
        }
        acc.push({ type: 'row', data: d, group: d.priority === 'Urgente' ? 'urgente' : 'normal' });
        return acc;
    }, []);

    const dynamicColumns = isSelectionMode
        ? [
            {
                header: (
                    <input
                        type="checkbox"
                        checked={allPageSelected}
                        onChange={(e) => {
                            e.stopPropagation();
                            onToggleAll?.(currentData);
                        }}
                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                ),
                key: 'selection-col',
                className: 'w-10'
            },
            ...COLUMNS.slice(1)
        ]
        : COLUMNS.slice(1);

    const finalColumns = hideAgenda 
        ? dynamicColumns.filter(c => c.header !== 'Agenda') 
        : dynamicColumns;

    return (
        <AnimatedFilterContent trigger={trigger} className="space-y-4 select-none">
            <Table columns={finalColumns} isEmpty={false} emptyMessage="" currentPage={currentPage}>
                {rowItems.map((item) => {
                    if (item.type === 'group') {
                        const colSpan = isSelectionMode ? (hideAgenda ? 5 : 6) : (hideAgenda ? 4 : 5);
                        return (
                            <tr key={`group-${item.group}`} className="pointer-events-none">
                                <td colSpan={colSpan} className="px-6 py-2 text-xs font-semibold text-(--text-secondary) uppercase tracking-widest bg-(--bg-page)">
                                    {item.label}
                                </td>
                            </tr>
                        );
                    }

                    const d = item.data;
                    const rowStyle = getDeadlineStyle(d);
                    const isSelected = selectedIds?.has(d.id) ?? false;
                    const isNew = newIds.has(Number(d.id));
                    const countdown = getCountdownText(d);
                    const isUrgentBlink = urgentBlinkOnEntry && isBlinking && d.priority === 'Urgente' && d.status !== 'Cumplido';
                    return (
                        <tr
                            key={d.id}
                            className={`hover:brightness-95 transition-all cursor-pointer group${isUrgentBlink ? ' deadline-urgent-blink' : ''}${isSelected ? ' ring-2 ring-blue-500 ring-inset brightness-95' : ''}`}
                            style={rowStyle}
                            onClick={() => handleRowClick(d)}
                            onMouseEnter={() => isNew && onMarkAsSeen('events', d.id)}
                            onMouseDown={() => startLongPress(d)}
                            onMouseUp={cancelLongPress}
                            onMouseLeave={cancelLongPress}
                            onTouchStart={() => startLongPress(d)}
                            onTouchEnd={cancelLongPress}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleRowClick(d);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            {/* Checkbox condicional */}
                            {isSelectionMode && (
                                <td className="pl-4 pr-2 py-4 w-10">
                                    <input
                                        type="checkbox"
                                        checked={isSelected}
                                        onChange={() => onToggleSelect?.(d.id)}
                                        onClick={(e) => e.stopPropagation()}
                                        onKeyDown={(e) => e.stopPropagation()}
                                        className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                                        aria-label={`Seleccionar ${d.title}`}
                                    />
                                </td>
                            )}

                            {/* Título */}
                            <td className="px-6 py-4">
                                <div className="flex items-center gap-2">
                                    <span className="font-medium text-(--text-primary)">{d.title}</span>
                                    {isNew && (
                                        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-black bg-red-500 text-white border border-red-600 shadow-sm animate-pulse-subtle">
                                            NUEVO
                                        </span>
                                    )}
                                </div>
                                {d.description && (
                                    <span className="text-xs text-(--text-secondary) truncate max-w-xs block mt-0.5">{d.description}</span>
                                )}
                            </td>

                            {/* Agenda */}
                            {!hideAgenda && (
                                <td className="px-6 py-4">
                                    {(() => {
                                        const displayName = getDeadlineAgendaLabel(d, user);

                                        if (displayName === 'Sin agenda') {
                                            return <span className="text-xs text-(--text-tertiary) italic">Sin agenda</span>;
                                        }

                                        return (
                                            <div className="flex items-center gap-2">
                                                <div 
                                                    className="w-2 h-2 rounded-full flex-shrink-0" 
                                                    style={{ backgroundColor: d.agenda_color || 'var(--text-tertiary)' }}
                                                />
                                                <span className="text-sm text-(--text-secondary) truncate max-w-[120px]" title={displayName}>
                                                    {displayName}
                                                </span>
                                            </div>
                                        );
                                    })()}
                                </td>
                            )}

                            {/* Fecha + countdown */}
                            <td className="px-6 py-4 text-sm">
                                <span className="text-(--text-secondary)">
                                    {(() => {
                                        if (!d.due_date) return '-';
                                        const dateObj = dayjs(d.due_date).locale('es');
                                        const hasTime = d.due_date.includes(':') && !d.due_date.includes('00:00:00');
                                        if (hasTime) {
                                            return dateObj.format('D [de] MMMM, YYYY - HH:mm [hs]');
                                        }
                                        return dateObj.format('D [de] MMMM, YYYY');
                                    })()}
                                </span>
                                {countdown && (
                                    <span className={`block text-xs mt-0.5 ${countdown.className}`}>
                                        {countdown.text}
                                    </span>
                                )}
                            </td>

                            <td className="px-6 py-4">{getStatusBadge(d)}</td>
                            <td className="px-6 py-4">{getPriorityBadge(d.priority)}</td>

                            {/* Acciones */}
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-2">
                                    {d.status !== 'Cumplido' && (
                                        <>
                                            <Button
                                                size="icon"
                                                variant="ghost"
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    onComplete(d);
                                                }}
                                                onMouseDown={(e) => e.stopPropagation()}
                                                title="Marcar como cumplido"
                                                className="text-(--text-tertiary) hover:text-green-600 hover:bg-green-500/10"
                                            >
                                                <CheckCircle className="h-4 w-4" />
                                            </Button>
                                            {canPostponeDeadline(d) && (
                                                <Button
                                                    size="icon"
                                                    variant="ghost"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        onPostpone(d);
                                                    }}
                                                    onMouseDown={(e) => e.stopPropagation()}
                                                    title="Prorrogar"
                                                    className="text-(--text-tertiary) hover:text-amber-600 hover:bg-amber-500/10"
                                                >
                                                    <Clock className="h-4 w-4" />
                                                </Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                })}
            </Table>

            {/* Info de selección fallback */}
            {selectedIds && selectedIds.size > 0 && (
                <div className="flex items-center gap-2 text-xs text-(--text-tertiary) px-1 italic">
                    <span>{selectedIds.size} vencimiento{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}</span>
                    <button 
                         onClick={() => onToggleAll?.(currentData)}
                         className="underline hover:text-blue-600"
                    >
                        {allPageSelected ? 'Deseleccionar todos en esta página' : 'Seleccionar todos en esta página'}
                    </button>
                </div>
            )}
        </AnimatedFilterContent>
    );
}
