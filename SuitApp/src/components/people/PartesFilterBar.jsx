import { GenericFilterBar } from '../ui/GenericFilterBar';

const PartesFilterBar = ({
    searchTerm, onSearchChange,
    sortBy, onSortByChange,
    sortOrder, onSortOrderChange,
    resultCount,
}) => {
    return (
        <GenericFilterBar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            placeholder="Buscar por nombre, rol, email o teléfono..."
            sortBy={sortBy}
            onSortByChange={onSortByChange}
            sortOptions={[
                { value: 'created_at', label: 'Fecha de creación' },
                { value: 'alpha', label: 'Orden alfabético' },
            ]}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            resultCount={resultCount}
            resultItemName={{ singular: 'parte', plural: 'partes' }}
        />
    );
};

export default PartesFilterBar;
