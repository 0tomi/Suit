import React from 'react';
import { Search } from 'lucide-react';

/**
 * Componente UI genérico para Barras de Búsqueda.
 */
export const SearchBar = ({
    value,
    onChange,
    placeholder = "Buscar...",
    className = '',
    containerClassName = '',
    inputTestId,
}) => {
    return (
        <div className={`relative flex-1 ${containerClassName}`}>
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-(--text-tertiary)" />
            <input
                type="text"
                data-testid={inputTestId}
                placeholder={placeholder}
                className={`w-full bg-(--bg-input) pl-10 pr-4 py-2 border border-(--border-default) rounded-lg outline-none focus:ring-2 focus:ring-blue-500 text-(--text-primary) placeholder-(--text-tertiary) transition-shadow ${className}`}
                value={value}
                onChange={onChange}
            />
        </div>
    );
};
