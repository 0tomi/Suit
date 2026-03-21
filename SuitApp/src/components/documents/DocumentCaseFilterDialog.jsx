import { useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { BriefcaseBusiness, Check, Search, X } from 'lucide-react';
import { getCaseLifecycle } from '../../pages/documentsFilters.js';

const DocumentCaseFilterDialog = ({
    open,
    onOpenChange,
    cases,
    selectedCaseId,
    caseMode,
    includeClosedCases,
    onIncludeClosedCasesChange,
    onSelectCase,
    onSelectPersonal,
    onClearCaseFilter,
    loadingClosedCases = false,
}) => {
    const [query, setQuery] = useState('');
    const searchInputRef = useRef(null);
    const deferredQuery = useDeferredValue(query.trim().toLowerCase());

    useEffect(() => {
        if (!open) return;
        searchInputRef.current?.focus();
    }, [open]);

    const filteredCases = useMemo(() => {
        const sorted = [...cases].sort((left, right) => (left.title || '').localeCompare(right.title || '', 'es'));
        if (!deferredQuery) return sorted;

        return sorted.filter((caseItem) => (caseItem.title || '').toLowerCase().includes(deferredQuery));
    }, [cases, deferredQuery]);

    const handleSelectCase = (caseId) => {
        onSelectCase(caseId);
        onOpenChange(false);
    };

    const handleSelectPersonal = () => {
        onSelectPersonal();
        onOpenChange(false);
    };

    const handleSelectAll = () => {
        onClearCaseFilter();
        onOpenChange(false);
    };

    return (
        <Dialog.Root
            open={open}
            onOpenChange={(nextOpen) => {
                if (nextOpen) {
                    setQuery('');
                }
                onOpenChange(nextOpen);
            }}
        >
            <Dialog.Portal>
                <Dialog.Overlay className="fixed inset-0 z-[120] bg-(--bg-overlay) backdrop-blur-sm animate-in fade-in" />
                <Dialog.Content className="fixed left-1/2 top-1/2 z-[130] w-[min(92vw,760px)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[28px] border border-(--border-subtle) bg-(--bg-card) shadow-2xl animate-in fade-in zoom-in-95">
                    <div className="flex items-start justify-between border-b border-(--border-subtle) px-6 py-5">
                        <div>
                            <Dialog.Title className="text-xl font-semibold text-(--text-primary)">Seleccionar caso</Dialog.Title>
                            <Dialog.Description className="mt-1 text-sm text-(--text-secondary)">
                                Busca por nombre y cambia el alcance de los documentos sin salir de la tabla.
                            </Dialog.Description>
                        </div>
                        <Dialog.Close asChild>
                            <button
                                type="button"
                                className="inline-flex h-9 w-9 items-center justify-center rounded-full text-(--text-tertiary) hover:bg-(--bg-card-hover) hover:text-(--text-primary)"
                                aria-label="Cerrar selector de casos"
                            >
                                <X className="h-4 w-4" />
                            </button>
                        </Dialog.Close>
                    </div>

                    <div className="space-y-4 px-6 py-5">
                        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                            <div className="flex-1">
                                <label htmlFor="case-filter-search" className="mb-1.5 block text-sm font-medium text-(--text-primary)">
                                    Nombre del caso
                                </label>
                                <div className="relative">
                                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-(--text-tertiary)" />
                                    <input
                                        id="case-filter-search"
                                        ref={searchInputRef}
                                        type="text"
                                        value={query}
                                        onChange={(event) => setQuery(event.target.value)}
                                        placeholder="Escribe para filtrar expedientes..."
                                        className="w-full rounded-2xl border border-(--border-default) bg-(--bg-input) py-3 pl-9 pr-4 text-sm text-(--text-primary) outline-none focus:border-blue-500"
                                    />
                                </div>
                            </div>

                            <label className="inline-flex items-center gap-2 rounded-2xl border border-(--border-default) bg-(--bg-input) px-4 py-3 text-sm text-(--text-primary)">
                                <input
                                    type="checkbox"
                                    checked={includeClosedCases}
                                    onChange={(event) => onIncludeClosedCasesChange(event.target.checked)}
                                    className="h-4 w-4 rounded border-(--border-default) text-blue-600 focus:ring-blue-500"
                                />
                                <span>Incluir casos finalizados</span>
                            </label>
                        </div>

                        <div className="overflow-hidden rounded-[24px] border border-(--border-default) bg-(--bg-input)">
                            <div className="border-b border-(--border-subtle) px-4 py-3 text-xs font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">
                                Selector de casos
                            </div>
                            <div className="max-h-[360px] overflow-y-auto p-2">
                                <OptionRow
                                    label="Todos los casos"
                                    caption={includeClosedCases ? 'Abiertos, personales y finalizados' : 'Abiertos y personales'}
                                    selected={caseMode === 'all'}
                                    onSelect={handleSelectAll}
                                />
                                <OptionRow
                                    label="Personal (sin caso)"
                                    caption="Solo documentos sin expediente asociado"
                                    selected={caseMode === 'personal'}
                                    onSelect={handleSelectPersonal}
                                />

                                <div className="my-2 border-t border-(--border-subtle)" />

                                {loadingClosedCases && includeClosedCases && (
                                    <p className="px-3 py-2 text-sm text-(--text-secondary)">Cargando casos finalizados...</p>
                                )}

                                {filteredCases.length > 0 ? (
                                    filteredCases.map((caseItem) => {
                                        const lifecycle = getCaseLifecycle(caseItem);
                                        return (
                                            <OptionRow
                                                key={caseItem.id}
                                                label={caseItem.title || `Caso #${caseItem.id}`}
                                                caption={lifecycle === 'closed' ? 'Finalizado' : 'Activo'}
                                                selected={caseMode === 'specific' && selectedCaseId === String(caseItem.id)}
                                                onSelect={() => handleSelectCase(String(caseItem.id))}
                                                badge={lifecycle === 'closed' ? 'Finalizado' : 'Activo'}
                                                icon={<BriefcaseBusiness className="h-4 w-4" />}
                                            />
                                        );
                                    })
                                ) : (
                                    <p className="px-3 py-4 text-sm text-(--text-secondary)">No se encontraron casos.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </Dialog.Content>
            </Dialog.Portal>
        </Dialog.Root>
    );
};

const OptionRow = ({ label, caption, selected, onSelect, badge, icon = null }) => (
    <button
        type="button"
        onClick={onSelect}
        className={`mb-1 flex w-full items-center justify-between rounded-2xl px-3 py-3 text-left transition-colors ${selected ? 'bg-blue-50 text-blue-700' : 'text-(--text-primary) hover:bg-(--bg-card-hover)'}`}
    >
        <div className="flex min-w-0 items-start gap-3">
            <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${selected ? 'bg-blue-100' : 'bg-(--bg-card)'}`}>
                {icon}
            </div>
            <div className="min-w-0">
                <p className="truncate text-sm font-medium">{label}</p>
                <p className="text-xs text-(--text-secondary)">{caption}</p>
            </div>
        </div>

        <div className="flex items-center gap-2 pl-4">
            {badge && (
                <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] ${badge === 'Finalizado' ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'}`}>
                    {badge}
                </span>
            )}
            {selected && <Check className="h-4 w-4" />}
        </div>
    </button>
);

export default DocumentCaseFilterDialog;
