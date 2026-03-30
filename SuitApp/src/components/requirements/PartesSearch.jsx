import { useMemo, useCallback } from 'react';
import { Plus } from 'lucide-react';
import { usePartes } from '../../context/PartesContext';
import FilterAutosuggest from '../ui/FilterAutosuggest';
import { useModal } from '../../context/ModalContext';
import { NewParteModal } from '../people/NewParteModal';
import { Button } from '../ui/Button';

export function PartesSearch({ value, onChange, onFocus, onBlur }) {
    const { partes, initialized, refreshPartes } = usePartes();
    const { openModal } = useModal();

    const options = useMemo(() => {
        if (!initialized || !Array.isArray(partes)) return [];
        return partes.map((parte) => ({
            value: parte.id,
            label: `${parte.nombre} ${parte.apellido || ''}`,
            object: parte,
        }));
    }, [partes, initialized]);

    const handleChange = (id, option) => {
        onChange(id, option?.object || null);
    };

    const handleClear = () => {
        onChange(null, null);
    };

    const handleNewParteSuccess = useCallback(async (newParte) => {
        await refreshPartes();
        const parteObject = newParte?.data || newParte;
        if (parteObject?.id) {
            onChange(parteObject.id, parteObject);
        }
    }, [onChange, refreshPartes]);

    const handleAddNew = () => {
        openModal(NewParteModal, { onSuccess: handleNewParteSuccess });
    };

    return (
        <div>
            <FilterAutosuggest
                label="Parte"
                placeholder="Buscar parte..."
                value={value}
                options={options}
                onChange={handleChange}
                onClear={handleClear}
                onFocus={onFocus}
                onBlur={onBlur}
                emptyMessage="No se encontraron partes."
            />
            <div className="mt-2">
                <button type="button" onClick={handleAddNew} className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded">
                    + Agregar nuevo
                </button>
            </div>
        </div>
    );
}
