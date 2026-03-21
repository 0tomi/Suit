import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { getHonorariosByCaso } from '../../services/honorarioService';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { DateRangePicker } from '../ui/DateRangePicker';
import { useHonorarios } from '../../hooks/useHonorarios.js';
import { useClients } from '../../context/ClientsContext.jsx';
import { useCases } from '../../context/CasesContext.jsx';
import { useModal } from '../../context/ModalContext';
import { EntregasModal } from './EntregasModal';
import { NewHonorarioModal } from './NewHonorarioModal';
import { useAuth } from '../../context/AuthContext';
import { useUsers } from '../../context/UsersContext.jsx';
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

function normalizeCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

function isDateWithinRange(dateStr, fromDate, toDate) {
    if (!dateStr || !fromDate || !toDate) return false;

    try {
        const normalizedDate = format(parseISO(String(dateStr).replace(' ', 'T')), 'yyyy-MM-dd');
        return normalizedDate >= fromDate && normalizedDate <= toDate;
    } catch {
        return false;
    }
}

import { EconomiaFilterBar } from './EconomiaFilterBar';

export const HonorariosList = ({ caseId, caseCacheReady = true }) => {
    const { openModal } = useModal();
    const { cases = [] } = useCases();
    const { clients = [] } = useClients();
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
    const [rangeHonorarios, setRangeHonorarios] = useState([]);
    const [rangeLoading, setRangeLoading] = useState(true);
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

    const fromDate = formatDateForApi(dateRange.from);
    const toDate = formatDateForApi(dateRange.to);
    const rawActiveHonorarios = caseId ? cachedHonorarios : rangeHonorarios;

    const clientsMap = useMemo(() => new Map(
        clients.map((client) => [String(client.id), client])
    ), [clients]);

    function getClientDisplay(honorario) {
        const resolvedClient = honorario.client || clientsMap.get(String(honorario.client_id));
        if (resolvedClient) {
            return `${resolvedClient.first_name || ''} ${resolvedClient.last_name || ''}`.trim() || `Cliente #${honorario.client_id}`;
        }
        return honorario.client_id ? `Cliente #${honorario.client_id}` : 'N/A';
    }

    const activeHonorarios = useMemo(() => {
        let filtered = [...rawActiveHonorarios];

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
    }, [isAdmin, selectedUserId, rawActiveHonorarios, searchTerm, statusFilter, sortBy, sortOrder, clientsMap]);

    const activeLoading = caseId ? cachedHonorariosLoading : rangeLoading;

    /**
     * La vista global agrega honorarios caso por caso porque la API por rango es
     * exclusiva de admin.
     */
    const fetchRangeHonorarios = useCallback(async () => {
        if (caseId) return;

        if (!fromDate || !toDate) {
            setRangeHonorarios([]);
            setRangeLoading(false);
            return;
        }

        setRangeLoading(true);
        try {
            const honorariosByCase = await Promise.all(
                cases.map(async (caseItem) => {
                    const data = normalizeCollection(await getHonorariosByCaso(caseItem.id));

                    return data
                        .filter((honorario) => isDateWithinRange(honorario.created_at, fromDate, toDate))
                        .map((honorario) => ({
                            ...honorario,
                            suit_case: honorario.suit_case || caseItem,
                            suit_case_id: honorario.suit_case_id || caseItem.id,
                        }));
                })
            );

            setRangeHonorarios(honorariosByCase.flat());
        } catch (error) {
            console.error("Error fetching honorarios", error);
            setRangeHonorarios([]);
        } finally {
            setRangeLoading(false);
        }
    }, [caseId, cases, fromDate, toDate]);

    useEffect(() => {
        if (caseId) return;
        void fetchRangeHonorarios();
    }, [caseId, fetchRangeHonorarios]);

    const handleOpenEntregas = (honorario) => {
        openModal(EntregasModal, { honorarioId: honorario.id, honorario });
    };

    const handleCreateHonorario = () => {
        openModal(NewHonorarioModal, {
            onSuccess: caseId ? reloadHonorarios : fetchRangeHonorarios,
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
                    onSearchChange={setSearchTerm}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    statusFilter={statusFilter}
                    onStatusChange={setStatusFilter}
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    isAdmin={isAdmin}
                    users={users}
                    selectedUserId={selectedUserId}
                    onUserChange={setSelectedUserId}
                    searchPlaceholder="Buscar por caso o cliente..."
                />
            )}

            <Table
                isEmpty={!activeLoading && activeHonorarios.length === 0}
                emptyMessage={caseId ? "No se encontraron honorarios para este caso." : "No se encontraron honorarios con los filtros seleccionados."}
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
                    <tr key={h.id} className="hover:bg-gray-50 cursor-pointer" onClick={() => handleOpenEntregas(h)}>
                        {!caseId && <td className="p-4">{h.suit_case?.title || `Caso #${h.suit_case_id}` || 'N/A'}</td>}
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
