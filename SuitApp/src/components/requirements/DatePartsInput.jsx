import { DatePicker } from '../ui/DatePicker';
import { Label } from '../ui/Label';

/**
 * DatePartsInput — Selector de fecha para tipos de partes de fecha.
 *
 * Muestra un único DatePicker. El motor de plantillas (`templateFillerService`)
 * deriva automáticamente las partes necesarias (año, mes, día) en formato
 * nombrado o numérico según el tipo de cada requisito:
 *   anioNombrado, mesNombrado, diaNombrado → texto en español
 *   anioNumero, mesNumero, diaNumero      → número directo
 *
 * El modal inteligente (UseTemplateModal) se encarga de agrupar los campos
 * de fecha por NEntidad y llamar a este componente por cada grupo.
 *
 * Props:
 *   value       — Date | null: fecha seleccionada
 *   onChange    — (date: Date | null) => void
 *   onFocus     — () => void (opcional)
 *   onBlur      — () => void (opcional)
 *   label       — string (opcional, por defecto "Fecha")
 */
export function DatePartsInput({ value, onChange, onFocus, onBlur, label = 'Fecha' }) {
    return (
        <div>
            <Label>{label}</Label>
            <DatePicker
                date={value}
                onDateChange={onChange}
                onFocus={onFocus}
                onBlur={onBlur}
            />
        </div>
    );
}
