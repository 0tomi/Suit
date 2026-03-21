import { Filter } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '../ui/Select';
import { GenericFilterBar } from '../ui/GenericFilterBar';

const CasesFilterBar = ({
    searchTerm, onSearchChange,
    statusFilter, onStatusChange,
    typeFilter, onTypeChange,
    sortBy, onSortByChange,
    sortOrder, onSortOrderChange,
    caseTypes,
    resultCount,
}) => {
    return (
        <GenericFilterBar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            placeholder="Buscar por carátula o dueño..."
            inputTestId="cases-search-input"
            sortBy={sortBy}
            onSortByChange={onSortByChange}
            sortOptions={[
                { value: 'updated_at', label: 'Últ. actualización' },
                { value: 'start_date', label: 'Fecha de inicio' },
            ]}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            resultCount={resultCount}
            resultItemName={{ singular: 'caso', plural: 'casos' }}
        >
            {/* Filtro por tipo */}
            <div className="flex items-center gap-2 border-l pl-4 border-(--border-default)">
                <Filter className="h-4 w-4 text-(--text-tertiary)" />
                <Select value={typeFilter} onValueChange={onTypeChange}>
                    <SelectTrigger
                        data-testid="cases-filter-type"
                        className="border-none bg-transparent hover:bg-(--bg-card-hover) h-8 w-auto min-w-[140px]"
                    >
                        <SelectValue placeholder="Todos los tipos" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los tipos</SelectItem>
                        <SelectSeparator />
                        {caseTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Filtro por estado */}
            <div className="flex items-center gap-2 border-l pl-4 border-(--border-default)">
                <Select value={statusFilter} onValueChange={onStatusChange}>
                    <SelectTrigger
                        data-testid="cases-filter-status"
                        className="border-none bg-transparent hover:bg-(--bg-card-hover) h-8 w-auto min-w-[110px]"
                    >
                        <SelectValue placeholder="Estado" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectSeparator />
                        <SelectItem value="Activo">Activos</SelectItem>
                        <SelectItem value="Finalizado">Finalizados</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </GenericFilterBar>
    );
};

export default CasesFilterBar;
