import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { useRoles } from '../../context/RolesContext';
import { deleteParte } from '../../services/parteService.js';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';
import { Button } from '../ui/Button';
import PeopleSectionLayout from './PeopleSectionLayout';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { Badge } from '../ui/Badge.jsx';
import { createLogger } from '../../services/logService.js';
import { NewParteModal } from './NewParteModal';
import { useModal } from '../../context/ModalContext';
import ParteDetailModal from './ParteDetailModal.jsx';
import PartesFilterBar from './PartesFilterBar';
import {
    getPartesListingPage,
    invalidatePartesListingCache,
} from '../../services/partesListingBackendService.js';

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

const INITIAL_LISTING_STATE = {
    items: [],
    page: 1,
    total: 0,
    totalPages: 1,
    perPage: 10,
    source: 'cache',
};

function normalizePartesListingResponse(response) {
    const payload = response && typeof response === 'object' ? response : {};
    const items = Array.isArray(payload.items) ? payload.items : [];

    return {
        items,
        page: Number(payload.page ?? 1) || 1,
        total: Number(payload.total ?? items.length) || 0,
        totalPages: Math.max(1, Number(payload.totalPages ?? 1) || 1),
        perPage: Math.max(1, Number(payload.perPage ?? 10) || 10),
        source: payload.source || 'cache',
    };
}

const PartesTab = () => {
    const { roles } = useRoles();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const { openModal } = useModal();
    const requestIdRef = useRef(0);

    const savedFilters = loadFilterState() || {};
    const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm ?? DEFAULT_FILTERS.searchTerm);
    const [sortBy, setSortBy] = useState(savedFilters.sortBy ?? DEFAULT_FILTERS.sortBy);
    const [sortOrder, setSortOrder] = useState(savedFilters.sortOrder ?? DEFAULT_FILTERS.sortOrder);
    const [currentPage, setCurrentPage] = useState(1);
    const [listingState, setListingState] = useState(INITIAL_LISTING_STATE);
    const [listingLoading, setListingLoading] = useState(true);

    const rolesById = useMemo(
        () => new Map(roles.map((rol) => [String(rol.id), rol.titulo])),
        [roles],
    );

    useEffect(() => {
        saveFilterState({ searchTerm, sortBy, sortOrder });
    }, [searchTerm, sortBy, sortOrder]);

    const loadPartesListing = useCallback(async ({ invalidate = false, page = currentPage } = {}) => {
        const requestId = ++requestIdRef.current;
        setListingLoading(true);

        try {
            if (invalidate) {
                await invalidatePartesListingCache();
            }

            const response = await getPartesListingPage({
                page,
                filters: {
                    searchTerm,
                    sortBy,
                    sortOrder,
                },
            });

            if (requestIdRef.current !== requestId) return;

            const normalized = normalizePartesListingResponse(response);
            setListingState(normalized);
            if (normalized.page !== page) {
                setCurrentPage(normalized.page);
            }
        } catch (error) {
            if (requestIdRef.current !== requestId) return;
            void logger.error('No se pudo cargar el listado de partes', {
                error: error?.message || String(error),
                page,
                searchTerm,
                sortBy,
                sortOrder,
            });
            showAppToast({
                title: 'Error',
                description: 'No se pudo cargar el listado de partes.',
                variant: 'danger',
            });
        } finally {
            if (requestIdRef.current === requestId) {
                setListingLoading(false);
            }
        }
    }, [currentPage, searchTerm, sortBy, sortOrder]);

    useEffect(() => {
        void loadPartesListing({ page: currentPage });
    }, [currentPage, loadPartesListing]);

    const handleOpenNewParteModal = () => {
        openModal(NewParteModal, {
            onParteCreated: async () => {
                setCurrentPage(1);
                await loadPartesListing({ invalidate: true, page: 1 });
            },
        }, { overlayClass: 'bg-black/10 backdrop-blur-[2px]' });
    };

    const getRolName = useCallback((rolId) => rolesById.get(String(rolId)) || 'N/A', [rolesById]);

    const handleOpenParteDetail = useCallback((parte) => {
        openModal(ParteDetailModal, {
            parte,
            roleTitle: getRolName(parte.rol_id),
        }, { overlayClass: 'bg-black/20 backdrop-blur-[2px]' });
    }, [getRolName, openModal]);

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
                        showAppToast({
                            title: 'Éxito',
                            description: 'Parte eliminada correctamente.',
                            variant: 'success',
                        });
                        await loadPartesListing({ invalidate: true, page: currentPage });
                    } else {
                        showAppToast({
                            title: 'Error',
                            description: result.error || 'Error al eliminar la parte.',
                            variant: 'danger',
                        });
                    }
                } catch (err) {
                    void logger.error('Error deleting parte', err);
                    showAppToast({
                        title: 'Error',
                        description: 'Ocurrió un error al contactar al servidor.',
                        variant: 'danger',
                    });
                } finally {
                    setDialogLoading(false);
                    closeDialog();
                }
            },
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
                label: 'Nueva Parte',
                onClick: handleOpenNewParteModal,
            }}
            topContent={listingLoading ? (
                <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card) px-4 py-3 text-sm text-(--text-secondary)">
                    Cargando partes...
                </div>
            ) : null}
            filterBar={
                <PartesFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={(val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    }}
                    sortBy={sortBy}
                    onSortByChange={(value) => {
                        setSortBy(value);
                        setCurrentPage(1);
                    }}
                    sortOrder={sortOrder}
                    onSortOrderChange={(value) => {
                        setSortOrder(value);
                        setCurrentPage(1);
                    }}
                    resultCount={hasActiveSearch ? listingState.total : undefined}
                />
            }
            tableProps={{
                isEmpty: listingLoading ? false : listingState.items.length === 0,
                emptyMessage: hasActiveSearch ? 'No se encontraron resultados para tu búsqueda.' : 'No se encontraron partes.',
                columns: [
                    { header: 'Nombre' },
                    { header: 'Rol' },
                    { header: 'Estado' },
                    { header: 'Contacto' },
                    { header: 'Acciones', align: 'right' },
                ],
            }}
            items={listingState.items}
            renderRow={(parte) => {
                const fullName = `${parte.nombre || ''} ${parte.apellido || ''}`.trim();
                return (
                    <tr
                        key={parte.id}
                        onClick={() => handleOpenParteDetail(parte)}
                        className="hover:bg-(--bg-card-hover) transition-colors group cursor-pointer"
                    >
                        <td className="px-6 py-4">
                            <div className="font-medium text-(--text-primary)">{fullName || 'Sin nombre'}</div>
                        </td>
                        <td className="px-6 py-4 text-(--text-secondary)">{getRolName(parte.rol_id)}</td>
                        <td className="px-6 py-4">
                            {parte.estado === 'activo' || parte.estado === 'Activo' ? (
                                <Badge variant="success">Activo</Badge>
                            ) : parte.estado === 'inactivo' || parte.estado === 'Inactivo' ? (
                                <Badge variant="default">Inactivo</Badge>
                            ) : parte.estado ? (
                                <Badge variant="default">{parte.estado}</Badge>
                            ) : (
                                <span className="text-sm text-(--text-tertiary)">—</span>
                            )}
                        </td>
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
                currentPage,
                onPageChange: setCurrentPage,
                totalItems: listingState.total,
                itemsPerPage: listingState.perPage,
            }}
            trigger={`${searchTerm}-${sortBy}-${sortOrder}-${currentPage}-${listingState.source}`}
        >
            <ConfirmDialog {...dialogProps} />
        </PeopleSectionLayout>
    );
};

export default PartesTab;
