import { GenericFilterBar } from '../ui/GenericFilterBar';

const ClientsFilterBar = ({
    searchTerm, onSearchChange,
    sortBy, onSortByChange,
    sortOrder, onSortOrderChange,
    resultCount,
}) => {
    return (
        <GenericFilterBar
            searchTerm={searchTerm}
            onSearchChange={onSearchChange}
            placeholder="Buscar por nombre, DNI o email..."
            sortBy={sortBy}
            onSortByChange={onSortByChange}
            sortOptions={[
                { value: 'created_at', label: 'Fecha de creación' },
                { value: 'alpha', label: 'Orden alfabético' },
            ]}
            sortOrder={sortOrder}
            onSortOrderChange={onSortOrderChange}
            resultCount={resultCount}
            resultItemName={{ singular: 'cliente', plural: 'clientes' }}
        />
    );
};

export default ClientsFilterBar;
