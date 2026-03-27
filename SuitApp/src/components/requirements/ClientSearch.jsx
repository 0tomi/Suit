import { useMemo } from 'react';
import { useClients } from '../../context/ClientsContext';
import { getClientDisplayName } from '../../utils/clientDisplayName';
import FilterAutosuggest from '../ui/FilterAutosuggest';

export function ClientSearch({ value, onChange, onFocus, onBlur }) {
    const { clients, initialized } = useClients();

    const options = useMemo(() => {
        if (!initialized || !Array.isArray(clients)) return [];
        return clients.map((client) => ({
            value: client.id,
            label: getClientDisplayName(client),
            object: client,
        }));
    }, [clients, initialized]);

    const handleChange = (id, option) => {
        onChange(id, option?.object || null);
    };

    const handleClear = () => {
        onChange(null, null);
    };

    return (
        <FilterAutosuggest
            label="Cliente"
            placeholder="Buscar cliente..."
            value={value}
            options={options}
            onChange={handleChange}
            onClear={handleClear}
            onFocus={onFocus}
            onBlur={onBlur}
            emptyMessage="No se encontraron clientes."
        />
    );
}
