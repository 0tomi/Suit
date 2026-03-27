import { useState, useMemo, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useHotkeyAction } from '../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../hotkeys/hotkeys';
import { Plus, CheckCircle, Trash2 } from 'lucide-react';
import { useDeadlines } from '../context/DeadlinesContext';
import {
    getDeadlineActionErrorMessage,
    markDeadlineCompleted,
    postponeDeadline,
    deleteDeadline,
} from '../services/deadlineService';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { useDeadlinesPageState } from '../hooks/useDeadlinesPageState.js';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { PrimaryActionButton } from '../components/ui/PrimaryActionButton';
import { showAppToast } from '../components/ui/show-app-toast';
import { Button } from '../components/ui/Button';
import { MonthYearSelector } from '../components/ui/MonthYearSelector';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';

import DeadlineKPICards from '../components/deadlines/DeadlineKPICards';
import DeadlinesFilterBar from '../components/deadlines/DeadlinesFilterBar';
import DeadlinesTable from '../components/deadlines/DeadlinesTable';
import NewDeadlineForm from '../components/deadlines/NewDeadlineForm';
import PostponeModal from '../components/deadlines/PostponeModal';
import { deadlinesSteps } from '../constants/tutorialSteps.js';
import { createLogger } from '../services/logService.js';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { format, addDays } from 'date-fns';
import { Pagination } from '../components/ui/Pagination';
import { AnimatedFilterContent } from '../components/ui/AnimatedFilterContent';
import { useAuth } from '../context/AuthContext';
import { getDeadlineAgendaLabel } from '../utils/deadlines/deadlineLabelUtils';
import { usePageFocus } from '../hooks/usePageFocus.js';

const FILTER_STORAGE_KEY = 'deadlines-filter-state';
const logger = createLogger('deadlines-page');

function loadFilterState() {
    try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        return raw ? JSON.parse(raw) : {};
    } catch (error) {
        void logger.warn('No se pudieron restaurar los filtros de vencimientos', error);
        return {};
    }
}

function saveFilterState(state) {
    try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        void logger.warn('No se pudieron persistir los filtros de vencimientos', error);
    }
}

/** Compara dos due_dates (string YYYY-MM-DD). Retorna -1, 0 o 1. */
function compareDates(a, b) {
    const da = a ?? '';
    const db = b ?? '';
    if (da < db) return -1;
    if (da > db) return 1;
    return 0;
}

/** Aplica el ordenamiento según el modo elegido. */
function applySort(list, mode) {
    const copy = [...list];
    switch (mode) {
        case 'date-desc':
            return copy.sort((a, b) => compareDates(b.due_date, a.due_date));
        case 'name-asc':
            return copy.sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''));
        case 'name-desc':
            return copy.sort((a, b) => (b.title ?? '').localeCompare(a.title ?? ''));
        case 'urgentes-first':
            return copy.sort((a, b) => {
                if (a.priority === 'Urgente' && b.priority !== 'Urgente') return -1;
                if (b.priority === 'Urgente' && a.priority !== 'Urgente') return 1;
                return compareDates(a.due_date, b.due_date);
            });
        case 'normales-first':
            return copy.sort((a, b) => {
                if (a.priority === 'Normal' && b.priority !== 'Normal') return -1;
                if (b.priority === 'Normal' && a.priority !== 'Normal') return 1;
                return compareDates(a.due_date, b.due_date);
            });
        case 'date-asc':
        default:
            return copy.sort((a, b) => compareDates(a.due_date, b.due_date));
    }
}

export default function Deadlines() {
    const { deadlines, currentMonth, currentYear, setMonthYear, refreshDeadlines } = useDeadlines();

    // Sincronizar al volver a la pestaña
    usePageFocus({ onFocus: refreshDeadlines });

    const navigate = useNavigate();
    const { user } = useAuth();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    // Hotkeys contextuales
    useHotkeyAction(HOTKEY_ACTIONS.NEW_DEADLINE, () => setIsCreateModalOpen(true));
    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => refreshDeadlines());

    const savedFilters = useMemo(() => loadFilterState(), []);

    const {
        searchTerm, setSearchTerm,
        categoryFilter, setCategoryFilter,
        priorityFilter, setPriorityFilter,
        agendaFilter, setAgendaFilter,
        sortMode, setSortMode,
        dateFilter, setDateFilter,
        isCreateModalOpen, setIsCreateModalOpen,
        postponeModalOpen, setPostponeModalOpen,
        selectedDeadline, setSelectedDeadline,
        selectedIds, setSelectedIds,
        batchLoading, setBatchLoading,
    } = useDeadlinesPageState(savedFilters);

    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    // Persistir filtros
    useEffect(() => {
        saveFilterState({ searchTerm, categoryFilter, priorityFilter, agendaFilter, sortMode });
    }, [searchTerm, categoryFilter, priorityFilter, agendaFilter, sortMode]);

    // Resetear a pág 1 al filtrar o cambiar mes/año
    useEffect(() => {
        setCurrentPage(1);
    }, [searchTerm, categoryFilter, priorityFilter, agendaFilter, sortMode, dateFilter, currentMonth, currentYear]);

    // Handler KPI card "Vencidos" — muestra solo vencidos
    const handleFilterVencidos = () => {
        setDateFilter('vencidos');
        setSearchTerm('');
        setPriorityFilter('all');
        setAgendaFilter('all');
    };

    // Handler KPI cards de fecha — muestra todos menos cumplidos, filtra por rango
    const handleFilterDate = (range) => {
        setDateFilter(range);
        setSearchTerm('');
        setPriorityFilter('all');
        setAgendaFilter('all');
    };

    // Al cambiar filtros manuales, limpiar KPI override
    const handleCategoryChange = (v) => { setDateFilter('all'); setCategoryFilter(v); };
    const handlePriorityChange = (v) => { setDateFilter('all'); setPriorityFilter(v); };
    const handleAgendaChange = (v) => { setDateFilter('all'); setAgendaFilter(v); };
    const handleSearchChange = (val) => { setDateFilter('all'); setSearchTerm(val); };
    const handleSortChange = (v) => setSortMode(v);

    // Agendas disponibles para filtrar, categorizadas por tipo
    const availableAgendas = useMemo(() => {
        const usersSet = new Set();
        const casesSet = new Set();
        (deadlines || []).forEach(d => {
            if (d.status !== 'Cumplido') {
                const label = getDeadlineAgendaLabel(d, user);
                if (label && label !== 'Sin agenda') {
                    if (!d.suit_case_id) {
                        usersSet.add(label);
                    } else {
                        casesSet.add(label);
                    }
                }
            }
        });
        return {
            users: Array.from(usersSet).sort(),
            cases: Array.from(casesSet).sort(),
        };
    }, [deadlines, user]);

    // Filtros combinados
    const filteredDeadlines = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');
        const nextMonthStr = format(addDays(new Date(), 30), 'yyyy-MM-dd');

        let result = (deadlines || []).filter((d) => {
            // Búsqueda de texto
            if (searchTerm) {
                const formattedDate = d.due_date ? dayjs(d.due_date).locale('es').format('D [de] MMMM, YYYY') : '';
                const haystack = `${d.title ?? ''} ${d.description ?? ''} ${d.status ?? ''} ${d.suit_case_id ?? ''} ${formattedDate}`.toLowerCase();
                if (!haystack.includes(searchTerm.toLowerCase())) return false;
            }

            // Filtro KPI (tiene prioridad sobre categoryFilter)
            if (dateFilter === 'vencidos') {
                return d.status === 'Vencido';
            }
            if (dateFilter === 'hoy') {
                if (d.status === 'Cumplido') return false;
                return d.due_date?.slice(0, 10) === todayStr;
            }
            if (dateFilter === 'semana') {
                if (d.status === 'Cumplido') return false;
                const due = d.due_date?.slice(0, 10);
                return due && due >= todayStr && due <= nextWeekStr;
            }
            if (dateFilter === 'mes') {
                if (d.status === 'Cumplido') return false;
                const due = d.due_date?.slice(0, 10);
                return due && due >= todayStr && due <= nextMonthStr;
            }

            // Filtro de categoría
            if (categoryFilter === 'all-except-completed') {
                if (d.status === 'Cumplido') return false;
            } else if (categoryFilter === 'pending-postponed') {
                if (d.status !== 'Pendiente' && d.status !== 'Prorrogado') return false;
            }
            // 'all' → no filtra

            // Filtro de prioridad
            if (priorityFilter !== 'all' && d.priority !== priorityFilter) return false;

            // Filtro de agenda
            if (agendaFilter !== 'all') {
                const label = getDeadlineAgendaLabel(d, user);
                if (label !== agendaFilter) return false;
            }

            return true;
        });

        return applySort(result, sortMode);
    }, [deadlines, searchTerm, categoryFilter, priorityFilter, agendaFilter, dateFilter, sortMode, user]);

    // Batch: toggle individual
    const handleToggleSelect = useCallback((id) => {
        setSelectedIds((prev) => {
            const next = new Set(prev);
            if (next.has(id)) next.delete(id);
            else next.add(id);
            return next;
        });
    }, [setSelectedIds]);

    // Batch: toggle todos los de la página actual
    const handleToggleAll = useCallback((pageItems) => {
        setSelectedIds((prev) => {
            const allSelected = pageItems.every((d) => prev.has(d.id));
            const next = new Set(prev);
            if (allSelected) {
                pageItems.forEach((d) => next.delete(d.id));
            } else {
                pageItems.forEach((d) => next.add(d.id));
            }
            return next;
        });
    }, [setSelectedIds]);

    // Batch: completar seleccionados
    const handleBatchComplete = () => {
        if (selectedIds.size === 0) return;
        openDialog({
            title: 'Marcar como cumplidos',
            desc: `¿Deseas marcar ${selectedIds.size} vencimiento${selectedIds.size !== 1 ? 's' : ''} como cumplidos?`,
            type: 'warning',
            confirmText: 'Sí, cumplir',
            onConfirm: async () => {
                setDialogLoading(true);
                setBatchLoading(true);
                try {
                    const results = await Promise.all([...selectedIds].map((id) => markDeadlineCompleted(id)));
                    const failedResult = results.find((result) => !result?.ok);
                    if (failedResult) {
                        throw new Error(getDeadlineActionErrorMessage(failedResult, 'No se pudieron completar todos los vencimientos.'));
                    }
                    await refreshDeadlines();
                    setSelectedIds(new Set());
                    showAppToast({ title: 'Éxito', description: 'Vencimientos marcados como cumplidos', variant: 'success' });
                    closeDialog();
                } catch (e) {
                    closeDialog();
                    openDialog({ title: 'Error', desc: e.message, type: 'danger', onConfirm: closeDialog });
                } finally {
                    setBatchLoading(false);
                }
            },
        });
    };

    // Batch: eliminar seleccionados
    const handleBatchDelete = () => {
        if (selectedIds.size === 0) return;
        openDialog({
            title: 'Eliminar vencimientos',
            desc: `¿Deseas eliminar ${selectedIds.size} vencimiento${selectedIds.size !== 1 ? 's' : ''}? Esta acción no se puede deshacer.`,
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                setBatchLoading(true);
                try {
                    const results = await Promise.all([...selectedIds].map(async (id) => {
                        return { id, result: await deleteDeadline(id) };
                    }));
                    
                    const failed = results.filter(r => !r.result?.ok);
                    const isForbidden = failed.some(r => r.result?.status === 403);

                    if (failed.length > 0) {
                        if (isForbidden) {
                            showAppToast({ 
                                title: 'Permisos insuficientes', 
                                description: 'Algunos eventos no se pudieron eliminar porque no sos propietario de ellos.', 
                                variant: 'destructive' 
                            });
                        } else {
                            showAppToast({ 
                                title: 'Error', 
                                description: 'No se pudieron eliminar todos los vencimientos.', 
                                variant: 'destructive' 
                            });
                        }
                    } else {
                        showAppToast({ title: 'Éxito', description: 'Vencimientos eliminados correctamente', variant: 'success' });
                    }

                    await refreshDeadlines();
                    setSelectedIds(new Set());
                    closeDialog();
                } catch (e) {
                    closeDialog();
                    openDialog({ title: 'Error', desc: e.message, type: 'danger', onConfirm: closeDialog });
                } finally {
                    setBatchLoading(false);
                }
            },
        });
    };

    const handleCreateSuccess = async () => {
        setIsCreateModalOpen(false);
        await refreshDeadlines();
    };

    const handleMarkCompleted = (d) => {
        openDialog({
            title: 'Marcar como cumplido',
            desc: `¿Deseas dar por cumplido "${d.title}"?`,
            type: 'warning',
            confirmText: 'Sí, cumplir',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await markDeadlineCompleted(d.id);
                    if (!result.ok) {
                        throw new Error(getDeadlineActionErrorMessage(result, 'No se pudo marcar el vencimiento como cumplido.'));
                    }
                    await refreshDeadlines();
                    showAppToast({ title: 'Éxito', description: 'Vencimiento cumplido', variant: 'success' });
                    closeDialog();
                } catch (e) {
                    closeDialog();
                    openDialog({ title: 'Error', desc: e.message, type: 'danger', onConfirm: closeDialog });
                }
            },
        });
    };

    const handlePostponeClick = (d) => {
        setSelectedDeadline(d);
        setPostponeModalOpen(true);
    };

    const handlePostponeConfirm = async (newDate) => {
        try {
            const result = await postponeDeadline(selectedDeadline.id, newDate);
            await refreshDeadlines();
            if (!result.ok) {
                showAppToast({
                    title: result.partialSuccess ? 'Prórroga parcial' : 'Error',
                    description: getDeadlineActionErrorMessage(result, 'No se pudo prorrogar'),
                    variant: result.partialSuccess ? 'warning' : 'destructive',
                });
                return;
            }
            showAppToast({ title: 'Éxito', description: 'Vencimiento prorrogado', variant: 'success' });
        } catch (e) {
            void logger.error('No se pudo prorrogar el vencimiento', e);
            showAppToast({ title: 'Error', description: 'No se pudo prorrogar', variant: 'destructive' });
        } finally {
            setPostponeModalOpen(false);
        }
    };

    return (
        <div className="space-y-4 relative p-6 max-w-7xl mx-auto">

            {/* Header */}
            <div className="flex justify-between items-start gap-4">
                <div>
                    <h1 data-testid="page-deadlines-title" className="flex items-center gap-3 text-3xl font-bold text-(--text-primary)">
                        <span>Vencimientos</span>
                        <SectionTutorialTrigger
                            steps={deadlinesSteps}
                            ariaLabel="Ver tutorial de Vencimientos"
                            testId="deadlines-tutorial-trigger"
                        />
                    </h1>
                    <p className="text-(--text-secondary) mt-1">Control de plazos, audiencias y tareas pendientes</p>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                    <MonthYearSelector
                        month={currentMonth}
                        year={currentYear}
                        onChange={setMonthYear}
                    />
                    <PrimaryActionButton onClick={() => setIsCreateModalOpen(true)} icon={Plus} label="Nuevo Vencimiento" />
                </div>
            </div>

            <DeadlineKPICards
                deadlines={deadlines}
                activeFilter={dateFilter}
                onFilterVencidos={handleFilterVencidos}
                onFilterDate={handleFilterDate}
            />

            <DeadlinesFilterBar
                searchTerm={searchTerm}
                onSearchChange={handleSearchChange}
                categoryFilter={categoryFilter}
                onCategoryChange={handleCategoryChange}
                priorityFilter={priorityFilter}
                onPriorityChange={handlePriorityChange}
                agendaFilter={agendaFilter}
                onAgendaChange={handleAgendaChange}
                availableAgendas={availableAgendas}
                sortMode={sortMode}
                onSortChange={handleSortChange}
                resultCount={filteredDeadlines.length}
            />

            {/* Paginación - Nueva ubicación sugerida por usuario (debajo de searchbar) */}
            {filteredDeadlines.length > itemsPerPage && (
                <Pagination
                    totalItems={filteredDeadlines.length}
                    itemsPerPage={itemsPerPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    className="rounded-xl border border-(--border-subtle) shadow-sm border-t-0"
                />
            )}
            
            {/* Barra de acciones batch */}
            {selectedIds.size > 0 && (
                <div className="flex items-center gap-3 p-3 bg-(--bg-card) border border-(--border-default) rounded-xl shadow-sm">
                    <span className="text-sm text-(--text-secondary) flex-1">
                        {selectedIds.size} vencimiento{selectedIds.size !== 1 ? 's' : ''} seleccionado{selectedIds.size !== 1 ? 's' : ''}
                    </span>
                    <Button
                        size="sm"
                        variant="secondary"
                        onClick={() => setSelectedIds(new Set())}
                    >
                        Cancelar
                    </Button>
                    <Button
                        size="sm"
                        variant="danger"
                        onClick={handleBatchDelete}
                        disabled={batchLoading}
                        className="flex items-center gap-1.5"
                    >
                        <Trash2 className="h-4 w-4" />
                        Eliminar
                    </Button>
                    <Button
                        size="sm"
                        onClick={handleBatchComplete}
                        disabled={batchLoading}
                        className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700"
                    >
                        <CheckCircle className="h-4 w-4" />
                        Completar
                    </Button>
                </div>
            )}

            <DeadlinesTable
                deadlines={filteredDeadlines}
                onNavigate={(d) => navigate(`/deadlines/${d.id}`)}
                onComplete={handleMarkCompleted}
                onPostpone={handlePostponeClick}
                selectedIds={selectedIds}
                onToggleSelect={handleToggleSelect}
                onToggleAll={handleToggleAll}
                sortMode={sortMode}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
                hideAgenda={agendaFilter !== 'all'}
                trigger={`${currentMonth}-${currentYear}-${searchTerm}-${categoryFilter}-${priorityFilter}-${agendaFilter}-${dateFilter}-${sortMode}`}
            />

            {/* Modal crear */}
            <Modal
                open={isCreateModalOpen}
                onClose={() => setIsCreateModalOpen(false)}
                title="Nuevo Vencimiento"
                maxWidth="max-w-2xl"
                footerAlignment="justify-end"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsCreateModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" form="new-deadline-form">Crear Vencimiento</Button>
                    </>
                }
            >
                <NewDeadlineForm
                    onSuccess={handleCreateSuccess}
                    openDialog={openDialog}
                    closeDialog={closeDialog}
                />
            </Modal>

            <PostponeModal
                isOpen={postponeModalOpen}
                onClose={() => setPostponeModalOpen(false)}
                deadline={selectedDeadline}
                onConfirm={handlePostponeConfirm}
            />

            <ConfirmDialog {...dialogProps} />
        </div>
    );
}
