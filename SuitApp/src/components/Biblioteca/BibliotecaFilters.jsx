import { GenericFilterBar } from '../ui/GenericFilterBar';
import { Filter, Tag } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue, SelectSeparator } from '../ui/Select';

const EXTENSION_GROUPS = [
    { id: 'pdf', label: 'PDF', color: 'bg-rose-500/10 text-rose-600 border-rose-200' },
    { id: 'word', label: 'Word', color: 'bg-blue-500/10 text-blue-600 border-blue-200' },
    { id: 'excel', label: 'Excel/CSV', color: 'bg-emerald-500/10 text-emerald-600 border-emerald-200' },
    { id: 'powerpoint', label: 'PowerPoint', color: 'bg-orange-500/10 text-orange-600 border-orange-200' },
    { id: 'image', label: 'Imágenes', color: 'bg-purple-500/10 text-purple-600 border-purple-200' },
    { id: 'text', label: 'Texto', color: 'bg-gray-500/10 text-gray-600 border-gray-200' },
];

export const BibliotecaFilters = ({
    searchTerm,
    onSearchChange,
    catalogOptions,
    activeCatalog,
    onSelectCatalog,
    sortBy,
    onSortByChange,
    sortOrder,
    onSortOrderChange,
    selectedExtensions,
    onExtensionChange,
    resultCount,
}) => {
    const toggleExtension = (extId) => {
        const next = selectedExtensions.includes(extId)
            ? selectedExtensions.filter(id => id !== extId)
            : [...selectedExtensions, extId];
        onExtensionChange(next);
    };

    return (
        <div className="space-y-4 rounded-xl border border-(--border-subtle) bg-(--bg-card) p-4 shadow-sm">
            <GenericFilterBar
                searchTerm={searchTerm}
                onSearchChange={onSearchChange}
                placeholder="Buscar archivos por nombre..."
                sortBy={sortBy}
                onSortByChange={onSortByChange}
                sortOptions={[
                    { value: 'created_at', label: 'Fecha' },
                    { value: 'name', label: 'Nombre' },
                    { value: 'size', label: 'Tamaño' },
                ]}
                sortOrder={sortOrder}
                onSortOrderChange={onSortOrderChange}
                resultCount={resultCount}
                resultItemName="archivo"
            >
                {/* Filtro por Catálogo (Vertical) */}
                {catalogOptions && catalogOptions.length > 0 && (
                    <div className="flex flex-col gap-1 border-l pl-4 border-(--border-default)">
                        <div className="flex items-center gap-1.5 text-(--text-tertiary)">
                            <Tag className="h-3 w-3" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Catálogo</span>
                        </div>
                        <Select value={activeCatalog} onValueChange={onSelectCatalog}>
                            <SelectTrigger className="border-none bg-transparent hover:bg-(--bg-card-hover) h-7 min-h-0 w-auto min-w-[110px] p-0 px-2">
                                <SelectValue placeholder="Catálogo" />
                            </SelectTrigger>
                            <SelectContent>
                                {catalogOptions.map(cat => (
                                    <SelectItem key={cat.id} value={String(cat.id)}>{cat.name}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                )}
            </GenericFilterBar>

            <div className="flex flex-wrap items-center gap-2 pt-3 border-t border-(--border-subtle)">
                <div className="flex items-center gap-2 mr-2 text-(--text-tertiary)">
                    <Filter className="h-4 w-4" />
                    <span className="text-xs font-semibold uppercase tracking-wider">Tipos:</span>
                </div>
                {EXTENSION_GROUPS.map((group) => {
                    const isSelected = selectedExtensions.includes(group.id);
                    return (
                        <button
                            key={group.id}
                            onClick={() => toggleExtension(group.id)}
                            className={`rounded-full px-3 py-1 text-xs font-medium border transition-all ${
                                isSelected
                                    ? `ring-2 ring-offset-1 ring-blue-500/30 ${group.color}`
                                    : 'bg-(--bg-input) text-(--text-secondary) border-transparent hover:border-(--border-default)'
                            }`}
                        >
                            {group.label}
                        </button>
                    );
                })}
                {selectedExtensions.length > 0 && (
                    <button
                        onClick={() => onExtensionChange([])}
                        className="text-xs text-blue-600 hover:text-blue-700 font-medium ml-2 px-2 py-1 rounded-md hover:bg-blue-50 transition-colors"
                    >
                        Limpiar filtros
                    </button>
                )}
            </div>
        </div>
    );
};
