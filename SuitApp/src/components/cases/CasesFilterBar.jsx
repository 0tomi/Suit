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
            {/* Filtro por Fuero */}
            <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                <div className="flex items-center gap-1.5 text-(--text-tertiary)">
                    <Filter className="h-3 w-3" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">Fuero</span>
                </div>
                <Select value={typeFilter} onValueChange={onTypeChange}>
                    <SelectTrigger
                        data-testid="cases-filter-type"
                        className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[130px] p-0 px-2"
                    >
                        <SelectValue placeholder="Todos los fueros" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos los fueros</SelectItem>
                        <SelectSeparator />
                        {caseTypes.map(type => (
                            <SelectItem key={type} value={type}>{type}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Filtro por estado */}
            <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Estado</span>
                <Select value={statusFilter} onValueChange={onStatusChange}>
                    <SelectTrigger
                        data-testid="cases-filter-status"
                        className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[100px] p-0 px-2"
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
