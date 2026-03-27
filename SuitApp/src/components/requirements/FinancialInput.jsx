import { useMemo } from 'react';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { useTipoPagos } from '../../context/TipoPagosContext';

export function FinancialInput({ show, values, onChange, onFocus, onBlur }) {
    const { tipoPagos, initialized } = useTipoPagos();

    const paymentTypeOptions = useMemo(() => {
        if (!initialized || !Array.isArray(tipoPagos)) return [];
        return tipoPagos.map((pt) => ({ value: pt.id, label: pt.name }));
    }, [tipoPagos, initialized]);

    return (
        <div className="space-y-4">
            {show.amount && (
                <div>
                    <Label htmlFor="amount-input">Monto</Label>
                    <Input
                        id="amount-input"
                        type="number"
                        value={values.amount || ''}
                        onChange={(e) => onChange('amount', e.target.value)}
                        onFocus={() => onFocus('amount')}
                        onBlur={onBlur}
                    />
                </div>
            )}
            {show.paymentType && (
                <div>
                    <Label>Tipo de Pago</Label>
                    <Select value={values.paymentType} onValueChange={(val) => {
                        const opt = paymentTypeOptions.find(o => o.value === val);
                        onChange('paymentType', val, opt?.label);
                    }}>
                        <SelectTrigger onFocus={() => onFocus('paymentType')} onBlur={onBlur}>
                            <SelectValue placeholder="Seleccionar tipo de pago..." />
                        </SelectTrigger>
                        <SelectContent>
                            {paymentTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            )}
        </div>
    );
}
