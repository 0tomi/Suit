/**
 * Selector de fecha.
 * Usa input HTML nativo type="date" para máxima compatibilidad con Electron.
 */
export function DatePicker({ date, onDateChange, ...props }) {
    const toInputValue = (d) => {
        if (!d) return '';
        // Formatea a YYYY-MM-DD sin desfase de timezone
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
    };

    const handleChange = (e) => {
        const val = e.target.value;
        onDateChange(val ? new Date(val + 'T00:00:00') : null);
    };

    const inputClass =
        'rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

    return (
        <input
            type="date"
            className={inputClass}
            value={toInputValue(date)}
            onChange={handleChange}
            {...props}
        />
    );
}
