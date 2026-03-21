import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '../ui/Select';
import { GenericFilterBar } from '../ui/GenericFilterBar';

/**
 * Barra de filtros para la sección de Vencimientos.
 * Incluye: búsqueda, categoría, prioridad, ordenamiento y conteo de resultados.
 */
export default function DeadlinesFilterBar({
    searchTerm,
    onSearchChange,
    categoryFilter,
    onCategoryChange,
    priorityFilter,
    onPriorityChange,
    sortMode,
    onSortChange,
    resultCount,
}) {
    return (
        <GenericFilterBar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            placeholder="Buscar por título o descripción..."
            sortBy={sortMode}
            onSortByChange={onSortChange}
            sortOptions={[
                { value: 'date-asc', label: 'Fecha (más próximos)' },
                { value: 'date-desc', label: 'Fecha (más lejanos)' },
                { value: 'name-asc', label: 'Nombre (A-Z)' },
                { value: 'name-desc', label: 'Nombre (Z-A)' },
                { value: 'urgentes-first', label: 'Urgentes primero' },
                { value: 'normales-first', label: 'Normales primero' },
            ]}
            resultCount={resultCount}
            resultItemName={{ singular: 'vencimiento', plural: 'vencimientos' }}
        >
            {/* Filtro de categoría */}
            <div className="flex items-center gap-2 border-l pl-4 border-(--border-default)">
                <Select value={categoryFilter} onValueChange={onCategoryChange}>
                    <SelectTrigger
                        className="border-none bg-transparent hover:bg-(--bg-card-hover) h-8 w-auto min-w-[180px]"
                        aria-label="Filtrar por categoría"
                    >
                        <SelectValue placeholder="Seleccionar categoría" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all-except-completed">Todos menos cumplidos</SelectItem>
                        <SelectSeparator />
                        <SelectItem value="pending-postponed">Solo pendientes y prorrogados</SelectItem>
                        <SelectItem value="all">Todos</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Filtro de prioridad */}
            <div className="flex items-center gap-2 border-l pl-4 border-(--border-default)">
                <Select value={priorityFilter} onValueChange={onPriorityChange}>
                    <SelectTrigger
                        className="border-none bg-transparent hover:bg-(--bg-card-hover) h-8 w-auto min-w-[110px]"
                        aria-label="Filtrar por prioridad"
                    >
                        <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todos</SelectItem>
                        <SelectSeparator />
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Urgente">Urgentes</SelectItem>
                    </SelectContent>
                </Select>
            </div>
        </GenericFilterBar>
    );
}
