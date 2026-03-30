import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { DateRangePicker } from '../ui/DateRangePicker';
import { useGastosCaso } from '../../hooks/useGastosCaso.js';
import { useModal } from '../../context/ModalContext';
import { NewGastoModal } from './NewGastoModal';
import { useAuth } from '../../context/AuthContext';
import { useGastoCatalogo } from '../../context/GastoCatalogoContext.jsx';
import { useUsers } from '../../context/UsersContext.jsx';
import { Pagination } from '../ui/Pagination';
import {
    getGastosListingPage,
    invalidateEconomiaListingCache,
} from '../../services/economiaListingBackendService.js';
import PropTypes from 'prop-types';

/** Formatea un Date a YYYY-MM-DD para la API. */
function formatDateForApi(date) {
    return date instanceof Date ? format(date, 'yyyy-MM-dd') : '';
}

/** Formatea un string de fecha de la API para mostrar al usuario (DD/MM/YYYY). */
function formatDisplayDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return format(parseISO(String(dateStr).replace(' ', 'T')), 'dd/MM/yyyy');
    } catch {
        return dateStr;
    }
}

import { EconomiaFilterBar } from './EconomiaFilterBar';

export const GastosList = ({ caseId, caseCacheReady = true }) => {
    const { openModal } = useModal();
    const { user: currentUser } = useAuth();
    const { gastos_catalogo: gastosCatalogo = [] } = useGastoCatalogo();
    const { users = [] } = useUsers();
    const isAdmin = currentUser?.role === 'admin';

    const {
        gastos: cachedGastos,
        loading: cachedGastosLoading,
        reload: reloadGastos,
    } = useGastosCaso(caseId, {
        enabled: !caseId || caseCacheReady,
        skipInitialFetch: Boolean(caseId && caseCacheReady),
    });
    const [listingState, setListingState] = useState({
        items: [],
        page: 1,
        total: 0,
        totalPages: 1,
        perPage: 30,
        source: 'cache',
    });
    const [listingLoading, setListingLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    
    // Filtros y Ordenamiento
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);

    const fromDate = formatDateForApi(dateRange.from);
    const toDate = formatDateForApi(dateRange.to);

    const gastosCatalogoMap = useMemo(() => new Map(
        gastosCatalogo.map((gastoCatalogo) => [String(gastoCatalogo.id), gastoCatalogo])
    ), [gastosCatalogo]);

    const getGastoDisplay = useCallback((gastoCaso) => {
        const resolvedGasto = gastoCaso.gasto || gastosCatalogoMap.get(String(gastoCaso.gasto_id));
        return resolvedGasto?.titulo || resolvedGasto?.name || (gastoCaso.gasto_id ? `Tipo #${gastoCaso.gasto_id}` : 'N/A');
    }, [gastosCatalogoMap]);

    const activeGastos = useMemo(() => {
        if (!caseId) return listingState.items;

        let filtered = [...cachedGastos];

        // 1. Filtro por usuario (solo admin)
        if (isAdmin && selectedUserId !== 'all') {
            filtered = filtered.filter(g => String(g.user_id) === String(selectedUserId));
        }

        // 2. Búsqueda (caso o tipo de gasto)
        if (searchTerm.trim()) {
            const lowSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(g => {
                const caseTitle = (g.suit_case?.title || '').toLowerCase();
                const gastoTitle = getGastoDisplay(g).toLowerCase();
                return caseTitle.includes(lowSearch) || gastoTitle.includes(lowSearch);
            });
        }

        // 3. Ordenamiento
        filtered.sort((a, b) => {
            let valA, valB;
            if (sortBy === 'created_at') {
                valA = a.created_at || '';
                valB = b.created_at || '';
                return sortOrder === 'desc' ? valB.localeCompare(valA) : valA.localeCompare(valB);
            } else if (sortBy === 'monto') {
                valA = Number(a.monto) || 0;
                valB = Number(b.monto) || 0;
                return sortOrder === 'desc' ? valB - valA : valA - valB;
            }
            return 0;
        });

        return filtered;
    }, [caseId, cachedGastos, getGastoDisplay, isAdmin, listingState.items, selectedUserId, searchTerm, sortBy, sortOrder]);

    const activeLoading = caseId ? cachedGastosLoading : listingLoading;

    const fetchRangeGastos = useCallback(async ({ invalidate = false, page = currentPage } = {}) => {
        if (caseId) return;

        if (!fromDate || !toDate) {
            setListingState((prev) => ({ ...prev, items: [], total: 0, totalPages: 1, perPage: 30 }));
            setListingLoading(false);
            return;
        }

        setListingLoading(true);
        try {
            if (invalidate) {
                await invalidateEconomiaListingCache();
            }

            const response = await getGastosListingPage({
                page,
                filters: {
                    from: fromDate,
                    to: toDate,
                    userId: isAdmin && selectedUserId !== 'all' ? Number(selectedUserId) : null,
                    searchTerm,
                    sortBy,
                    sortDirection: sortOrder,
                },
            });

            setListingState(response);
            if (response.page && response.page !== page) {
                setCurrentPage(response.page);
            }
        } catch (error) {
            console.error("Error fetching gastos", error);
            setListingState((prev) => ({ ...prev, items: [], total: 0, totalPages: 1 }));
        } finally {
            setListingLoading(false);
        }
    }, [caseId, currentPage, fromDate, isAdmin, searchTerm, selectedUserId, sortBy, sortOrder, toDate]);

    useEffect(() => {
        if (caseId) return;
        void fetchRangeGastos({ page: currentPage });
    }, [caseId, currentPage, fetchRangeGastos]);

    function getUserName(userId) {
        if (!userId) return 'S/U';
        const u = users.find(u => String(u.id) === String(userId));
        return u ? (u.name || u.tag) : `ID: ${userId}`;
    }

    const handleCreateGasto = () => {
        openModal(NewGastoModal, {
            onSuccess: caseId ? reloadGastos : () => fetchRangeGastos({ invalidate: true, page: currentPage }),
            caseId,
        });
    };

    return (
        <div className={caseId ? "space-y-4 pt-2" : "space-y-4"}>
            <div className="flex justify-between items-center">
                <h2 className={caseId ? "text-lg font-semibold" : "text-2xl font-semibold"}>
                    Gastos
                </h2>
                <Button onClick={handleCreateGasto}>Nuevo Gasto</Button>
            </div>

            {!caseId && (
                <EconomiaFilterBar
                    searchTerm={searchTerm}
                    onSearchChange={(value) => {
                        setSearchTerm(value);
                        setCurrentPage(1);
                    }}
                    dateRange={dateRange}
                    onDateRangeChange={(value) => {
                        setDateRange(value);
                        setCurrentPage(1);
                    }}
                    showStatusFilter={false} // Gastos no tienen estado de pago en esta vista
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
                    isAdmin={isAdmin}
                    users={users}
                    selectedUserId={selectedUserId}
                    onUserChange={(value) => {
                        setSelectedUserId(value);
                        setCurrentPage(1);
                    }}
                    searchPlaceholder="Buscar por caso o tipo de gasto..."
                />
            )}

            {!caseId && (
                <Pagination
                    totalItems={listingState.total}
                    itemsPerPage={listingState.perPage}
                    currentPage={currentPage}
                    onPageChange={setCurrentPage}
                    className="rounded-xl border border-(--border-subtle) shadow-sm border-t-0"
                />
            )}

            <Table
                isEmpty={!activeLoading && activeGastos.length === 0}
                emptyMessage={caseId ? "No se encontraron gastos para este caso." : "No se encontraron gastos con los filtros seleccionados."}
                trigger={`${searchTerm}-${selectedUserId}-${sortBy}-${sortOrder}-${fromDate}-${toDate}-${currentPage}-${listingState.source}`}
                columns={[
                    ...(!caseId ? [{ header: 'Caso' }] : []),
                    { header: 'Tipo de Gasto' },
                    { header: 'Monto' },
                    { header: 'Fecha' },
                    ...(isAdmin ? [{ header: 'Registrado por' }] : []),
                ]}
            >
                {activeGastos.map(g => (
                    <tr key={g.id} className="hover:bg-(--bg-card-hover) transition-colors">
                        {!caseId && <td className="p-4">{g.suit_case?.title || g.case_title || `Caso #${g.suit_case_id}` || 'N/A'}</td>}
                        <td className="p-4">{getGastoDisplay(g)}</td>
                        <td className="p-4">${g.monto}</td>
                        <td className="p-4">{formatDisplayDate(g.created_at)}</td>
                        {isAdmin && <td className="p-4">{getUserName(g.user_id)}</td>}
                    </tr>
                ))}
            </Table>
        </div>
    );
};

GastosList.propTypes = {
    caseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    caseCacheReady: PropTypes.bool,
};
