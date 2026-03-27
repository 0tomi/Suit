import { DateRangePicker } from '../ui/DateRangePicker';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '../ui/Select';
import { Filter, User } from 'lucide-react';
import { GenericFilterBar } from '../ui/GenericFilterBar';

const EMPTY_USERS = [];

/**
 * EconomiaFilterBar — Componente compartido para filtrar y ordenar Honorarios y Gastos.
 */
export const EconomiaFilterBar = ({
    searchTerm, onSearchChange,
    dateRange, onDateRangeChange,
    statusFilter, onStatusChange,
    sortBy, onSortByChange,
    sortOrder, onSortOrderChange,
    isAdmin,
    users = EMPTY_USERS,
    selectedUserId, onUserChange,
    showStatusFilter = true,
    searchPlaceholder = "Buscar por caso o cliente...",
}) => {
    return (
        <GenericFilterBar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            placeholder={searchPlaceholder}
            inputTestId="economia-search-input"
            sortBy={sortBy}
            onSortByChange={onSortByChange}
            sortOptions={[
                { value: 'created_at', label: 'Fecha' },
                { value: 'monto', label: 'Monto' },
            ]}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            topPadding={true}
            vertical={true}
            filtersClassName="flex flex-wrap items-center gap-6 pt-2 border-t border-(--border-subtle) w-full"
        >
            {/* Rango de fechas */}
            <div className="flex items-center gap-3">
                <span className="text-sm font-semibold text-(--text-secondary)">Rango:</span>
                <DateRangePicker date={dateRange} onDateChange={onDateRangeChange} />
            </div>

            {/* Filtro de Estado (Pagado/No pagado) */}
            {showStatusFilter && (
                <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                    <div className="flex items-center gap-1.5 text-(--text-tertiary)">
                        <Filter className="h-3 w-3" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Estado</span>
                    </div>
                    <Select value={statusFilter} onValueChange={onStatusChange}>
                        <SelectTrigger className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[140px] p-0 px-2">
                            <SelectValue placeholder="Todos los estados" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los estados</SelectItem>
                            <SelectSeparator />
                            <SelectItem value="paid">Pagados</SelectItem>
                            <SelectItem value="unpaid">No pagados</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            )}

            {/* Filtro de Usuario (Solo Admin) */}
            {isAdmin && (
                <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                    <div className="flex items-center gap-1.5 text-(--text-tertiary)">
                        <User className="h-3 w-3" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Abogado</span>
                    </div>
                    <Select value={selectedUserId} onValueChange={onUserChange}>
                        <SelectTrigger className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[150px] p-0 px-2">
                            <SelectValue placeholder="Todos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todos los abogados</SelectItem>
                            <SelectSeparator />
                            {users.map(u => (
                                <SelectItem key={u.id} value={String(u.id)}>
                                    {u.name || u.tag}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </GenericFilterBar>
    );
};
