import { useMemo } from 'react';
import { Loader2, Save, X } from 'lucide-react';
import { useEventTypes } from '../../context/EventTypesContext';
import AgendaEventDeleteDialog from './AgendaEventDeleteDialog.jsx';
import AgendaEventFormBody from './AgendaEventFormBody.jsx';
import { splitVisibleAgendas } from '../../utils/agenda/visibleAgendas.js';

const EMPTY_USERS = [];

const AgendaEventModal = ({
    modalOpen,
    setModalOpen,
    selectedEvent,
    formData,
    setFormData,
    saving,
    agendas,
    cases,
    user,
    users = EMPTY_USERS,
    handleSave,
    handleDelete,
    setNotificationEnabled,
    setNotificationMode,
    setNotificationPresetMinutes,
    setNotificationCustomAmount,
    setNotificationCustomUnit,
    error = null,
    onDismissError,
}) => {
    const { event_types } = useEventTypes();
    const selectableEventTypes = useMemo(() => {
        return (event_types || []).filter((type) => {
            const isVencimiento = String(type.id) === '2';
            // Si no es vencimiento, lo mostramos siempre.
            // Si es vencimiento, solo lo mostramos si ya es el tipo seleccionado en el formulario.
            return !isVencimiento || String(formData.eventTypeId) === '2';
        });
    }, [event_types, formData.eventTypeId]);
    const agendasById = useMemo(
        () => new Map((agendas || []).map((agenda) => [String(agenda.id), agenda])),
        [agendas],
    );

    const { personalAgendas, caseAgendas, inactiveSelectedAgenda } = useMemo(() => {
        const { personalAgendas: personal, caseAgendas: activeCaseAgendas, visibleAgendaIds } = splitVisibleAgendas(agendas, cases);

        const selectedAgenda = agendas.find((agenda) => String(agenda.id) === String(formData.agendaId));
        const selectedIsVisible = visibleAgendaIds.has(String(formData.agendaId));

        return {
            personalAgendas: personal,
            caseAgendas: activeCaseAgendas,
            inactiveSelectedAgenda: selectedAgenda && !selectedIsVisible ? selectedAgenda : null,
        };
    }, [agendas, cases, formData.agendaId]);

    const handleAgendaChange = (agendaId) => {
        const agenda = agendasById.get(String(agendaId));
        const nextCaseId = agenda?.suit_case_id ? String(agenda.suit_case_id) : '';

        setFormData({
            ...formData,
            agendaId,
            caseId: nextCaseId,
        });
    };

    if (!modalOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50">
                    <h2 className="text-lg font-semibold text-gray-800">
                        {selectedEvent ? 'Editar Evento' : 'Nuevo Evento'}
                    </h2>
                    <button onClick={() => setModalOpen(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                        <X size={20} />
                    </button>
                </div>

                {/* Inline error banner — visible inside the modal when saving fails */}
                {error && (
                    <div className="mx-6 mt-4 flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
                        <span className="flex-1">{error}</span>
                        {onDismissError && (
                            <button onClick={onDismissError} className="ml-2 text-red-400 hover:text-red-600 transition-colors">
                                <X size={16} />
                            </button>
                        )}
                    </div>
                )}

                <AgendaEventFormBody
                    formData={formData}
                    setFormData={setFormData}
                    saving={saving}
                    user={user}
                    users={users}
                    eventTypes={selectableEventTypes}
                    personalAgendas={personalAgendas}
                    caseAgendas={caseAgendas}
                    inactiveSelectedAgenda={inactiveSelectedAgenda}
                    onAgendaChange={handleAgendaChange}
                    setNotificationEnabled={setNotificationEnabled}
                    setNotificationMode={setNotificationMode}
                    setNotificationPresetMinutes={setNotificationPresetMinutes}
                    setNotificationCustomAmount={setNotificationCustomAmount}
                    setNotificationCustomUnit={setNotificationCustomUnit}
                />

                <div className={`px-6 py-4 bg-gray-50 flex items-center border-t border-gray-100 ${selectedEvent ? 'justify-between' : 'justify-center'}`}>
                    {selectedEvent && (
                        <AgendaEventDeleteDialog
                            saving={saving}
                            handleDelete={handleDelete}
                        />
                    )}
                    <button
                        onClick={handleSave}
                        disabled={saving || !formData.title || !formData.date || !formData.agendaId}
                        className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium shadow-sm transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {saving ? <Loader2 size={16} className="animate-spin" /> : <Save size={16} />}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
};

export default AgendaEventModal;
