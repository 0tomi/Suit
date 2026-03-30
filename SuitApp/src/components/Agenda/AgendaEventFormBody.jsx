import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { AlignLeft, Briefcase, Calendar as CalendarIcon, Clock, Loader2, Tag } from 'lucide-react';
import NotificationConfigSection from './NotificationConfigSection.jsx';
import { getPersonalAgendaLabel } from '../../utils/agenda/personalAgendaLabel.js';

const EMPTY_USERS = [];

const AgendaEventFormBody = ({
    formData,
    setFormData,
    saving,
    user,
    users = EMPTY_USERS,
    eventTypes,
    personalAgendas,
    caseAgendas,
    inactiveSelectedAgenda,
    onAgendaChange,
    setNotificationEnabled,
    setNotificationMode,
    setNotificationPresetMinutes,
    setNotificationCustomAmount,
    setNotificationCustomUnit,
}) => {
    const formId = useId();
    const titleInputRef = useRef(null);
    const [titleTouched, setTitleTouched] = useState(false);
    const [skipDescription, setSkipDescription] = useState(false);
    const usersById = useMemo(
        () => new Map((users || []).map((entry) => [String(entry.id), entry])),
        [users],
    );

    useEffect(() => {
        titleInputRef.current?.focus();
    }, []);

    return (
        <div className="p-6 space-y-4">
            <div>
                <label htmlFor={`${formId}-title`} className="block text-sm font-medium text-(--text-secondary) mb-1">
                    Título <span className="text-red-500">*</span>
                </label>
                <input
                    id={`${formId}-title`}
                    ref={titleInputRef}
                    type="text"
                    className={`w-full px-3 py-2 border rounded-lg bg-(--bg-input) text-(--text-primary) focus:ring-2 outline-none transition-all ${
                        titleTouched && !formData.title
                            ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                            : 'border-(--border-default) focus:ring-blue-500 focus:border-blue-500'
                    }`}
                    placeholder="Ej: Audiencia..."
                    value={formData.title}
                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                    onBlur={() => setTitleTouched(true)}
                />
                {titleTouched && !formData.title && (
                    <p className="mt-1 text-xs text-red-500">El título es obligatorio</p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`${formId}-date`} className="block text-sm font-medium text-(--text-secondary) mb-1 flex items-center gap-1">
                        <CalendarIcon size={14} /> Fecha
                    </label>
                    <input
                        id={`${formId}-date`}
                        type="date"
                        className="w-full px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.date}
                        onChange={e => setFormData({ ...formData, date: e.target.value })}
                    />
                </div>
                <div>
                    <label htmlFor={`${formId}-time`} className="block text-sm font-medium text-(--text-secondary) mb-1 flex items-center gap-1">
                        <Clock size={14} /> Hora
                    </label>
                    <input
                        id={`${formId}-time`}
                        data-testid="agenda-event-time-input"
                        type="time"
                        lang="en-GB"
                        className="w-full px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                        value={formData.time}
                        onChange={e => setFormData({ ...formData, time: e.target.value })}
                    />
                    <p className="text-xs text-(--text-tertiary) mt-0.5">Dejar vacío = todo el día</p>
                </div>
            </div>

            <div>
                <div className="flex items-center justify-between mb-1">
                    <label htmlFor={`${formId}-description`} className="block text-sm font-medium text-(--text-secondary) flex items-center gap-1">
                        <AlignLeft size={14} /> Descripción
                    </label>
                    <label className="flex items-center gap-1.5 cursor-pointer select-none text-xs text-(--text-secondary)">
                        <input
                            type="checkbox"
                            className="accent-blue-600"
                            checked={skipDescription}
                            onChange={(e) => {
                                const shouldSkip = e.target.checked;
                                setSkipDescription(shouldSkip);
                                if (shouldSkip) {
                                    setFormData({ ...formData, description: '' });
                                }
                            }}
                        />
                        No incluir
                    </label>
                </div>
                <textarea
                    id={`${formId}-description`}
                    disabled={skipDescription}
                    className={`w-full px-3 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-blue-500 outline-none resize-none h-24 transition-colors ${skipDescription ? 'opacity-40 cursor-not-allowed' : ''}`}
                    placeholder="Detalles del evento..."
                    value={formData.description}
                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                />
            </div>

            <div>
                {formData.notifyLoading ? (
                    <div className="rounded-lg border border-(--border-default) p-3 flex items-center gap-2 text-sm text-(--text-secondary)">
                        <Loader2 size={14} className="animate-spin" />
                        Cargando configuración de notificación...
                    </div>
                ) : (
                    <NotificationConfigSection
                        title="Notificar"
                        enabled={!!formData.notifyEnabled}
                        onEnabledChange={setNotificationEnabled}
                        mode={formData.notifyMode}
                        onModeChange={setNotificationMode}
                        presetMinutes={formData.notifyPresetMinutes}
                        onPresetMinutesChange={setNotificationPresetMinutes}
                        customAmount={formData.notifyCustomAmount}
                        onCustomAmountChange={setNotificationCustomAmount}
                        customUnit={formData.notifyCustomUnit}
                        onCustomUnitChange={setNotificationCustomUnit}
                        showToggle
                        allowOffOption={false}
                        disabled={saving}
                    />
                )}
                {!formData.notifyLoading && formData.notifyEnabled && formData.notifyDate && formData.notifyTime && (
                    <p className="mt-2 text-xs text-(--text-tertiary)">
                        Programada para el {formData.notifyDate} a las {formData.notifyTime}.
                    </p>
                )}
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div>
                    <label htmlFor={`${formId}-agenda`} className="block text-sm font-medium text-(--text-secondary) mb-1 flex items-center gap-1">
                        <Briefcase size={14} /> Agenda
                    </label>
                    <select
                        id={`${formId}-agenda`}
                        className="w-full px-3 py-2 border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-(--bg-input) text-(--text-primary) text-sm"
                        value={formData.agendaId}
                        onChange={e => onAgendaChange(e.target.value)}
                    >
                        {personalAgendas.length > 0 && (
                            <optgroup label="Personal">
                                {personalAgendas.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {getPersonalAgendaLabel({
                                            agenda: a,
                                            currentUser: user,
                                            usersById,
                                        })}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        {caseAgendas.length > 0 && (
                            <optgroup label="Casos">
                                {caseAgendas.map(a => (
                                    <option key={a.id} value={a.id}>
                                        {a.name ? a.name.replace(/^Agenda:\s*/i, '') : `Agenda #${a.id}`}
                                    </option>
                                ))}
                            </optgroup>
                        )}
                        {inactiveSelectedAgenda && (
                            <optgroup label="Inactiva">
                                <option value={inactiveSelectedAgenda.id}>
                                    {inactiveSelectedAgenda.name ? inactiveSelectedAgenda.name.replace(/^Agenda:\s*/i, '') : `Agenda #${inactiveSelectedAgenda.id}`}
                                </option>
                            </optgroup>
                        )}
                    </select>
                </div>
                <div>
                    <label htmlFor={`${formId}-event-type`} className="block text-sm font-medium text-(--text-secondary) mb-1 flex items-center gap-1">
                        <Tag size={14} /> Tipo
                    </label>
                    <select
                        id={`${formId}-event-type`}
                        className="w-full px-3 py-2 border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 outline-none bg-(--bg-input) text-(--text-primary) text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        value={formData.eventTypeId}
                        onChange={e => setFormData({ ...formData, eventTypeId: e.target.value })}
                        disabled={saving || String(formData.eventTypeId) === '2'}
                    >
                        <option value="">Seleccionar...</option>
                        {eventTypes?.map((type) => (
                            <option key={type.id} value={type.id}>{type.name}</option>
                        ))}
                    </select>
                </div>
            </div>
        </div>
    );
};

export default AgendaEventFormBody;
