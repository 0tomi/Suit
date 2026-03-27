import { useMemo } from 'react';
import { useCases } from '../../context/CasesContext';
import FilterAutosuggest from '../ui/FilterAutosuggest';

export function CaseSearch({ value, onChange, onFocus, onBlur }) {
    const { cases, initialized } = useCases();

    const options = useMemo(() => {
        if (!initialized || !Array.isArray(cases)) return [];
        return cases.map((suitCase) => ({
            value: suitCase.id,
            label: suitCase.title,
            object: suitCase,
        }));
    }, [cases, initialized]);

    const handleChange = (id, option) => {
        onChange(id, option?.object || null);
    };

    const handleClear = () => {
        onChange(null, null);
    };

    return (
        <FilterAutosuggest
            label="Expediente"
            placeholder="Buscar expediente..."
            value={value}
            options={options}
            onChange={handleChange}
            onClear={handleClear}
            onFocus={onFocus}
            onBlur={onBlur}
            emptyMessage="No se encontraron expedientes."
            maxResults={Infinity}
        />
    );
}
