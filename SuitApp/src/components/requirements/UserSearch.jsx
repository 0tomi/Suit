import { useMemo } from 'react';
import { useUsers } from '../../context/UsersContext';
import FilterAutosuggest from '../ui/FilterAutosuggest';

export function UserSearch({ value, onChange, onFocus, onBlur }) {
    const { users, initialized } = useUsers();

    const options = useMemo(() => {
        if (!initialized || !Array.isArray(users)) return [];
        return users.map((user) => ({
            value: user.id,
            label: user.name,
            object: user,
        }));
    }, [users, initialized]);

    const handleChange = (id, option) => {
        onChange(id, option?.object || null);
    };

    const handleClear = () => {
        onChange(null, null);
    };

    return (
        <FilterAutosuggest
            label="Usuario/Abogado"
            placeholder="Buscar usuario..."
            value={value}
            options={options}
            onChange={handleChange}
            onClear={handleClear}
            onFocus={onFocus}
            onBlur={onBlur}
            emptyMessage="No se encontraron usuarios."
        />
    );
}
