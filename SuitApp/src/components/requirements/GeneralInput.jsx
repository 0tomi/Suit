import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { DatePicker } from '../ui/DatePicker';
import { DateTimePicker } from '../ui/DateTimePicker';

export function GeneralInput({ show, values, onChange, onFocus, onBlur }) {
    return (
        <div className="space-y-4">
            {show.text && (
                <div>
                    <Label htmlFor="text-input">Texto</Label>
                    <Input
                        id="text-input"
                        type="text"
                        value={values.text || ''}
                        onChange={(e) => onChange('text', e.target.value)}
                        onFocus={() => onFocus('text')}
                        onBlur={onBlur}
                    />
                </div>
            )}
            {show.number && (
                <div>
                    <Label htmlFor="number-input">Número</Label>
                    <Input
                        id="number-input"
                        type="number"
                        value={values.number || ''}
                        onChange={(e) => onChange('number', e.target.value)}
                        onFocus={() => onFocus('number')}
                        onBlur={onBlur}
                    />
                </div>
            )}
            {show.date && (
                <div>
                    <Label>Fecha</Label>
                    <DatePicker
                        date={values.date}
                        onDateChange={(date) => onChange('date', date)}
                        onFocus={() => onFocus('date')}
                        onBlur={onBlur}
                    />
                </div>
            )}
            {show.dateTime && (
                <div>
                    <Label>Fecha y Hora</Label>
                    <DateTimePicker
                        date={values.dateTime}
                        onDateChange={(date) => onChange('dateTime', date)}
                        onFocus={() => onFocus('dateTime')}
                        onBlur={onBlur}
                    />
                </div>
            )}
        </div>
    );
}
