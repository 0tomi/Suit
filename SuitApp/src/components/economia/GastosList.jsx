import { useState, useEffect, useCallback, useMemo } from 'react';
import { format, startOfMonth, endOfMonth, parseISO } from 'date-fns';
import { getGastosByDateRange } from '../../services/gastoSuitCaseService';
import { Table } from '../ui/Table';
import { Button } from '../ui/Button';
import { DateRangePicker } from '../ui/DateRangePicker';
import { useGastosCaso } from '../../hooks/useGastosCaso.js';
import { useModal } from '../../context/ModalContext';
import { NewGastoModal } from './NewGastoModal';
import { useAuth } from '../../context/AuthContext';
import { useGastoCatalogo } from '../../context/GastoCatalogoContext.jsx';
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
    const [rangeGastos, setRangeGastos] = useState([]);
    const [rangeLoading, setRangeLoading] = useState(true);
    const [dateRange, setDateRange] = useState({
        from: startOfMonth(new Date()),
        to: endOfMonth(new Date()),
    });
    
    // Filtros y Ordenamiento
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedUserId, setSelectedUserId] = useState('all');
    const [sortBy, setSortBy] = useState('created_at');
    const [sortOrder, setSortOrder] = useState('desc');

    const fromDate = formatDateForApi(dateRange.from);
    const toDate = formatDateForApi(dateRange.to);
    const rawActiveGastos = caseId ? cachedGastos : rangeGastos;

    const gastosCatalogoMap = useMemo(() => new Map(
        gastosCatalogo.map((gastoCatalogo) => [String(gastoCatalogo.id), gastoCatalogo])
    ), [gastosCatalogo]);

    const getGastoDisplay = useCallback((gastoCaso) => {
        const resolvedGasto = gastoCaso.gasto || gastosCatalogoMap.get(String(gastoCaso.gasto_id));
        return resolvedGasto?.titulo || resolvedGasto?.name || (gastoCaso.gasto_id ? `Tipo #${gastoCaso.gasto_id}` : 'N/A');
    }, [gastosCatalogoMap]);

    const activeGastos = useMemo(() => {
        let filtered = [...rawActiveGastos];

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
    }, [getGastoDisplay, isAdmin, selectedUserId, rawActiveGastos, searchTerm, sortBy, sortOrder]);

    const activeLoading = caseId ? cachedGastosLoading : rangeLoading;

    /**
     * La vista global sigue trabajando por rango; el detalle de caso usa el hook cache-first.
     */
    const fetchRangeGastos = useCallback(async () => {
        if (caseId) return;

        if (!fromDate || !toDate) {
            setRangeGastos([]);
            setRangeLoading(false);
            return;
        }

        setRangeLoading(true);
        try {
            const data = await getGastosByDateRange(fromDate, toDate);
            setRangeGastos(normalizeCollection(data));
        } catch (error) {
            console.error("Error fetching gastos", error);
        } finally {
            setRangeLoading(false);
        }
    }, [caseId, fromDate, toDate]);

    useEffect(() => {
        if (caseId) return;
        void fetchRangeGastos();
    }, [caseId, fetchRangeGastos]);

    function getUserName(userId) {
        if (!userId) return 'S/U';
        const u = users.find(u => String(u.id) === String(userId));
        return u ? (u.name || u.tag) : `ID: ${userId}`;
    }

    const handleCreateGasto = () => {
        openModal(NewGastoModal, {
            onSuccess: caseId ? reloadGastos : fetchRangeGastos,
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
                    onSearchChange={setSearchTerm}
                    dateRange={dateRange}
                    onDateRangeChange={setDateRange}
                    showStatusFilter={false} // Gastos no tienen estado de pago en esta vista
                    sortBy={sortBy}
                    onSortByChange={setSortBy}
                    sortOrder={sortOrder}
                    onSortOrderChange={setSortOrder}
                    isAdmin={isAdmin}
                    users={users}
                    selectedUserId={selectedUserId}
                    onUserChange={setSelectedUserId}
                    searchPlaceholder="Buscar por caso o tipo de gasto..."
                />
            )}

            <Table
                isEmpty={!activeLoading && activeGastos.length === 0}
                emptyMessage={caseId ? "No se encontraron gastos para este caso." : "No se encontraron gastos con los filtros seleccionados."}
                trigger={`${searchTerm}-${selectedUserId}-${sortBy}-${sortOrder}-${fromDate}-${toDate}`}
                columns={[
                    ...(!caseId ? [{ header: 'Caso' }] : []),
                    { header: 'Tipo de Gasto' },
                    { header: 'Monto' },
                    { header: 'Fecha' },
                    ...(isAdmin ? [{ header: 'Registrado por' }] : []),
                ]}
            >
                {activeGastos.map(g => (
                    <tr key={g.id} className="hover:bg-gray-50">
                        {!caseId && <td className="p-4">{g.suit_case?.title || `Caso #${g.suit_case_id}` || 'N/A'}</td>}
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
