import { useState } from 'react';
import { format } from 'date-fns';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

/** Retorna la fecha de hoy en formato YYYY-MM-DD para el atributo min del input. */
function getTodayString() {
    return format(new Date(), 'yyyy-MM-dd');
}

/**
 * Modal para prorrogar un vencimiento a una nueva fecha.
 * La API solo acepta due_date; no hay campo de motivo.
 * La fecha debe ser hoy o posterior (validación client-side + min en el input).
 */
export default function PostponeModal({ isOpen, onClose, onConfirm, deadline }) {
    const [newDate, setNewDate] = useState('');
    const [newTime, setNewTime] = useState('');
    const today = getTodayString();
    const dateInputId = 'postpone-new-date';
    const timeInputId = 'postpone-new-time';

    const handleClose = () => {
        setNewDate('');
        setNewTime('');
        onClose();
    };

    const handleConfirm = () => {
        if (!newDate || newDate < today) return;
        const finalDate = newTime ? `${newDate} ${newTime}:00` : newDate;
        onConfirm(finalDate);
        setNewDate('');
        setNewTime('');
    };

    return (
        <Modal
            open={isOpen}
            onClose={handleClose}
            title="Prorrogar Vencimiento"
            maxWidth="max-w-md"
            footer={
                <Button onClick={handleConfirm} disabled={!newDate || newDate < today}>Confirmar</Button>
            }
        >
            <div className="space-y-4">
                <p className="text-sm text-(--text-secondary)">
                    Prorrogar: <span className="font-semibold text-(--text-primary)">{deadline?.title}</span>
                </p>
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label htmlFor={dateInputId} className="block text-sm font-medium mb-1 text-(--text-primary)">
                            Nueva Fecha Límite *
                        </label>
                        <input
                            id={dateInputId}
                            type="date"
                            required
                            min={today}
                            className="w-full p-2.5 border border-(--border-default) rounded-lg bg-(--bg-card) text-(--text-primary)"
                            value={newDate}
                            onChange={(e) => setNewDate(e.target.value)}
                        />
                    </div>
                    <div className="w-1/3">
                        <label htmlFor={timeInputId} className="block text-sm font-medium mb-1 text-(--text-primary)">
                            Hora
                        </label>
                        <input
                            id={timeInputId}
                            type="time"
                            lang="en-GB"
                            className="w-full p-2.5 border border-(--border-default) rounded-lg bg-(--bg-card) text-(--text-primary)"
                            value={newTime}
                            onChange={(e) => setNewTime(e.target.value)}
                        />
                    </div>
                </div>
            </div>
        </Modal>
    );
}
