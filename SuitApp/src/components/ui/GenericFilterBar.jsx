import React from 'react';
import { ArrowDownAZ, ArrowUpAZ } from 'lucide-react';
import { SearchBar } from './SearchBar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './Select';
import { FilterBarLayout } from './FilterBarLayout';

const EMPTY_SORT_OPTIONS = [];

/**
 * GenericFilterBar - Componente reutilizable para búsquedas y filtros comunes.
 * 
 * @param {Object} props
 * @param {string} props.searchTerm - Valor actual de búsqueda
 * @param {function} props.onSearchChange - Callback que recibe el nuevo valor de búsqueda (string)
 * @param {string} props.placeholder - Placeholder para el input de búsqueda
 * @param {string} props.sortBy - Campo por el que se está ordenando
 * @param {function} props.onSortByChange - Callback para cambiar el campo de ordenamiento
 * @param {Array} props.sortOptions - Opciones de ordenamiento [{ value, label }]
 * @param {string} props.sortOrder - Dirección del orden ('asc' | 'desc')
 * @param {function} props.onSortOrderChange - Callback para cambiar la dirección
 * @param {number} props.resultCount - Cantidad de resultados encontrados
 * @param {string|Object} props.resultItemName - Nombre del ítem para el contador ('cliente' o { singular, plural })
 * @param {string} props.inputTestId - ID para pruebas del input de búsqueda
 * @param {React.ReactNode} props.children - Filtros adicionales
 */
export const GenericFilterBar = ({
    searchTerm,
    onSearchChange,
    placeholder = "Buscar...",
    sortBy,
    onSortByChange,
    sortOptions = EMPTY_SORT_OPTIONS,
    sortOrder,
    onSortOrderChange,
    resultCount,
    resultItemName = 'resultado',
    inputTestId,
    topPadding = false,
    filtersClassName = "",
    vertical = false,
    children,
}) => {
    const hasActiveSearch = typeof searchTerm === 'string' && searchTerm.trim().length > 0;

    const getResultText = () => {
        if (!hasActiveSearch || resultCount === undefined) return null;

        let singular = 'resultado';
        let plural = 'resultados';

        if (typeof resultItemName === 'string') {
            singular = resultItemName;
            plural = `${resultItemName}s`;
        } else if (resultItemName && typeof resultItemName === 'object') {
            singular = resultItemName.singular || singular;
            plural = resultItemName.plural || plural;
        }

        return resultCount === 1 
            ? `1 ${singular} encontrado` 
            : `${resultCount} ${plural} encontrados`;
    };

    return (
        <FilterBarLayout
            topPadding={topPadding}
            vertical={vertical}
            searchBar={
                <SearchBar
                    value={searchTerm}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder={placeholder}
                    inputTestId={inputTestId}
                />
            }
            filters={
                <div className={filtersClassName || "flex items-center gap-4 flex-wrap"}>
                    {children}

                    {sortOptions.length > 0 && (
                        <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                            {sortOptions.length > 1 && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-(--text-tertiary)">
                                    Ordenar por
                                </span>
                            )}
                            <Select value={sortBy} onValueChange={onSortByChange}>
                                <SelectTrigger className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[100px] p-0 px-2">
                                    <SelectValue placeholder="Ordenar por" />
                                </SelectTrigger>
                                <SelectContent>
                                    {sortOptions.map(opt => (
                                        <SelectItem key={opt.value} value={opt.value}>
                                            {opt.label}
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                    )}

                    {onSortOrderChange && (
                        <div className="flex items-center border-l pl-4 border-(--border-default)">
                            <button
                                onClick={() => onSortOrderChange(sortOrder === 'desc' ? 'asc' : 'desc')}
                                className="p-1.5 rounded-md text-(--text-tertiary) hover:text-(--text-primary) hover:bg-(--bg-hover) transition-colors"
                                title={sortOrder === 'desc' ? 'Más reciente / Z-A primero' : 'Más antiguo / A-Z primero'}
                            >
                                {sortOrder === 'desc'
                                    ? <ArrowDownAZ className="h-4 w-4" />
                                    : <ArrowUpAZ className="h-4 w-4" />
                                }
                            </button>
                        </div>
                    )}
                </div>
            }
            resultCount={getResultText()}
        />
    );
};
