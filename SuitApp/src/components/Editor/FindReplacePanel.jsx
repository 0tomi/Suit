import React, { useEffect, useRef } from 'react';
import { ChevronLeft, ChevronRight, Search, Replace, X } from 'lucide-react';

const actionButtonClasses = 'inline-flex items-center gap-1 rounded-lg border border-gray-200 dark:border-gray-600 px-3 py-2 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 disabled:cursor-not-allowed disabled:opacity-50';

export default function FindReplacePanel({
    open,
    readOnly = false,
    replaceMode = false,
    searchTerm,
    replaceTerm,
    matchCount,
    activeIndex,
    onSearchTermChange,
    onReplaceTermChange,
    onPrev,
    onNext,
    onReplaceCurrent,
    onReplaceAll,
    onToggleReplaceMode,
    onClose,
}) {
    const searchInputRef = useRef(null);

    useEffect(() => {
        if (!open) return;
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
    }, [open]);

    if (!open) return null;

    const hasMatches = matchCount > 0;
    const activeLabel = hasMatches ? `${activeIndex + 1}/${matchCount}` : '0/0';

    return (
        <div
            className="mb-4 w-full max-w-[794px] rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 px-4 py-3 shadow-sm"
            data-testid="editor-find-replace-panel"
        >
            <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-3 md:flex-row md:items-center">
                    <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2">
                        <Search size={16} className="shrink-0 text-gray-400 dark:text-gray-500" />
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(event) => onSearchTermChange(event.target.value)}
                            placeholder="Buscar en el documento"
                            aria-label="Buscar en el documento"
                            className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                        />
                        <span className="shrink-0 rounded-md bg-gray-200 dark:bg-gray-600 px-2 py-0.5 text-xs font-medium text-gray-600 dark:text-gray-300">
                            {activeLabel}
                        </span>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            type="button"
                            onClick={onPrev}
                            disabled={!hasMatches}
                            className={actionButtonClasses}
                            aria-label="Coincidencia anterior"
                        >
                            <ChevronLeft size={16} />
                            <span>Anterior</span>
                        </button>
                        <button
                            type="button"
                            onClick={onNext}
                            disabled={!hasMatches}
                            className={actionButtonClasses}
                            aria-label="Coincidencia siguiente"
                        >
                            <span>Siguiente</span>
                            <ChevronRight size={16} />
                        </button>
                        {!readOnly && (
                            <button
                                type="button"
                                onClick={onToggleReplaceMode}
                                className={actionButtonClasses}
                                aria-label="Alternar modo reemplazo"
                            >
                                <Replace size={16} />
                                <span>{replaceMode ? 'Ocultar reemplazo' : 'Reemplazar'}</span>
                            </button>
                        )}
                        <button
                            type="button"
                            onClick={onClose}
                            className={actionButtonClasses}
                            aria-label="Cerrar buscar y reemplazar"
                        >
                            <X size={16} />
                        </button>
                    </div>
                </div>

                {replaceMode && !readOnly && (
                    <div className="flex flex-col gap-3 md:flex-row md:items-center">
                        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-gray-50 dark:bg-gray-700 px-3 py-2">
                            <Replace size={16} className="shrink-0 text-gray-400 dark:text-gray-500" />
                            <input
                                type="text"
                                value={replaceTerm}
                                onChange={(event) => onReplaceTermChange(event.target.value)}
                                placeholder="Reemplazar por"
                                aria-label="Reemplazar en el documento"
                                className="min-w-0 flex-1 bg-transparent text-sm text-gray-800 dark:text-gray-200 outline-none placeholder:text-gray-400 dark:placeholder:text-gray-500"
                            />
                        </div>

                        <div className="flex items-center gap-2">
                            <button
                                type="button"
                                onClick={onReplaceCurrent}
                                disabled={!hasMatches}
                                className={actionButtonClasses}
                            >
                                Reemplazar
                            </button>
                            <button
                                type="button"
                                onClick={onReplaceAll}
                                disabled={!hasMatches}
                                className={actionButtonClasses}
                            >
                                Reemplazar todo
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
