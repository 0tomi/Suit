import { ChevronLeft, ChevronRight } from 'lucide-react';

const MONTHS = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

/**
 * Selector de mes/año con flechas de navegación.
 * Reutilizable para cualquier sección con datos mes-scoped (Vencimientos, etc.).
 *
 * @param {number} month - Mes actual (1-12)
 * @param {number} year - Año actual
 * @param {(month: number, year: number) => void} onChange - Callback al cambiar
 */
export function MonthYearSelector({ month, year, onChange }) {
    const handlePrev = () => {
        if (month === 1) {
            onChange(12, year - 1);
        } else {
            onChange(month - 1, year);
        }
    };

    const handleNext = () => {
        if (month === 12) {
            onChange(1, year + 1);
        } else {
            onChange(month + 1, year);
        }
    };

    return (
        <div className="flex items-center gap-2">
            <button
                type="button"
                onClick={handlePrev}
                className="p-1.5 rounded-lg text-(--text-secondary) hover:bg-(--bg-card-hover) hover:text-(--text-primary) transition-colors"
                aria-label="Mes anterior"
            >
                <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm font-semibold text-(--text-primary) min-w-[140px] text-center">
                {MONTHS[month - 1]} {year}
            </span>
            <button
                type="button"
                onClick={handleNext}
                className="p-1.5 rounded-lg text-(--text-secondary) hover:bg-(--bg-card-hover) hover:text-(--text-primary) transition-colors"
                aria-label="Mes siguiente"
            >
                <ChevronRight className="h-4 w-4" />
            </button>
        </div>
    );
}
