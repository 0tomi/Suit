import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { usePartes } from '../../context/PartesContext';
import { useRoles } from '../../context/RolesContext';
import { deleteParte } from '../../services/parteService.js';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';
import { Button } from '../ui/Button';
import PeopleSectionLayout from './PeopleSectionLayout';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { createLogger } from '../../services/logService.js';
import { NewParteModal } from './NewParteModal';
import { useModal } from '../../context/ModalContext';
import PartesFilterBar from './PartesFilterBar';

const logger = createLogger('people-partes-tab');
const FILTER_STORAGE_KEY = 'partes-filter-state';

function loadFilterState() {
    try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        void logger.warn('No se pudieron restaurar los filtros de partes', error);
        return null;
    }
}

function saveFilterState(state) {
    try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        void logger.warn('No se pudieron persistir los filtros de partes', error);
    }
}

const DEFAULT_FILTERS = {
    searchTerm: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
};

function sortPartes(list, sortBy, sortOrder) {
    return [...list].sort((a, b) => {
        if (sortBy === 'alpha') {
            const aName = `${a.nombre || ''} ${a.apellido || ''}`.toLowerCase();
            const bName = `${b.nombre || ''} ${b.apellido || ''}`.toLowerCase();
            const cmp = aName.localeCompare(bName, 'es');
            return sortOrder === 'asc' ? cmp : -cmp;
        }
        // created_at
        const aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
}

const PartesTab = () => {
    const { partes, refreshPartes } = usePartes();
    const { roles } = useRoles();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const { openModal } = useModal();

    const savedFilters = loadFilterState() || {};
    const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm ?? DEFAULT_FILTERS.searchTerm);
    const [sortBy, setSortBy] = useState(savedFilters.sortBy ?? DEFAULT_FILTERS.sortBy);
    const [sortOrder, setSortOrder] = useState(savedFilters.sortOrder ?? DEFAULT_FILTERS.sortOrder);

    const [currentPage, setCurrentPage] = useState(1);
    const [optimisticPartes, setOptimisticPartes] = useState([]);
    const itemsPerPage = 10;

    useEffect(() => {
        saveFilterState({ searchTerm, sortBy, sortOrder });
    }, [searchTerm, sortBy, sortOrder]);

    useEffect(() => {
        // Cuando la parte ya llegó desde el contexto global, dejamos de sostenerla
        // en el estado optimista local para no duplicar filas en la tabla.
        setOptimisticPartes((prev) => prev.filter((parte) => (
            !partes.some((persistedParte) => String(persistedParte.id) === String(parte.id))
        )));
    }, [partes]);

    const handleOpenNewParteModal = () => {
        openModal(NewParteModal, {
            onParteCreated: (createdParte) => {
                setCurrentPage(1);
                if (!createdParte?.id) {
                    void refreshPartes();
                    return;
                }

                setOptimisticPartes((prev) => [
                    createdParte,
                    ...prev.filter((parte) => String(parte.id) !== String(createdParte.id)),
                ]);
            },
        }, { overlayClass: 'bg-black/10 backdrop-blur-[2px]' });
    };

    const getRolName = (rolId) => {
        const rol = roles.find(r => r.id === rolId);
        return rol ? rol.titulo : 'N/A';
    };

    const visiblePartes = useMemo(() => {
        const persistedIds = new Set(partes.map((parte) => String(parte.id)));
        const pendingPartes = optimisticPartes.filter((parte) => !persistedIds.has(String(parte.id)));
        return [...pendingPartes, ...partes];
    }, [optimisticPartes, partes]);

    const filteredPartes = useMemo(() => {
        const search = searchTerm.trim().toLowerCase();
        let filtered = visiblePartes;

        if (search) {
            filtered = visiblePartes.filter(parte => {
                const fullName = `${parte.nombre || ''} ${parte.apellido || ''}`.toLowerCase();
                const rolName = getRolName(parte.rol_id).toLowerCase();
                return fullName.includes(search) || 
                       rolName.includes(search) || 
                       (parte.email && parte.email.toLowerCase().includes(search)) ||
                       (parte.telefono && parte.telefono.includes(search));
            });
        }
        
        return sortPartes(filtered, sortBy, sortOrder);
    }, [visiblePartes, searchTerm, sortBy, sortOrder, roles]);

    const paginatedPartes = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredPartes.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredPartes, currentPage]);

    const handleDelete = (id, e) => {
        e.stopPropagation();
        openDialog({
            title: '¿Eliminar parte?',
            desc: 'Esta acción no se puede deshacer. La parte será eliminada del directorio global.',
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await deleteParte(id);
                    if (result.ok) {
                        // PAR-6: limpiar filas huérfanas del pivot parte_caso para
                        // evitar JOIN inválidos al leer offline en casos vinculados.
                        await window.electronAPI.db.deleteWhere('parte_caso', { parte_id: id });
                        showAppToast({
                            title: 'Éxito',
                            description: 'Parte eliminada correctamente.',
                            variant: 'success',
                        });
                        refreshPartes();
                    } else {
                        showAppToast({
                            title: 'Error',
                            description: result.error || 'Error al eliminar la parte.',
                            variant: 'danger',
                        });
                    }
                } catch (err) {
                    void logger.error('Error deleting parte', err);
                    showAppToast({ title: 'Error', description: 'Ocurrió un error al contactar al servidor.', variant: 'danger' });
                } finally {
                    setDialogLoading(false);
                    closeDialog();
                }
            }
        });
    };

    const hasActiveSearch = searchTerm.trim().length > 0;

    return (
        <PeopleSectionLayout
            title="Partes"
            titleTestId="page-partes-title"
            description="Gestiona las partes involucradas en los casos."
            primaryAction={{
                icon: Plus,
                label: "Nueva Parte",
                onClick: handleOpenNewParteModal
            }}
            filterBar={
                <PartesFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={(val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    }}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    resultCount={hasActiveSearch ? filteredPartes.length : undefined}
                />
            }
            tableProps={{
                isEmpty: filteredPartes.length === 0,
                emptyMessage: hasActiveSearch ? "No se encontraron resultados para tu búsqueda." : "No se encontraron partes.",
                columns: [
                    { header: 'Nombre' },
                    { header: 'Rol' },
                    { header: 'Contacto' },
                    { header: 'Acciones', align: 'right' }
                ]
            }}
            items={paginatedPartes}
            renderRow={(parte) => {
                const fullName = `${parte.nombre || ''} ${parte.apellido || ''}`.trim();
                return (
                    <tr key={parte.id} className="hover:bg-(--bg-card-hover) transition-colors group">
                        <td className="px-6 py-4">
                            <div className="font-medium text-(--text-primary)">{fullName || 'Sin nombre'}</div>
                        </td>
                        <td className="px-6 py-4 text-(--text-secondary)">{getRolName(parte.rol_id)}</td>
                        <td className="px-6 py-4">
                            <div className="flex flex-col space-y-1">
                                {parte.email && <div className="text-sm text-(--text-secondary)">{parte.email}</div>}
                                {parte.telefono && <div className="text-sm text-(--text-secondary)">{parte.telefono}</div>}
                                {!parte.email && !parte.telefono && <span className="text-sm text-(--text-tertiary)">Sin datos</span>}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <Button
                                variant="ghost"
                                size="icon"
                                icon={Trash2}
                                onClick={(e) => handleDelete(parte.id, e)}
                                className="text-(--text-tertiary) hover:text-red-600 hover:bg-red-500/10"
                            />
                        </td>
                    </tr>
                );
            }}
            paginationProps={{
                totalItems: filteredPartes.length,
                itemsPerPage,
                currentPage,
                onPageChange: setCurrentPage
            }}
        >
            <ConfirmDialog {...dialogProps} />
        </PeopleSectionLayout>
    );
};

export default PartesTab;
