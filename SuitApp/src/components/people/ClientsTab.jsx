import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useHotkeyAction } from '../../hotkeys/useHotkeysSystem';
import { HOTKEY_ACTIONS } from '../../hotkeys/hotkeys';
import { Plus, Trash2 } from 'lucide-react';
import { useClients } from '../../context/ClientsContext';
import { deleteClient } from '../../services/clientService.js';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { PrimaryActionButton } from '../ui/PrimaryActionButton';
import { NewClientModal } from '../clients/NewClientModal';
import ClientsFilterBar from '../clients/ClientsFilterBar';
import PeopleSectionLayout from './PeopleSectionLayout';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { createLogger } from '../../services/logService.js';

// ... (El resto de las funciones de persistencia, defaults y ordenamiento)
const FILTER_STORAGE_KEY = 'clients-filter-state';
const logger = createLogger('clients-page');

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

const DEFAULT_FILTERS = {
    searchTerm: '',
    sortBy: 'created_at',
    sortOrder: 'desc',
};

function sortClients(list, sortBy, sortOrder) {
    return [...list].sort((a, b) => {
        if (sortBy === 'alpha') {
            const aName = `${a.last_name || ''} ${a.first_name || ''}`.toLowerCase();
            const bName = `${b.last_name || ''} ${b.first_name || ''}`.toLowerCase();
            const cmp = aName.localeCompare(bName, 'es');
            return sortOrder === 'asc' ? cmp : -cmp;
        }
        // created_at
        const aVal = a.created_at ? new Date(a.created_at).getTime() : 0;
        const bVal = b.created_at ? new Date(b.created_at).getTime() : 0;
        return sortOrder === 'desc' ? bVal - aVal : aVal - bVal;
    });
}


const ClientsTab = () => {
    const navigate = useNavigate();
    const { clients, refreshClients: refreshAll } = useClients();

    const savedFilters = loadFilterState() || {};
    const [searchTerm, setSearchTerm] = useState(savedFilters.searchTerm ?? DEFAULT_FILTERS.searchTerm);
    const [sortBy, setSortBy] = useState(savedFilters.sortBy ?? DEFAULT_FILTERS.sortBy);
    const [sortOrder, setSortOrder] = useState(savedFilters.sortOrder ?? DEFAULT_FILTERS.sortOrder);

    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 10;

    useEffect(() => {
        saveFilterState({ searchTerm, sortBy, sortOrder });
    }, [searchTerm, sortBy, sortOrder]);

    useEffect(() => {
        void refreshAll();
    }, [refreshAll]);

    const location = useLocation();
    useEffect(() => {
        if (location.state?.openNewClientModal) {
            setIsNewClientModalOpen(true);
            navigate(location.pathname, { replace: true, state: {} });
        }
    }, [location.state, navigate, location.pathname]);

    useHotkeyAction(HOTKEY_ACTIONS.NEW_CLIENT, () => setIsNewClientModalOpen(true));
    useHotkeyAction(HOTKEY_ACTIONS.REFRESH_MODULE, () => refreshAll());

    const filteredClients = useMemo(() => {
        const search = searchTerm.toLowerCase();
        const filtered = clients.filter(c => {
            const fullName = `${c.first_name || ''} ${c.last_name || ''}`.toLowerCase();
            return fullName.includes(search) ||
                (c.identification_number || '').includes(searchTerm) ||
                (c.email || '').toLowerCase().includes(search);
        });
        return sortClients(filtered, sortBy, sortOrder);
    }, [clients, searchTerm, sortBy, sortOrder]);

    const paginatedClients = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredClients.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredClients, currentPage]);

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
                        refreshAll();
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
            filterBar={
                <ClientsFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={(val) => {
                        setSearchTerm(val);
                        setCurrentPage(1);
                    }}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    resultCount={searchTerm.length > 0 ? filteredClients.length : undefined}
                />
            }
            tableProps={{
                isEmpty: filteredClients.length === 0,
                emptyMessage: "No se encontraron clientes.",
                columns: [
                    { header: 'Nombre' },
                    { header: 'DNI / CUIT' },
                    { header: 'Contacto' },
                    { header: 'Acciones', align: 'right' }
                ]
            }}
            items={paginatedClients}
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
                totalItems: filteredClients.length,
                itemsPerPage,
                currentPage,
                onPageChange: setCurrentPage
            }}
        >
            <ConfirmDialog {...dialogProps} />
            <NewClientModal
                open={isNewClientModalOpen}
                onClose={() => setIsNewClientModalOpen(false)}
            />
        </PeopleSectionLayout>
    );
};

export default ClientsTab;
