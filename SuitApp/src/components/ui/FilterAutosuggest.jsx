import { useDeferredValue, useId, useMemo, useRef, useState } from 'react';
import { Check, Search, X } from 'lucide-react';

const DEFAULT_MAX_RESULTS = 8;

const FilterAutosuggest = ({
    label,
    placeholder,
    value,
    options,
    onChange,
    onClear,
    emptyMessage,
    onQueryChange,
    onFocus,
    onBlur,
    maxResults = DEFAULT_MAX_RESULTS,
}) => {
    const inputId = useId();
    const wrapperRef = useRef(null);
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState('');
    const [highlightedIndex, setHighlightedIndex] = useState(0);

    const selectedOption = useMemo(
        () => options.find((option) => option.value === value) ?? null,
        [options, value]
    );

    const deferredQuery = useDeferredValue(query.trim().toLowerCase());
    const inputValue = isOpen ? query : (selectedOption?.label ?? '');
    const normalizedSelectedLabel = useMemo(
        () => selectedOption?.label?.trim().toLowerCase() ?? '',
        [selectedOption]
    );

    const filteredOptions = useMemo(() => {
        if (onQueryChange) {
            return options.slice(0, maxResults);
        }
        // Al abrir con una opción ya seleccionada, mostramos el listado completo
        // en lugar de filtrar por la etiqueta visible del valor actual.
        const effectiveQuery = deferredQuery === normalizedSelectedLabel ? '' : deferredQuery;
        if (!effectiveQuery) return options.slice(0, maxResults);

        return options
            .filter((option) => option.label.toLowerCase().includes(effectiveQuery))
            .slice(0, maxResults);
    }, [deferredQuery, normalizedSelectedLabel, options, onQueryChange, maxResults]);

    const resetToSelection = () => {
        setQuery(selectedOption?.label ?? '');
        setIsOpen(false);
        setHighlightedIndex(0);
    };

    const closeIfFocusLeft = () => {
        requestAnimationFrame(() => {
            if (wrapperRef.current?.contains(document.activeElement)) return;

            if (!query.trim()) {
                onClear();
                setQuery('');
                setIsOpen(false);
                return;
            }

            resetToSelection();
        });
    };

    const handleSelect = (option) => {
        onChange(option.value, option);
        setQuery(option.label);
        if (onQueryChange) {
            onQueryChange(option.label);
        }
        setIsOpen(false);
        setHighlightedIndex(0);
    };

    const handleInputChange = (event) => {
        const newQuery = event.target.value;
        setQuery(newQuery);
        if (onQueryChange) {
            onQueryChange(newQuery);
        }
        setIsOpen(true);
        setHighlightedIndex(0);
    };

    const handleKeyDown = (event) => {
        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setIsOpen(true);
            setHighlightedIndex((current) => Math.min(current + 1, Math.max(filteredOptions.length - 1, 0)));
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedIndex((current) => Math.max(current - 1, 0));
        }

        if (event.key === 'Enter' && isOpen && filteredOptions[highlightedIndex]) {
            event.preventDefault();
            handleSelect(filteredOptions[highlightedIndex]);
        }

        if (event.key === 'Escape') {
            event.preventDefault();
            resetToSelection();
        }
    };

    return (
        <div ref={wrapperRef} className="relative min-w-[220px] flex-1" onBlur={closeIfFocusLeft}>
            <label htmlFor={inputId} className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">
                {label}
            </label>
            <div className={`relative rounded-xl border bg-(--bg-input) ${value ? 'border-blue-500/60 shadow-[0_0_0_1px_rgba(59,130,246,0.15)]' : 'border-(--border-default)'}`}>
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-tertiary)" />
                <input
                    id={inputId}
                    type="text"
                    value={inputValue}
                    onChange={handleInputChange}
                    onFocus={(e) => {
                        setQuery(selectedOption?.label ?? '');
                        setIsOpen(true);
                        setHighlightedIndex(0);
                        // Si ya había una opción elegida, dejamos el texto seleccionado
                        // para que el siguiente tipeo reemplace la etiqueta y actúe como búsqueda.
                        if (selectedOption?.label) {
                            requestAnimationFrame(() => {
                                e.target.select();
                            });
                        }
                        if (onFocus) onFocus(e);
                    }}
                    onBlur={(e) => {
                        closeIfFocusLeft();
                        if (onBlur) onBlur(e);
                    }}
                    onKeyDown={handleKeyDown}
                    placeholder={placeholder}
                    className="w-full rounded-xl bg-transparent py-2.5 pl-9 pr-10 text-sm text-(--text-primary) outline-none placeholder-(--text-tertiary)"
                    autoComplete="off"
                />
                {value && (
                    <button
                        type="button"
                        onClick={() => {
                            onClear();
                            setQuery('');
                            setIsOpen(false);
                        }}
                        className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-md text-(--text-tertiary) hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
                        aria-label={`Limpiar filtro de ${label.toLowerCase()}`}
                    >
                        <X className="h-4 w-4" />
                    </button>
                )}
            </div>

            {isOpen && (
                <div className="absolute left-0 right-0 top-[calc(100%+0.35rem)] z-40 overflow-hidden rounded-2xl border border-(--border-default) bg-(--bg-card) shadow-xl">
                    <div className="max-h-64 overflow-y-auto p-1.5">
                        {filteredOptions.length > 0 ? (
                            filteredOptions.map((option, index) => {
                                const isSelected = option.value === value;
                                const isHighlighted = highlightedIndex === index;

                                return (
                                    <button
                                        key={option.value}
                                        type="button"
                                        onMouseDown={(event) => event.preventDefault()}
                                        onClick={() => handleSelect(option)}
                                        className={`flex w-full items-center justify-between rounded-xl px-3 py-2.5 text-left text-sm transition-colors ${isHighlighted ? 'bg-blue-50 text-blue-700' : 'text-(--text-primary) hover:bg-(--bg-card-hover)'} ${isSelected ? 'font-medium' : ''}`}
                                    >
                                        <span>{option.label}</span>
                                        {isSelected && <Check className="h-4 w-4" />}
                                    </button>
                                );
                            })
                        ) : (
                            <p className="px-3 py-4 text-sm text-(--text-secondary)">{emptyMessage}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

export default FilterAutosuggest;
