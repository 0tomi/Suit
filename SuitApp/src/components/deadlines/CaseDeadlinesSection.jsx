import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useDeadlines } from '../../context/DeadlinesContext';
import {
    getDeadlineActionErrorMessage,
    markDeadlineCompleted,
    postponeDeadline,
} from '../../services/deadlineService';
import { useConfirmDialog } from '../../hooks/useConfirmDialog';
import { ConfirmDialog } from '../../components/ui/ConfirmDialog';
import { Modal } from '../../components/ui/Modal';
import { Button } from '../../components/ui/Button';
import { PrimaryActionButton } from '../../components/ui/PrimaryActionButton';
import { showAppToast } from '../../components/ui/show-app-toast';
import DeadlinesTable from './DeadlinesTable';
import NewDeadlineForm from './NewDeadlineForm';
import PostponeModal from './PostponeModal';
import { createLogger } from '../../services/logService.js';
import DeadlinesFilterBar from './DeadlinesFilterBar';

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

const logger = createLogger('case-deadlines-section');

export default function CaseDeadlinesSection({ caseId, newIds, onMarkAsSeen }) {
    const navigate = useNavigate();
    const { deadlines, refreshDeadlines } = useDeadlines();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [postponeModalOpen, setPostponeModalOpen] = useState(false);
    const [selectedDeadline, setSelectedDeadline] = useState(null);

    // Filtros
    const [searchTerm, setSearchTerm] = useState('');
    const [categoryFilter, setCategoryFilter] = useState('all-except-completed');
    const [priorityFilter, setPriorityFilter] = useState('all');
    const [sortMode, setSortMode] = useState('date-asc');

    // Initial fetch in case DeadlinesContext isn't fully synced or we want to ensure fresh data.
    useEffect(() => {
        refreshDeadlines();
    }, [refreshDeadlines]);

    const filteredDeadlines = useMemo(() => {
        if (!deadlines) return [];
        
        let result = deadlines.filter(d => String(d.suit_case_id) === String(caseId));

        result = result.filter(d => {
            // Búsqueda
            if (searchTerm) {
                const haystack = `${d.title ?? ''} ${d.description ?? ''} ${d.status ?? ''}`.toLowerCase();
                if (!haystack.includes(searchTerm.toLowerCase())) return false;
            }

            // Categoría
            if (categoryFilter === 'all-except-completed') {
                if (d.status === 'Cumplido') return false;
            } else if (categoryFilter === 'pending-postponed') {
                if (d.status !== 'Pendiente' && d.status !== 'Prorrogado') return false;
            }

            // Prioridad
            if (priorityFilter !== 'all' && d.priority !== priorityFilter) return false;

            return true;
        });

        return applySort(result, sortMode);
    }, [deadlines, caseId, searchTerm, categoryFilter, priorityFilter, sortMode]);

    const paginationResetKey = `${caseId}-${filteredDeadlines.length}-${searchTerm}-${categoryFilter}-${priorityFilter}-${sortMode}`;

    const handleCreateSuccess = async () => {
        setIsCreateModalOpen(false);
        await refreshDeadlines();
    };

    const handleMarkCompleted = (d) => {
        openDialog({
            title: 'Marcar como cumplido',
            desc: `¿Deseas dar por cumplido el vencimiento: "${d.title}"?`,
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
                    openDialog({ title: 'Error', desc: 'No se pudo completar: ' + e.message, type: 'danger', onConfirm: closeDialog });
                }
            }
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
            void logger.error('No se pudo completar la accion sobre el vencimiento del caso', e);
            showAppToast({ title: 'Error', description: 'No se pudo prorrogar', variant: 'destructive' });
        } finally {
            setPostponeModalOpen(false);
        }
    };

    return (
        <div className="space-y-4">
            <div className="flex justify-between items-center mb-4">
                <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider">
                    Vencimientos del Caso
                </h3>
                <PrimaryActionButton 
                    onClick={() => setIsCreateModalOpen(true)} 
                    icon={Plus} 
                    label="Agregar Vencimiento" 
                    size="sm"
                />
            </div>

            <div className="mb-2">
                <DeadlinesFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={setSearchTerm}
                    categoryFilter={categoryFilter}
                    onCategoryChange={setCategoryFilter}
                    priorityFilter={priorityFilter}
                    onPriorityChange={setPriorityFilter}
                    sortMode={sortMode}
                    onSortChange={setSortMode}
                    resultCount={filteredDeadlines.length}
                    hideAgenda={true}
                />
            </div>

            <DeadlinesTable 
                deadlines={filteredDeadlines}
                onNavigate={(d) => navigate(`/deadlines/${d.id}`)}
                onComplete={handleMarkCompleted}
                onPostpone={handlePostponeClick}
                onDelete={() => {}}
                paginationResetKey={paginationResetKey}
                hideAgenda={true}
                newIds={newIds}
                onMarkAsSeen={onMarkAsSeen}
            />

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
                    caseIdPreselected={String(caseId)}
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
