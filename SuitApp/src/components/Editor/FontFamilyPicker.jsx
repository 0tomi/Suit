import React, { useState, useRef, useEffect, useCallback } from 'react';
import { ChevronDown } from 'lucide-react';
import { useSystemFonts } from '../../hooks/useSystemFonts';

/**
 * Selector de fuente con buscador integrado.
 * Reemplaza el <select> nativo para soportar búsqueda sobre las fuentes del sistema.
 * Se cierra al hacer clic fuera o al presionar Escape.
 */
export function FontFamilyPicker({ value, onChange, disabled }) {
    const { fonts, loading } = useSystemFonts();
    const [open, setOpen] = useState(false);
    const [query, setQuery] = useState('');
    const containerRef = useRef(null);
    const searchRef = useRef(null);

    // Cerrar al hacer clic fuera del picker.
    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (!containerRef.current?.contains(e.target)) setOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [open]);

    // Enfocar el buscador cuando el dropdown se abre (siguiente frame para asegurar mount del DOM).
    useEffect(() => {
        if (!open) return;
        const id = requestAnimationFrame(() => searchRef.current?.focus());
        return () => cancelAnimationFrame(id);
    }, [open]);

    const handleKeyDown = useCallback((e) => {
        if (e.key === 'Escape') setOpen(false);
    }, []);

    const selectFont = (font) => {
        onChange(font);
        setOpen(false);
    };

    const filtered = query
        ? fonts.filter((f) => f.toLowerCase().includes(query.toLowerCase()))
        : fonts;

    const displayLabel = value || 'Fuente';

    return (
        <div ref={containerRef} className="relative" onKeyDown={handleKeyDown}>
            {/* Botón disparador */}
            <button
                type="button"
                disabled={disabled || loading}
                onClick={() => { setQuery(''); setOpen((v) => !v); }}
                className={[
                    'flex h-8 w-44 items-center justify-between gap-1 rounded-lg border border-transparent px-2 text-sm outline-none',
                    'focus:border-blue-500 focus:ring-1 focus:ring-blue-500',
                    disabled || loading
                        ? 'cursor-not-allowed opacity-45 bg-transparent text-gray-700 dark:text-gray-300'
                        : 'bg-transparent text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                ].join(' ')}
                aria-label="Familia de fuente"
                aria-haspopup="listbox"
                aria-expanded={open}
            >
                <span className="truncate">{displayLabel}</span>
                <ChevronDown size={14} className="shrink-0 opacity-60" />
            </button>

            {/* Dropdown */}
            {open && (
                <div className="absolute left-0 top-full z-50 mt-1 w-64 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-lg">
                    {/* Campo de búsqueda */}
                    <div className="p-2 border-b border-gray-100 dark:border-gray-700">
                        <input
                            ref={searchRef}
                            type="text"
                            value={query}
                            onChange={(e) => setQuery(e.target.value)}
                            placeholder="Buscar fuente..."
                            className="w-full h-7 rounded-md border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-900 px-2 text-sm text-gray-700 dark:text-gray-300 outline-none focus:border-blue-500"
                        />
                    </div>

                    {/* Lista de fuentes */}
                    <ul
                        role="listbox"
                        className="max-h-56 overflow-y-auto py-1"
                    >
                        {filtered.length === 0 && (
                            <li className="px-3 py-2 text-sm text-gray-400 dark:text-gray-500">
                                Sin resultados
                            </li>
                        )}
                        {filtered.map((font) => (
                            <li
                                key={font}
                                role="option"
                                aria-selected={font === value}
                                onMouseDown={() => selectFont(font)}
                                className={[
                                    'cursor-pointer px-3 py-1.5 text-sm truncate',
                                    font === value
                                        ? 'bg-blue-50 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 font-medium'
                                        : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
                                ].join(' ')}
                                style={{ fontFamily: font }}
                            >
                                {font}
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
}
