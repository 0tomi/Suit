import { Input } from '../ui/Input';
import { Label } from '../ui/Label';

/** label e id son opcionales para cuando se usan múltiples instancias en el mismo formulario. */
export function CustomInput({ value, onChange, onFocus, onBlur, label = 'Valor', id = 'custom-input' }) {
    return (
        <div>
            <Label htmlFor={id}>{label}</Label>
            <Input
                id={id}
                type="text"
                value={value || ''}
                onChange={(e) => onChange(e.target.value)}
                onFocus={() => onFocus('custom')}
                onBlur={onBlur}
            />
        </div>
    );
}
