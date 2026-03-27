import { useMemo } from 'react';
import { usePartes } from '../../context/PartesContext';
import FilterAutosuggest from '../ui/FilterAutosuggest';

export function PartesSearch({ value, onChange, onFocus, onBlur }) {
    const { partes, initialized } = usePartes();

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

    return (
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
    );
}
