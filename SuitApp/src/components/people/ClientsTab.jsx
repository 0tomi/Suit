import { useState, useMemo, useEffect, useCallback, useDeferredValue, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeyAction } from '../../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../../hotkeys/hotkeys';
import { Plus, Trash2 } from 'lucide-react';
import { deleteClient } from '../../services/clientService.js';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';
import { Button } from '../ui/Button';
import { NewClientModal } from '../clients/NewClientModal';
import { GenericFilterBar } from '../ui/GenericFilterBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select.jsx';
import PeopleSectionLayout from './PeopleSectionLayout';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { Badge } from '../ui/Badge.jsx';
import { createLogger } from '../../services/logService.js';
import { getClientsListingPage, invalidateClientsListingCache } from '../../services/clientsListingBackendService.js';

const FILTER_STORAGE_KEY = 'clients-filter-state';
const logger = createLogger('clients-page');
const DEFAULT_FILTERS = {
    searchTerm: '',
    typeFilter: 'all',
    statusFilter: 'all',
    financialStatusFilter: 'all',
    sortBy: 'created_at',
    sortOrder: 'desc',
};

const CLIENT_TYPE_OPTIONS = [
    { value: 'all', label: 'Todos los tipos' },
    { value: 'person', label: 'Persona física' },
    { value: 'company', label: 'Empresa' },
];

const CLIENT_STATUS_OPTIONS = [
    { value: 'all', label: 'Todos los estados' },
    { value: 'activo', label: 'Activo' },
    { value: 'inactivo', label: 'Inactivo' },
];

const CLIENT_FINANCIAL_STATUS_OPTIONS = [
    { value: 'all', label: 'Todos los estados financieros' },
    { value: 'no deudor', label: 'No deudor' },
    { value: 'deudor', label: 'Deudor' },
    { value: 'moroso', label: 'Moroso' },
];

function loadFilterState() {
    try {
        const raw = localStorage.getItem(FILTER_STORAGE_KEY);
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (error) {
        void logger.warn('No se pudieron restaurar los filtros de clientes', error);
        return null;
    }
}

function saveFilterState(state) {
    try {
        localStorage.setItem(FILTER_STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
        void logger.warn('No se pudieron persistir los filtros de clientes', error);
    }
}

function normalizeClientsListingResponse(response) {
    const payload = response && typeof response === 'object' ? response : {};
    const items = Array.isArray(payload.items) ? payload.items : [];

    return {
        items,
        page: Number(payload.page ?? 1) || 1,
        total: Number(payload.total ?? items.length) || 0,
        totalPages: Math.max(1, Number(payload.totalPages ?? 1) || 1),
        perPage: Math.max(1, Number(payload.perPage ?? 30) || 30),
        source: payload.source || 'cache',
        appliedLocalFilters: Boolean(payload.appliedLocalFilters),
    };
}


const ClientsTab = () => {
    const navigate = useNavigate();
    const listingRequestIdRef = useRef(0);

    const savedFilters = loadFilterState() || {};
    const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm ?? DEFAULT_FILTERS.searchTerm);
    const [typeFilter, setTypeFilter] = useState(savedFilters.typeFilter ?? DEFAULT_FILTERS.typeFilter);
    const [statusFilter, setStatusFilter] = useState(savedFilters.statusFilter ?? DEFAULT_FILTERS.statusFilter);
    const [financialStatusFilter, setFinancialStatusFilter] = useState(savedFilters.financialStatusFilter ?? DEFAULT_FILTERS.financialStatusFilter);
    const [sortBy, setSortBy] = useState(savedFilters.sortBy ?? DEFAULT_FILTERS.sortBy);
    const [sortOrder, setSortOrder] = useState(savedFilters.sortOrder ?? DEFAULT_FILTERS.sortOrder);

    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const [listingState, setListingState] = useState({
        items: [],
        page: 1,
        total: 0,
        totalPages: 1,
        perPage: 30,
        source: 'cache',
        appliedLocalFilters: false,
    });
    const [listingLoading, setListingLoading] = useState(true);
    const deferredSearchTerm = useDeferredValue(searchTerm);

    useEffect(() => {
        saveFilterState({ searchTerm, typeFilter, statusFilter, financialStatusFilter, sortBy, sortOrder });
    }, [searchTerm, typeFilter, statusFilter, financialStatusFilter, sortBy, sortOrder]);

    const location = useLocation();
    useEffect(() => {
        if (location.state?.openNewClientModal) {
            setIsNewClientModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    useHotkeyAction(HOTKEY_ACTIONS.NEW_CLIENT, () => setIsNewClientModalOpen(true));
    const refreshClientsListing = useCallback(async ({ invalidate = false, page = currentPage } = {}) => {
        const requestId = ++listingRequestIdRef.current;
        setListingLoading(true);

        try {
            if (invalidate) {
                await invalidateClientsListingCache();
            }

            const response = await getClientsListingPage({
                page,
                filters: {
                    search: deferredSearchTerm.trim(),
                    type: typeFilter === 'all' ? '' : typeFilter,
                    status: statusFilter === 'all' ? '' : statusFilter,
                    financialStatus: financialStatusFilter === 'all' ? '' : financialStatusFilter,
                    sortBy,
                    sortDirection: sortOrder,
                },
            });

            if (listingRequestIdRef.current !== requestId) return;

            const normalized = normalizeClientsListingResponse(response);
            setListingState(normalized);
            if (normalized.page !== page) {
                setCurrentPage(normalized.page);
            }
        } catch (error) {
            if (listingRequestIdRef.current !== requestId) return;
            void logger.error('No se pudo cargar el listado de clientes', {
                error: error?.message || String(error),
                page,
                searchTerm: deferredSearchTerm,
                typeFilter,
                statusFilter,
                financialStatusFilter,
                sortBy,
                sortOrder,
            });
            showAppToast({
                title: 'Error',
                description: 'No se pudo cargar el listado de clientes.',
                variant: 'danger',
            });
        } finally {
            if (listingRequestIdRef.current === requestId) {
                setListingLoading(false);
            }
        }
    }, [currentPage, deferredSearchTerm, financialStatusFilter, sortBy, sortOrder, statusFilter, typeFilter]);

    useEffect(() => {
        void refreshClientsListing({ page: currentPage });
    }, [currentPage, refreshClientsListing]);

    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => {
        void refreshClientsListing({ invalidate: true, page: currentPage });
    });

    const visibleClients = useMemo(() => listingState.items, [listingState.items]);

    const handleDelete = (id, e) => {
        e.stopPropagation();
        openDialog({
            title: '¿Eliminar cliente?',
            desc: 'Esta acción no se puede deshacer y borrará todos los datos asociados.',
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await deleteClient(id);
                    if (result.ok) {
                        showAppToast({
                            title: 'Éxito',
                            description: 'Cliente eliminado correctamente.',
                            variant: 'success',
                        });
                        await refreshClientsListing({ invalidate: true, page: currentPage });
                    } else {
                        showAppToast({
                            title: 'Error',
                            description: result.error || 'Error al eliminar cliente',
                            variant: 'danger',
                        });
                    }
                } catch (err) {
                    void logger.error('Error deleting client', err);
                    showAppToast({
                        title: 'Error',
                        description: 'Ocurrió un error al contactar al servidor',
                        variant: 'danger',
                    });
                } finally {
                    setDialogLoading(false);
                    closeDialog();
                }
            }
        });
    };

    return (
        <PeopleSectionLayout
            title="Clientes"
            titleTestId="page-clients-title"
            description="Gestiona tu cartera de clientes"
            primaryAction={{
                icon: Plus,
                label: "Nuevo Cliente",
                onClick: () => setIsNewClientModalOpen(true)
            }}
            topContent={
                listingLoading && (
                    <div className="inline-flex items-center rounded-full border border-blue-500/30 bg-blue-500/10 px-3 py-1 text-xs font-medium text-blue-700">
                        Cargando clientes
                    </div>
                )
            }
            filterBar={
                <GenericFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={(eventValue) => {
                        setSearchTerm(eventValue);
                        setCurrentPage(1);
                    }}
                    placeholder="Buscar por nombre, DNI o email..."
                    sortBy={sortBy}
                    onSortByChange={(value) => {
                        setSortBy(value);
                        setCurrentPage(1);
                    }}
                    sortOptions={[
                        { value: 'created_at', label: 'Fecha de creación' },
                        { value: 'alpha', label: 'Orden alfabético' },
                    ]}
                    sortOrder={sortOrder}
                    onSortOrderChange={(value) => {
                        setSortOrder(value);
                        setCurrentPage(1);
                    }}
                    resultCount={deferredSearchTerm.trim().length > 0 ? listingState.total : undefined}
                    resultItemName={{ singular: 'cliente', plural: 'clientes' }}
                >
                    <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Tipo</span>
                        <Select
                            value={typeFilter}
                            onValueChange={(value) => {
                                setTypeFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[140px] p-0 px-2">
                                <SelectValue placeholder="Todos los tipos" />
                            </SelectTrigger>
                            <SelectContent>
                                {CLIENT_TYPE_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Estado</span>
                        <Select
                            value={statusFilter}
                            onValueChange={(value) => {
                                setStatusFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[130px] p-0 px-2">
                                <SelectValue placeholder="Todos los estados" />
                            </SelectTrigger>
                            <SelectContent>
                                {CLIENT_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Estado financiero</span>
                        <Select
                            value={financialStatusFilter}
                            onValueChange={(value) => {
                                setFinancialStatusFilter(value);
                                setCurrentPage(1);
                            }}
                        >
                            <SelectTrigger className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[180px] p-0 px-2">
                                <SelectValue placeholder="Todos los estados financieros" />
                            </SelectTrigger>
                            <SelectContent>
                                {CLIENT_FINANCIAL_STATUS_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </GenericFilterBar>
            }
            tableProps={{
                isEmpty: !listingLoading && visibleClients.length === 0,
                emptyMessage: "No se encontraron clientes.",
                columns: [
                    { header: 'Nombre' },
                    { header: 'DNI / CUIT' },
                    { header: 'Actividad' },
                    { header: 'Estado Financiero' },
                    { header: 'Contacto' },
                    { header: 'Acciones', align: 'right' }
                ]
            }}
            items={visibleClients}
            renderRow={(client) => {
                const fullName = `${client.first_name || ''} ${client.last_name || ''}`.trim();
                return (
                    <tr
                        key={client.id}
                        onClick={() => navigate(`/people/${client.id}`)}
                        className="hover:bg-(--bg-card-hover) transition-colors cursor-pointer group"
                    >
                        <td className="px-6 py-4">
                            <div className="flex items-center space-x-3">
                                <div className="h-10 w-10 rounded-full bg-indigo-500/10 flex items-center justify-center text-indigo-500 font-bold">
                                    {(client.first_name || '?').charAt(0)}
                                </div>
                                <span className="font-medium text-(--text-primary)">{fullName || 'Sin nombre'}</span>
                            </div>
                        </td>
                        <td className="px-6 py-4 text-(--text-secondary) font-mono text-sm">{client.identification_number || '—'}</td>
                        <td className="px-6 py-4">
                            {client.status === 'activo' ? (
                                <Badge variant="success">Activo</Badge>
                            ) : client.status === 'inactivo' ? (
                                <Badge variant="default">Inactivo</Badge>
                            ) : (
                                <Badge variant="default">{client.status || '—'}</Badge>
                            )}
                        </td>
                        <td className="px-6 py-4">
                            {client.financial_status === 'no deudor' ? (
                                <Badge variant="success">No deudor</Badge>
                            ) : client.financial_status === 'deudor' ? (
                                <Badge variant="warning">Deudor</Badge>
                            ) : client.financial_status === 'moroso' ? (
                                <Badge variant="danger">Moroso</Badge>
                            ) : (
                                <span className="text-sm text-(--text-tertiary)">—</span>
                            )}
                        </td>
                        <td className="px-6 py-4">
                            <div className="flex flex-col space-y-1">
                                {client.email && (
                                    <div className="flex items-center text-sm text-(--text-secondary)">
                                        <span className="mr-2 text-(--text-tertiary) text-xs">✉</span>
                                        {client.email}
                                    </div>
                                )}
                                {client.phone && (
                                    <div className="flex items-center text-sm text-(--text-secondary)">
                                        <span className="mr-2 text-(--text-tertiary) text-xs">☎</span>
                                        {client.phone}
                                    </div>
                                )}
                                {!client.email && !client.phone && (
                                    <span className="text-sm text-(--text-tertiary)">Sin datos</span>
                                )}
                            </div>
                        </td>
                        <td className="px-6 py-4 text-right">
                            <Button
                                variant="ghost"
                                size="icon"
                                icon={Trash2}
                                onClick={(e) => handleDelete(client.id, e)}
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
            trigger={`${searchTerm}-${typeFilter}-${statusFilter}-${financialStatusFilter}-${sortBy}-${sortOrder}-${currentPage}-${listingState.source}`}
        >
            <ConfirmDialog {...dialogProps} />
            <NewClientModal
                open={isNewClientModalOpen}
                onClose={() => setIsNewClientModalOpen(false)}
                onSuccess={() => {
                    void refreshClientsListing({ invalidate: true, page: currentPage });
                }}
            />
        </PeopleSectionLayout>
    );
};

export default ClientsTab;
