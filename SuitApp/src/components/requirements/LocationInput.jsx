import { Input } from '../ui/Input';
import { Label } from '../ui/Label';

export function LocationInput({ show, values, onChange, onFocus, onBlur }) {
    return (
        <div className="space-y-4">
            {show.city && (
                <div>
                    <Label htmlFor="city-input">Ciudad</Label>
                    <Input
                        id="city-input"
                        type="text"
                        value={values.city || ''}
                        onChange={(e) => onChange('city', e.target.value)}
                        onFocus={() => onFocus('city')}
                        onBlur={onBlur}
                    />
                </div>
            )}
            {show.province && (
                <div>
                    <Label htmlFor="province-input">Provincia</Label>
                    <Input
                        id="province-input"
                        type="text"
                        value={values.province || ''}
                        onChange={(e) => onChange('province', e.target.value)}
                        onFocus={() => onFocus('province')}
                        onBlur={onBlur}
                    />
                </div>
            )}
            {show.address && (
                <div>
                    <Label htmlFor="address-input">Dirección</Label>
                    <Input
                        id="address-input"
                        type="text"
                        value={values.address || ''}
                        onChange={(e) => onChange('address', e.target.value)}
                        onFocus={() => onFocus('address')}
                        onBlur={onBlur}
                    />
                </div>
            )}
        </div>
    );
}
