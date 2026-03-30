import { useState, useReducer, useMemo } from 'react';
import { useTipoPagos } from '../../context/TipoPagosContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { showAppToast } from '../ui/show-app-toast';
import { createLogger } from '../../services/logService';
import { getApiErrorMessage } from '../../utils/apiErrorMessage';

const logger = createLogger('NewEntregaForm');

const formInitial = {
    monto: '',
    tipo_pago_id: '',
    nota: '',
};

function formReducer(state, action) {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.payload };
        case 'RESET':
            return formInitial;
        default:
            return state;
    }
}

import PropTypes from 'prop-types';

export function NewEntregaForm({ addEntrega, honorario, entregas = [] }) {
    NewEntregaForm.propTypes = {
        addEntrega: PropTypes.func.isRequired,
        honorario: PropTypes.object,
        entregas: PropTypes.array,
    };
    const { tipo_pagos: tipoPagos } = useTipoPagos();
    const [form, dispatch] = useReducer(formReducer, formInitial);
    const [loading, setLoading] = useState(false);
    const [status, setStatus] = useState(null); // solo para advertencia dinámica de monto ajustado
    const [montoError, setMontoError] = useState('');
    const [skipNota, setSkipNota] = useState(false);

    const totalEntregado = useMemo(() => {
        return (entregas || []).reduce((acc, curr) => acc + Number(curr.monto || 0), 0);
    }, [entregas]);

    const handleFieldChange = (field) => (e) => {
        if (status) setStatus(null);
        if (field === 'monto' && montoError) setMontoError('');
        let value = e.target.value;

        // Validación dinámica para el monto: no permitir exceder el saldo restante
        if (field === 'monto' && honorario && honorario.monto) {
            const maxPermitido = Number(honorario.monto) - totalEntregado;
            if (Number(value) > maxPermitido) {
                value = maxPermitido.toFixed(2);
                setStatus({ 
                    type: 'danger', 
                    message: `El monto fue ajustado al saldo máximo pendiente ($${maxPermitido.toFixed(2)}).` 
                });
            }
        }

        dispatch({ type: 'SET_FIELD', field, payload: value });
    };

    const handleSelectChange = (field) => (value) => {
        if (status) setStatus(null);
        dispatch({ type: 'SET_FIELD', field, payload: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const monto = parseFloat(form.monto);
        if (!form.monto || monto <= 0) {
            setMontoError('El monto debe ser mayor a cero.');
            showAppToast({ title: 'Campo obligatorio', description: 'El monto debe ser mayor a cero.', variant: 'danger' });
            return;
        }

        if (honorario && honorario.monto) {
            const maxPermitido = Number(honorario.monto) - totalEntregado;
            if (monto > (maxPermitido + 0.01)) {
                const msg = `El monto excede el saldo pendiente. Máximo permitido: $${maxPermitido.toFixed(2)}`;
                setMontoError(msg);
                showAppToast({ title: 'Monto inválido', description: msg, variant: 'danger' });
                return;
            }
        }

        setLoading(true);
        try {
            const result = await addEntrega({
                monto: form.monto,
                tipo_pago_id: form.tipo_pago_id,
                nota: form.nota,
            });
            
            if (result.ok) {
                showAppToast({ title: 'Éxito', description: 'Entrega creada correctamente.', variant: 'success' });
                dispatch({ type: 'RESET' });
                setMontoError('');
                setSkipNota(false);
            } else {
                const serverMessage = getApiErrorMessage(result, 'No se pudo crear la entrega.');
                showAppToast({ title: 'Error', description: serverMessage, variant: 'danger' });
            }
        } catch (err) {
            logger.error('Error creating entrega', err);
            showAppToast({ title: 'Error de Red', description: 'Ocurrió un error al contactar al servidor.', variant: 'danger' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-6">
            <form onSubmit={handleSubmit} className="p-4 border border-(--border-subtle) rounded-lg bg-(--bg-subtle) flex flex-wrap gap-4 items-end" noValidate>
                {status && (
                    <div className={`w-full p-3 rounded-md text-sm mb-2 border ${
                        status.type === 'success' 
                            ? 'bg-(--bg-success-subtle) border-(--border-success) text-(--text-success)' 
                            : 'bg-(--bg-danger-subtle) border-(--border-danger) text-(--text-danger)'
                    }`}>
                        {status.message}
                    </div>
                )}
                <div className="flex-1 min-w-[150px]">
                    <Label htmlFor="monto">Monto <span className="text-red-500">*</span></Label>
                    <Input
                        id="monto"
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={honorario?.monto ? (Number(honorario.monto) - totalEntregado).toFixed(2) : undefined}
                        value={form.monto}
                        onChange={handleFieldChange('monto')}
                        onKeyDown={(e) => ['e', 'E'].includes(e.key) && e.preventDefault()}
                        aria-invalid={Boolean(montoError)}
                        className={montoError ? 'border-red-300 focus:ring-red-500' : ''}
                    />
                    {montoError ? <p className="mt-1 text-xs text-red-600">{montoError}</p> : null}
                </div>
                <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="tipo_pago_id">Tipo de Pago</Label>
                    <Select onValueChange={handleSelectChange('tipo_pago_id')} value={form.tipo_pago_id}>
                        <SelectTrigger id="tipo_pago_id" aria-label="Tipo de Pago"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                            {tipoPagos.map(tp => (
                                <SelectItem key={tp.id} value={String(tp.id)}>{tp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <div className="mb-1 flex items-center justify-between gap-2">
                        <Label htmlFor="nota">Nota (opcional)</Label>
                        <label className="flex items-center gap-1.5 text-xs text-(--text-tertiary) cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={skipNota}
                                onChange={(e) => {
                                    setSkipNota(e.target.checked);
                                    if (e.target.checked) {
                                        dispatch({ type: 'SET_FIELD', field: 'nota', payload: '' });
                                    }
                                }}
                                className="rounded"
                            />
                            No cargar
                        </label>
                    </div>
                    <Input id="nota" type="text" disabled={skipNota} value={form.nota} onChange={handleFieldChange('nota')} className={skipNota ? 'opacity-40 cursor-not-allowed' : ''} />
                </div>
                <div>
                    <Button type="submit" disabled={loading} className="h-10">
                        {loading ? 'Creando...' : 'Añadir Entrega'}
                    </Button>
                </div>
            </form>

            {honorario && (
                <div className="mt-4 px-6 py-4 bg-(--bg-info-subtle) border border-(--border-info) rounded-xl text-sm flex flex-wrap justify-center gap-x-8 gap-y-3 text-(--text-info) shadow-sm transition-all">
                    <div className="transition-all hover:scale-105"><span className="font-bold opacity-75">ID de Honorario:</span> {honorario.id}</div>
                    <div className="transition-all hover:scale-105"><span className="font-bold opacity-75">Monto Total:</span> ${Number(honorario.monto).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="transition-all hover:scale-105"><span className="font-bold opacity-75">Total Entregado:</span> ${totalEntregado.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="transition-all hover:scale-105"><span className="font-bold opacity-75 text-amber-600 dark:text-amber-400">Saldo Pendiente:</span> <span className="font-black text-amber-700 dark:text-amber-500">${(Number(honorario.monto) - totalEntregado).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    {honorario.detalles && <div className="w-full text-center border-t border-(--border-info) pt-2 italic opacity-80"><span className="font-bold not-italic opacity-100">Nota:</span> {honorario.detalles}</div>}
                </div>
            )}
        </div>
    );
}
