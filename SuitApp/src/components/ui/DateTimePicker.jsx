/**
 * Selector de fecha y hora.
 * Usa input HTML nativo type="datetime-local" para máxima compatibilidad con Electron.
 */
export function DateTimePicker({ date, onDateChange, ...props }) {
    const toInputValue = (d) => {
        if (!d) return '';
        // Formatea a YYYY-MM-DDTHH:mm sin desfase de timezone
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    const handleChange = (e) => {
        const val = e.target.value;
        onDateChange(val ? new Date(val) : null);
    };

    const inputClass =
        'rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500 transition-colors';

    return (
        <input
            type="datetime-local"
            className={inputClass}
            value={toInputValue(date)}
            onChange={handleChange}
            {...props}
        />
    );
}
