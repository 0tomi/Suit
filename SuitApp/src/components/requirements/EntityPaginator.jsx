import { ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * EntityPaginator — Navegación ← N → entre instancias de la misma entidad por NEntidad.
 * Solo se renderiza cuando hay más de una instancia (nEntidades.length > 1).
 *
 * Props:
 *   label       — Etiqueta del tipo de entidad (ej: "Cliente", "Fecha")
 *   page        — NEntidad actualmente visible (número)
 *   nEntidades  — Array ordenado de NEntidad disponibles (ej: [1, 2, 3])
 *   onPageChange — Callback (newNEntidad: number) => void
 */
export function EntityPaginator({ label, page, nEntidades, onPageChange }) {
    if (!nEntidades || nEntidades.length <= 1) return null;

    const idx = nEntidades.indexOf(page);
    const total = nEntidades.length;
    const canPrev = idx > 0;
    const canNext = idx < total - 1;

    return (
        <div className="flex items-center justify-between rounded-lg border border-(--border-default) bg-(--bg-card-hover) px-3 py-1.5">
            <button
                type="button"
                onClick={() => canPrev && onPageChange(nEntidades[idx - 1])}
                disabled={!canPrev}
                className="p-1 rounded hover:bg-(--bg-hover) disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-(--text-secondary)"
                aria-label="Anterior"
            >
                <ChevronLeft size={15} />
            </button>

            <span className="text-xs font-medium text-(--text-secondary) select-none">
                {label}{' '}
                <span className="font-bold text-(--text-primary)">{idx + 1}</span>
                <span className="text-(--text-tertiary)"> / {total}</span>
            </span>

            <button
                type="button"
                onClick={() => canNext && onPageChange(nEntidades[idx + 1])}
                disabled={!canNext}
                className="p-1 rounded hover:bg-(--bg-hover) disabled:opacity-30 disabled:cursor-not-allowed transition-colors text-(--text-secondary)"
                aria-label="Siguiente"
            >
                <ChevronRight size={15} />
            </button>
        </div>
    );
}
