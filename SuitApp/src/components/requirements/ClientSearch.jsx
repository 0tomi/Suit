import { useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { useClients } from '../../context/ClientsContext';
import { getClientDisplayName } from '../../utils/clientDisplayName';
import { useModal } from '../../context/ModalContext';
import NewClientModal from '../clients/NewClientModal';
import FilterAutosuggest from '../ui/FilterAutosuggest';
import { Button } from '../ui/Button';

export function ClientSearch({ value, onChange, onFocus, onBlur }) {
    const { clients, initialized, refreshClients } = useClients();
    const { openModal } = useModal();

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

    const handleNewClientSuccess = useCallback(async (newClient) => {
        await refreshClients();
        const clientObject = newClient?.data?.client || newClient?.data || newClient;
        if (clientObject?.id) {
            onChange(clientObject.id, clientObject);
        }
    }, [onChange, refreshClients]);

    const handleAddNew = () => {
        openModal(NewClientModal, { onSuccess: handleNewClientSuccess });
    };

    return (
        <div>
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
            <div className="mt-2">
                <button type="button" onClick={handleAddNew} className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
                    + Agregar nuevo
                </button>
            </div>
        </div>
    );
}
