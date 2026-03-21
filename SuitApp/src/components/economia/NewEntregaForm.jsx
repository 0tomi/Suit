import { useState, useReducer, useMemo } from 'react';
import { useTipoPagos } from '../../context/TipoPagosContext';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
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
    const [status, setStatus] = useState(null); // { type: 'success' | 'danger', message: string }

    const totalEntregado = useMemo(() => {
        return (entregas || []).reduce((acc, curr) => acc + Number(curr.monto || 0), 0);
    }, [entregas]);

    const handleFieldChange = (field) => (e) => {
        if (status) setStatus(null);
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
            setStatus({ type: 'danger', message: 'El monto debe ser mayor a cero.' });
            return;
        }

        if (honorario && honorario.monto) {
            const maxPermitido = Number(honorario.monto) - totalEntregado;
            // Usamos un pequeño margen para errores de punto flotante si es necesario,
            // pero con honorarios legales usualmente 2 decimales es suficiente.
            if (monto > (maxPermitido + 0.01)) {
                 setStatus({ 
                    type: 'danger', 
                    message: `El monto excede el saldo pendiente. Máximo permitido: $${maxPermitido.toFixed(2)}` 
                });
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
                setStatus({ type: 'success', message: 'Entrega creada correctamente.' });
                dispatch({ type: 'RESET' });
                // Limpiar mensaje de éxito después de 3 segundos
                setTimeout(() => setStatus(null), 3000);
            } else {
                setStatus({ type: 'danger', message: getApiErrorMessage(result, 'No se pudo crear la entrega.') });
            }
        } catch (err) {
            logger.error('Error creating entrega', err);
            setStatus({ type: 'danger', message: 'Ocurrió un error al contactar al servidor.' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="mb-6">
            <form onSubmit={handleSubmit} className="p-4 border border-gray-100 rounded-lg bg-gray-50 flex flex-wrap gap-4 items-end" noValidate>
                {status && (
                    <div className={`w-full p-3 rounded-md text-sm mb-2 border ${
                        status.type === 'success' 
                            ? 'bg-green-50 border-green-200 text-green-700' 
                            : 'bg-red-50 border-red-200 text-red-700'
                    }`}>
                        {status.message}
                    </div>
                )}
                <div className="flex-1 min-w-[150px]">
                    <Label htmlFor="monto">Monto</Label>
                    <Input id="monto" type="number" step="0.01" min="0.01" max={honorario?.monto ? (Number(honorario.monto) - totalEntregado).toFixed(2) : undefined} value={form.monto} onChange={handleFieldChange('monto')} required />
                </div>
                <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="tipo_pago_id">Tipo de Pago</Label>
                    <Select onValueChange={handleSelectChange('tipo_pago_id')} value={form.tipo_pago_id}>
                        <SelectTrigger id="tipo_pago_id"><SelectValue placeholder="Seleccionar..." /></SelectTrigger>
                        <SelectContent>
                            {tipoPagos.map(tp => (
                                <SelectItem key={tp.id} value={String(tp.id)}>{tp.name}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
                <div className="flex-1 min-w-[200px]">
                    <Label htmlFor="nota">Nota (opcional)</Label>
                    <Input id="nota" type="text" value={form.nota} onChange={handleFieldChange('nota')} />
                </div>
                <div>
                    <Button type="submit" disabled={loading} className="h-10">
                        {loading ? 'Creando...' : 'Añadir Entrega'}
                    </Button>
                </div>
            </form>

            {honorario && (
                <div className="mt-4 px-6 py-4 bg-blue-50 border border-blue-100 rounded-xl text-sm flex flex-wrap justify-center gap-x-8 gap-y-3 text-blue-900 shadow-sm transition-all">
                    <div className="transition-all hover:scale-105"><span className="font-bold opacity-75">ID de Honorario:</span> {honorario.id}</div>
                    <div className="transition-all hover:scale-105"><span className="font-bold opacity-75">Monto Total:</span> ${Number(honorario.monto).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="transition-all hover:scale-105"><span className="font-bold opacity-75">Total Entregado:</span> ${totalEntregado.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                    <div className="transition-all hover:scale-105"><span className="font-bold opacity-75 text-amber-700">Saldo Pendiente:</span> <span className="font-black text-amber-800">${(Number(honorario.monto) - totalEntregado).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span></div>
                    {honorario.detalles && <div className="w-full text-center border-t border-blue-100/50 pt-2 italic opacity-80"><span className="font-bold not-italic opacity-100">Nota:</span> {honorario.detalles}</div>}
                </div>
            )}
        </div>
    );
}
