import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { DateRangePicker } from '../ui/DateRangePicker';
import { useHonorarios } from '../../hooks/useHonorarios.js';
import { useModal } from '../../context/ModalContext';
import { EntregasModal } from './EntregasModal';
import { NewHonorarioModal } from './NewHonorarioModal';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext.jsx';
import { Pagination } from '../ui/Pagination';
import {
    getHonorariosListingPage,
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

export const HonorariosList = ({ caseId, caseCacheReady = true }) => {
    const { openModal } = useModal();
    const { user: currentUser } = useAuth();
    const { users = [] } = useUsers();
    const isAdmin = currentUser?.role === 'admin';

    const {
        honorarios: cachedHonorarios,
        loading: cachedHonorariosLoading,
        reload: reloadHonorarios,
    } = useHonorarios(caseId, {
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
    const [statusFilter, setStatusFilter] = useState('all');
    const [selectedUserId, setSelectedUserId] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');
    const [currentPage, setCurrentPage] = useState(1);

    const fromDate = formatDateForApi(dateRange.from);
    const toDate = formatDateForApi(dateRange.to);

    const getClientDisplay = useCallback((honorario) => {
        const resolvedClient = honorario.client || honorario.client_name;
        if (resolvedClient) {
            if (typeof resolvedClient === 'string') return resolvedClient;
            return `${resolvedClient.first_name || ''} ${resolvedClient.last_name || ''}`.trim() || `Cliente #${honorario.client_id}`;
        }
        return honorario.client_id ? `Cliente #${honorario.client_id}` : 'N/A';
    }, []);

    const getCaseDisplay = useCallback((honorario) => {
        const caseItem = honorario.suit_case || honorario.case;
        if (caseItem?.title) return caseItem.title;
        if (honorario.case_title) return honorario.case_title;
        if (honorario.suit_case_title) return honorario.suit_case_title;
        return honorario.suit_case_id ? `Caso #${honorario.suit_case_id}` : 'N/A';
    }, []);

    const activeHonorarios = useMemo(() => {
        if (!caseId) return listingState.items;

        let filtered = [...cachedHonorarios];

        // 1. Filtro por usuario (solo admin)
        if (isAdmin && selectedUserId !== 'all') {
            filtered = filtered.filter(h => String(h.user_id) === String(selectedUserId));
        }

        // 2. Búsqueda (caso o cliente)
        if (searchTerm.trim()) {
            const lowSearch = searchTerm.toLowerCase();
            filtered = filtered.filter(h => {
                const caseTitle = (h.suit_case?.title || '').toLowerCase();
                const clientName = getClientDisplay(h).toLowerCase();
                return caseTitle.includes(lowSearch) || clientName.includes(lowSearch);
            });
        }

        // 3. Filtro de estado (pagado/no pagado)
        if (statusFilter !== 'all') {
            const isPaid = statusFilter === 'paid';
            filtered = filtered.filter(h => Boolean(h.pagado) === isPaid);
        }

        // 4. Ordenamiento
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
    }, [caseId, cachedHonorarios, isAdmin, selectedUserId, searchTerm, statusFilter, sortBy, sortOrder, getClientDisplay, listingState.items]);

    const activeLoading = caseId ? cachedHonorariosLoading : listingLoading;

    const fetchRangeHonorarios = useCallback(async ({ invalidate = false, page = currentPage } = {}) => {
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

            const response = await getHonorariosListingPage({
                page,
                filters: {
                    from: fromDate,
                    to: toDate,
                    userId: isAdmin && selectedUserId !== 'all' ? Number(selectedUserId) : null,
                    searchTerm,
                    status: statusFilter,
                    sortBy,
                    sortDirection: sortOrder,
                },
            });

            setListingState(response);
            if (response.page && response.page !== page) {
                setCurrentPage(response.page);
            }
        } catch (error) {
            console.error('Error fetching honorarios range', error);
            setListingState((prev) => ({ ...prev, items: [], total: 0, totalPages: 1 }));
        } finally {
            setListingLoading(false);
        }
    }, [caseId, currentPage, fromDate, isAdmin, searchTerm, selectedUserId, sortBy, sortOrder, statusFilter, toDate]);

    useEffect(() => {
        if (caseId) return;
        void fetchRangeHonorarios({ page: currentPage });
    }, [caseId, currentPage, fetchRangeHonorarios]);

    const handleOpenEntregas = (honorario) => {
        openModal(EntregasModal, { honorarioId: honorario.id, honorario });
    };

    const handleCreateHonorario = () => {
        openModal(NewHonorarioModal, {
            onSuccess: caseId ? reloadHonorarios : () => fetchRangeHonorarios({ invalidate: true, page: currentPage }),
            caseId,
        });
    };

    function getUserName(userId) {
        if (!userId) return 'S/U';
        const u = users.find(u => String(u.id) === String(userId));
        return u ? (u.name || u.tag) : `ID: ${userId}`;
    }

    return (
        <div className={caseId ? "space-y-4 pt-2" : "space-y-4"}>
            <div className="flex justify-between items-center">
                <h2 className={caseId ? "text-lg font-semibold" : "text-2xl font-semibold"}>
                    Honorarios
                </h2>
                <Button onClick={handleCreateHonorario}>Nuevo Honorario</Button>
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
                    statusFilter={statusFilter}
                    onStatusChange={(value) => {
                        setStatusFilter(value);
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
                    isAdmin={isAdmin}
                    users={users}
                    selectedUserId={selectedUserId}
                    onUserChange={(value) => {
                        setSelectedUserId(value);
                        setCurrentPage(1);
                    }}
                    searchPlaceholder="Buscar por caso o cliente..."
                />
            )}

            {!caseId && searchTerm.trim() && (
                <div className="text-sm text-gray-500 font-medium animate-in fade-in slide-in-from-top-1 duration-300 px-1">
                    Mostrando {listingState.total} resultado{listingState.total !== 1 ? 's' : ''}
                </div>
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
                isEmpty={!activeLoading && activeHonorarios.length === 0}
                emptyMessage={caseId ? "No se encontraron honorarios para este caso." : "No se encontraron honorarios con los filtros seleccionados."}
                trigger={`${searchTerm}-${statusFilter}-${selectedUserId}-${sortBy}-${sortOrder}-${fromDate}-${toDate}-${currentPage}-${listingState.source}`}
                columns={[
                    ...(!caseId ? [{ header: 'Caso' }] : []),
                    { header: 'Cliente' },
                    { header: 'Monto' },
                    { header: 'Pagado' },
                    { header: 'Fecha' },
                    ...(isAdmin ? [{ header: 'Registrado por' }] : []),
                ]}
            >
                {activeHonorarios.map(h => (
                    <tr key={h.id} className="hover:bg-(--bg-card-hover) transition-colors cursor-pointer" onClick={() => handleOpenEntregas(h)}>
                        {!caseId && <td className="p-4">{getCaseDisplay(h)}</td>}
                        <td className="p-4">{getClientDisplay(h)}</td>
                        <td className="p-4">${h.monto}</td>
                        <td className="p-4">{h.pagado ? 'Sí' : 'No'}</td>
                        <td className="p-4">{formatDisplayDate(h.created_at)}</td>
                        {isAdmin && <td className="p-4">{getUserName(h.user_id)}</td>}
                    </tr>
                ))}
            </Table>
        </div>
    );
};

HonorariosList.propTypes = {
    caseId: PropTypes.oneOfType([PropTypes.string, PropTypes.number]),
    caseCacheReady: PropTypes.bool,
};
