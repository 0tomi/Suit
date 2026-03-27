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
    agendaFilter,
    onAgendaChange,
    availableAgendas = [],
    sortMode,
    onSortChange,
    resultCount,
    hideAgenda = false,
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
            <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Visualización</span>
                <Select value={categoryFilter} onValueChange={onCategoryChange}>
                    <SelectTrigger
                        className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[170px] p-0 px-2"
                        aria-label="Filtrar por categoría"
                    >
                        <SelectValue placeholder="Seleccionar..." />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all-except-completed">Todos menos cumplidos</SelectItem>
                        <SelectSeparator />
                        <SelectItem value="pending-postponed">Solo pendientes y prorrogados</SelectItem>
                        <SelectItem value="all">Ver todos los registros</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Filtro de prioridad */}
            <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Prioridad</span>
                <Select value={priorityFilter} onValueChange={onPriorityChange}>
                    <SelectTrigger
                        className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[100px] p-0 px-2"
                        aria-label="Filtrar por prioridad"
                    >
                        <SelectValue placeholder="Prioridad" />
                    </SelectTrigger>
                    <SelectContent>
                        <SelectItem value="all">Todas</SelectItem>
                        <SelectSeparator />
                        <SelectItem value="Normal">Normal</SelectItem>
                        <SelectItem value="Urgente">Urgentes</SelectItem>
                    </SelectContent>
                </Select>
            </div>

            {/* Filtro de agenda */}
            {!hideAgenda && (
                <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Agenda</span>
                    <Select value={agendaFilter} onValueChange={onAgendaChange}>
                        <SelectTrigger
                            className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[120px] p-0 px-2"
                            aria-label="Filtrar por agenda"
                        >
                            <SelectValue placeholder="Todas" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">Todas</SelectItem>
                            
                            {availableAgendas.users.length > 0 && (
                                <>
                                    <SelectSeparator className="opacity-50" />
                                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Personales</div>
                                    {availableAgendas.users.map(agenda => (
                                        <SelectItem key={agenda} value={agenda}>{agenda}</SelectItem>
                                    ))}
                                </>
                            )}

                            {availableAgendas.cases.length > 0 && (
                                <>
                                    <SelectSeparator className="opacity-50" />
                                    <div className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">Por Caso</div>
                                    {availableAgendas.cases.map(agenda => (
                                        <SelectItem key={agenda} value={agenda}>{agenda}</SelectItem>
                                    ))}
                                </>
                            )}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </GenericFilterBar>
    );
}
