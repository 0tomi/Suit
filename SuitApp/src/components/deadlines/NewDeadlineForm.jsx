import { useMemo, useReducer, useState } from 'react';
import { useCases } from '../../context/CasesContext';
import { createDeadline, updateDeadline, getDeadlineActionErrorMessage } from '../../services/deadlineService';
import { showAppToast } from '../ui/show-app-toast';
import FilterAutosuggest from '../ui/FilterAutosuggest';
import NotificationConfigSection from '../Agenda/NotificationConfigSection.jsx';
import { toMinutes } from '../../utils/notificationTimeFormat.js';
import { createLogger } from '../../services/logService.js';
const logger = createLogger('new-deadline-form');

function createInitialDeadlineState(initialData, caseIdPreselected) {
    const initialDateStr = initialData?.due_date || '';
    let initialDate = '';
    let initialTime = '';
    if (initialDateStr && initialDateStr.includes('T')) {
        const [d, t] = initialDateStr.split('T');
        initialDate = d;
        initialTime = t.substring(0, 5);
    } else if (initialDateStr && initialDateStr.includes(' ')) {
        const [d, t] = initialDateStr.split(' ');
        initialDate = d;
        initialTime = t.substring(0, 5);
    } else {
        initialDate = initialDateStr.substring(0, 10);
    }

    return {
        formData: {
            title: initialData?.title || '',
            description: initialData?.description || '',
            due_date: initialDate,
            due_time: initialTime,
            priority: initialData?.priority || 'Normal',
            suit_case_id: initialData?.suit_case_id || caseIdPreselected || '',
        },
        notification: {
            enabled: Boolean(initialData?.notify_at),
            mode: 'preset',
            presetMinutes: 60,
            customAmount: '',
            customUnit: 'minutes',
        },
    };
}

/**
 * Centraliza los cambios del formulario para evitar varios estados sueltos
 * que siempre viajan juntos entre create y edit.
 */
function deadlineFormReducer(state, action) {
    switch (action.type) {
        case 'set-form-field':
            return {
                ...state,
                formData: {
                    ...state.formData,
                    [action.field]: action.value,
                },
            };
        case 'set-notification-field':
            return {
                ...state,
                notification: {
                    ...state.notification,
                    [action.field]: action.value,
                },
            };
        default:
            return state;
    }
}

/**
 * Formulario para crear/editar vencimientos.
 * Alineado con la API real de /vencimientos: usa suit_case_id, description, notify_at.
 * Reutiliza NotificationConfigSection de la Agenda para la configuración de notificaciones.
 */
export default function NewDeadlineForm({
    initialData,
    onSuccess,
    openDialog,
    closeDialog,
    caseIdPreselected,
}) {
    const { cases } = useCases();
    const [loading, setLoading] = useState(false);
    const [formState, dispatch] = useReducer(
        deadlineFormReducer,
        createInitialDeadlineState(initialData, caseIdPreselected),
    );
    const { formData, notification } = formState;
    const {
        enabled: notifEnabled,
        mode: notifMode,
        presetMinutes: notifPresetMinutes,
        customAmount: notifCustomAmount,
        customUnit: notifCustomUnit,
    } = notification;

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);

        try {
            let notifyAt = null;
            
            // Si el usuario proporcionó una hora, la usamos; de lo contrario, fin del día.
            const dueTimeStr = formData.due_time || '23:59:59';
            const finalDueDateObj = new Date(`${formData.due_date}T${dueTimeStr.includes(':') && dueTimeStr.length <= 5 ? dueTimeStr + ':00' : dueTimeStr}`);
            const finalDueDateStr = formData.due_time ? `${formData.due_date} ${formData.due_time}:00` : formData.due_date;

            if (notifEnabled && formData.due_date) {
                const minutes = notifMode === 'preset'
                    ? notifPresetMinutes
                    : toMinutes(notifCustomAmount, notifCustomUnit);

                if (minutes) {
                    notifyAt = new Date(finalDueDateObj.getTime() - minutes * 60 * 1000).toISOString();
                }
            }

            const payload = {
                title: formData.title,
                description: formData.description || null,
                due_date: finalDueDateStr,
                priority: formData.priority,
                suit_case_id: formData.suit_case_id || null,
                notify_at: notifyAt,
            };

            if (initialData) {
                const res = await updateDeadline(initialData.id, payload);
                if (!res.ok) {
                    const msg = getDeadlineActionErrorMessage(res, 'Error al actualizar');
                    throw new Error(msg);
                }
                showAppToast({ title: 'Éxito', description: 'Vencimiento actualizado', variant: 'success' });
            } else {
                const res = await createDeadline(payload);
                if (!res.ok) {
                    const msg = getDeadlineActionErrorMessage(res, 'Error al crear');
                    throw new Error(msg);
                }
                showAppToast({ title: 'Éxito', description: 'Vencimiento creado', variant: 'success' });
            }

            if (onSuccess) onSuccess();
        } catch (err) {
            void logger.error('No se pudo crear el vencimiento', err);
            openDialog({
                title: 'Error',
                desc: err.message,
                type: 'danger',
                onConfirm: closeDialog,
            });
        } finally {
            setLoading(false);
        }
    };

    const caseOptions = useMemo(
        () => [
            { value: '', label: '— Ninguno (agenda personal)' },
            ...(cases || []).map((c) => ({ value: String(c.id), label: c.title || `Caso #${c.id}` })),
        ],
        [cases]
    );

    return (
        <form id="new-deadline-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
            {/* Título */}
            <div>
                <label htmlFor="deadline-title" className="block text-sm font-medium mb-1 text-(--text-primary)">Título *</label>
                <input
                    id="deadline-title"
                    type="text"
                    required
                    className="w-full p-2.5 border border-(--border-default) rounded-lg bg-(--bg-card) text-(--text-primary)"
                    value={formData.title}
                    onChange={(e) => dispatch({ type: 'set-form-field', field: 'title', value: e.target.value })}
                />
            </div>

            {/* Fecha límite + prioridad */}
            <div className="grid grid-cols-2 gap-4">
                <div className="flex gap-2">
                    <div className="flex-1">
                        <label htmlFor="deadline-due-date" className="block text-sm font-medium mb-1 text-(--text-primary)">Fecha Límite *</label>
                        <input
                            id="deadline-due-date"
                            type="date"
                            required
                            className="w-full p-2.5 border border-(--border-default) rounded-lg bg-(--bg-card) text-(--text-primary)"
                            value={formData.due_date}
                            onChange={(e) => dispatch({ type: 'set-form-field', field: 'due_date', value: e.target.value })}
                        />
                    </div>
                    <div className="w-1/3">
                        <label htmlFor="deadline-due-time" className="block text-sm font-medium mb-1 text-(--text-primary)">Hora</label>
                        <input
                            id="deadline-due-time"
                            type="time"
                            lang="en-GB"
                            className="w-full p-2.5 border border-(--border-default) rounded-lg bg-(--bg-card) text-(--text-primary)"
                            value={formData.due_time}
                            onChange={(e) => dispatch({ type: 'set-form-field', field: 'due_time', value: e.target.value })}
                        />
                    </div>
                </div>
                <div>
                    <label htmlFor="deadline-priority" className="block text-sm font-medium mb-1 text-(--text-primary)">Prioridad</label>
                    <select
                        id="deadline-priority"
                        className="w-full p-2.5 border border-(--border-default) rounded-lg bg-(--bg-card) text-(--text-primary)"
                        value={formData.priority}
                        onChange={(e) => dispatch({ type: 'set-form-field', field: 'priority', value: e.target.value })}
                    >
                        <option value="Normal">Normal</option>
                        <option value="Urgente">Urgente</option>
                    </select>
                </div>
            </div>

            {/* Descripción */}
            <div>
                <label htmlFor="deadline-description" className="block text-sm font-medium mb-1 text-(--text-primary)">Descripción</label>
                <textarea
                    id="deadline-description"
                    rows={2}
                    className="w-full p-2.5 border border-(--border-default) rounded-lg bg-(--bg-card) text-(--text-primary)"
                    value={formData.description}
                    onChange={(e) => dispatch({ type: 'set-form-field', field: 'description', value: e.target.value })}
                />
            </div>

            {/* Caso asociado */}
            <FilterAutosuggest
                label="Caso asociado"
                placeholder="Buscar caso..."
                options={caseOptions}
                value={formData.suit_case_id}
                onChange={(val) => dispatch({ type: 'set-form-field', field: 'suit_case_id', value: val })}
                onClear={() => dispatch({ type: 'set-form-field', field: 'suit_case_id', value: '' })}
                emptyMessage="No se encontraron casos"
            />

            {/* Notificación — reutiliza el componente de la Agenda */}
            <div className="pt-1">
                <NotificationConfigSection
                    title="Notificación"
                    enabled={notifEnabled}
                    onEnabledChange={(value) => dispatch({ type: 'set-notification-field', field: 'enabled', value })}
                    mode={notifMode}
                    onModeChange={(value) => dispatch({ type: 'set-notification-field', field: 'mode', value })}
                    presetMinutes={notifPresetMinutes}
                    onPresetMinutesChange={(value) => dispatch({ type: 'set-notification-field', field: 'presetMinutes', value })}
                    customAmount={notifCustomAmount}
                    onCustomAmountChange={(value) => dispatch({ type: 'set-notification-field', field: 'customAmount', value })}
                    customUnit={notifCustomUnit}
                    onCustomUnitChange={(value) => dispatch({ type: 'set-notification-field', field: 'customUnit', value })}
                    showToggle
                    allowOffOption
                />
            </div>

            {loading && <p className="text-sm text-blue-600">Guardando...</p>}
        </form>
    );
}
