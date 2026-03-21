/**
 * Selector de rango de fechas.
 * API compatible con el uso en HonorariosList/GastosList:
 *   <DateRangePicker date={{ from: Date, to: Date }} onDateChange={({ from, to }) => ...} />
 *
 * Usa inputs HTML nativos type="date" para máxima compatibilidad con Electron.
 */
export function DateRangePicker({ date, onDateChange }) {
    const toInputValue = (d) => {
        if (!d) return '';
        // Formatea a YYYY-MM-DD sin desfase de timezone
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleFrom = (e) => {
        const val = e.target.value;
        onDateChange({ ...date, from: val ? new Date(val + 'T00:00:00') : null });
    };

    const handleTo = (e) => {
        const val = e.target.value;
        onDateChange({ ...date, to: val ? new Date(val + 'T23:59:59') : null });
    };

    const inputClass =
        'rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

    return (
        <div className="flex items-center gap-2">
            <input
                type="date"
                className={inputClass}
                value={toInputValue(date?.from)}
                onChange={handleFrom}
                aria-label="Fecha desde"
            />
            <span className="text-(--text-tertiary) text-sm">—</span>
            <input
                type="date"
                className={inputClass}
                value={toInputValue(date?.to)}
                onChange={handleTo}
                aria-label="Fecha hasta"
            />
        </div>
    );
}
