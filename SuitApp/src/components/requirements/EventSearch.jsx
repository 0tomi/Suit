import { useMemo, useState, useEffect } from 'react';
import { useEvents } from '../../context/EventsContext';
import { useCaseTypes } from '../../context/CaseTypesContext';
import { useEventTypes } from '../../context/EventTypesContext';
import FilterAutosuggest from '../ui/FilterAutosuggest';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { Label } from '../ui/Label';

export function EventSearch({ value, onChange, onFocus, onBlur }) {
    const { agendas, initialized: eventsInitialized } = useEvents();
    const { data: caseTypes = [], initialized: caseTypesInitialized } = useCaseTypes();
    const { data: eventTypes = [], initialized: eventTypesInitialized } = useEventTypes();
    
    const [searchQuery, setSearchQuery] = useState('');
    const [fueroId, setFueroId] = useState(null);
    const [eventTypeId, setEventTypeId] = useState(null);
    const [agendaId, setAgendaId] = useState(null);
    const [searchedEvents, setSearchedEvents] = useState([]);

    useEffect(() => {
        async function fetchEvents() {
            if (!searchQuery && !fueroId && !eventTypeId && !agendaId) {
                setSearchedEvents([]);
                return;
            }

            const results = await window.electronAPI.db.searchEvents({
                query: searchQuery,
                fueroId,
                eventTypeId,
                agendaId,
            });
            setSearchedEvents(results);
        }
        fetchEvents();
    }, [searchQuery, fueroId, eventTypeId, agendaId]);

    const eventOptions = useMemo(() => {
        return searchedEvents.map((event) => ({
            value: event.id,
            label: `${event.evento} (${event.casetype || 'General'})`,
        }));
    }, [searchedEvents]);

    const agendaOptions = useMemo(() => {
        if (!eventsInitialized || !Array.isArray(agendas)) return [];
        return agendas.map((ag) => ({ value: ag.id, label: ag.name }));
    }, [agendas, eventsInitialized]);

    const caseTypeOptions = useMemo(() => {
        if (!caseTypesInitialized || !Array.isArray(caseTypes)) return [];
        return caseTypes.map((ct) => ({ value: ct.id, label: ct.name }));
    }, [caseTypes, caseTypesInitialized]);

    const eventTypeOptions = useMemo(() => {
        if (!eventTypesInitialized || !Array.isArray(eventTypes)) return [];
        return eventTypes.map((et) => ({ value: et.id, label: et.name }));
    }, [eventTypes, eventTypesInitialized]);

    const handleChange = (id, option) => {
        onChange(id, option?.object || null);
    };

    const handleClear = () => {
        onChange(null, null);
    };

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-4">
                <div>
                    <Label>Fuero</Label>
                    <Select value={fueroId} onValueChange={setFueroId}>
                        <SelectTrigger onFocus={() => onFocus('caseType')} onBlur={onBlur}><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                            {caseTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Tipo de Evento</Label>
                    <Select value={eventTypeId} onValueChange={setEventTypeId}>
                        <SelectTrigger onFocus={() => onFocus('eventType')} onBlur={onBlur}><SelectValue placeholder="Todos" /></SelectTrigger>
                        <SelectContent>
                            {eventTypeOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div>
                    <Label>Agenda</Label>
                    <Select value={agendaId} onValueChange={setAgendaId}>
                        <SelectTrigger onFocus={() => onFocus('eventName')} onBlur={onBlur}><SelectValue placeholder="Todas" /></SelectTrigger>
                        <SelectContent>
                            {agendaOptions.map(opt => <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <FilterAutosuggest
                label="Evento"
                placeholder="Buscar evento..."
                value={value}
                options={eventOptions}
                onChange={handleChange}
                onClear={handleClear}
                onFocus={() => onFocus('eventName')}
                onBlur={onBlur}
                onQueryChange={setSearchQuery}
                emptyMessage="No se encontraron eventos."
            />
        </div>
    );
}
