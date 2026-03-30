import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState, useTransition } from 'react';
import { Loader2, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useEvents } from '../../context/EventsContext.jsx';
import { useEventTypes } from '../../context/EventTypesContext.jsx';
import { useModal } from '../../context/ModalContext.jsx';
import { useUsers } from '../../context/UsersContext.jsx';
import { getAgendaEventsByMonth } from '../../services/eventService.js';
import { createLogger } from '../../services/logService.js';
import { normalizeAgendaEvent } from '../../utils/eventNormalization.js';
import { getPersonalAgendaLabel } from '../../utils/agenda/personalAgendaLabel.js';
import { StandaloneEventModal } from '../Agenda/StandaloneEventModal.jsx';
import { MonthYearSelector } from '../ui/MonthYearSelector.jsx';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectSeparator,
    SelectTrigger,
    SelectValue,
} from '../ui/Select.jsx';
import FilterAutosuggest from '../ui/FilterAutosuggest.jsx';

const logger = createLogger('component:event-search');
const AUTO_AGENDA_VALUE = '__auto__';
const EMPTY_AUTO_TARGET = '__none__';
const EMPTY_VALUE = Object.freeze({
    agendaId: null,
    eventTypeId: null,
    event: null,
    month: null,
    year: null,
});

function toStringId(value) {
    if (value == null || value === '') return null;
    return String(value);
}

function normalizeValue(value, fallbackMonth, fallbackYear) {
    return {
        agendaId: toStringId(value?.agendaId),
        eventTypeId: toStringId(value?.eventTypeId),
        event: value?.event ?? null,
        month: Number.isFinite(Number(value?.month)) ? Number(value.month) : fallbackMonth,
        year: Number.isFinite(Number(value?.year)) ? Number(value.year) : fallbackYear,
    };
}

function formatEventDateLabel(startsAt) {
    if (!startsAt) return '';

    const normalized = String(startsAt).replace(' ', 'T');
    const date = new Date(normalized);
    if (Number.isNaN(date.getTime())) return String(startsAt);

    const hasTime = normalized.includes('T');
    return new Intl.DateTimeFormat('es-AR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        ...(hasTime ? { hour: '2-digit', minute: '2-digit' } : {}),
    }).format(date);
}

function buildEventOption(eventItem) {
    if (!eventItem?.id || !eventItem?.title) return null;

    const metadata = [
        eventItem.type ?? eventItem.tipo ?? eventItem.event_type_name ?? null,
        formatEventDateLabel(eventItem.starts_at),
    ].filter(Boolean);

    return {
        value: String(eventItem.id),
        label: metadata.length > 0
            ? `${eventItem.title} · ${metadata.join(' · ')}`
            : eventItem.title,
        object: eventItem,
    };
}

function toEventTypeOption(eventType) {
    if (!eventType?.id || !eventType?.name) return null;

    return {
        value: String(eventType.id),
        label: eventType.name,
        object: eventType,
    };
}

function sortEventsByStartDesc(events) {
    return [...events].sort((left, right) => {
        const leftTime = new Date(String(left?.starts_at ?? '').replace(' ', 'T')).getTime();
        const rightTime = new Date(String(right?.starts_at ?? '').replace(' ', 'T')).getTime();
        return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
}

function dedupeEventOptions(options, selectedOption = null) {
    const deduped = new Map();

    if (selectedOption?.value) {
        deduped.set(selectedOption.value, selectedOption);
    }

    for (const option of options) {
        if (!option?.value) continue;
        deduped.set(option.value, option);
    }

    return [...deduped.values()];
}

function readEventMonthYear(eventItem) {
    const dateValue = String(eventItem?.date ?? '').trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        return {
            year: Number(dateValue.slice(0, 4)),
            month: Number(dateValue.slice(5, 7)),
        };
    }

    const normalized = String(eventItem?.starts_at ?? '').replace(' ', 'T');
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) {
        return { year: null, month: null };
    }

    return {
        year: parsed.getFullYear(),
        month: parsed.getMonth() + 1,
    };
}

export function EventSearch({
    value = EMPTY_VALUE,
    onChange,
    defaultAgendaId = null,
    defaultCaseId = null,
    agendas: providedAgendas = null,
    eventTypes: providedEventTypes = null,
    onFocus,
    onBlur,
}) {
    const today = useMemo(() => new Date(), []);
    const fallbackMonth = today.getMonth() + 1;
    const fallbackYear = today.getFullYear();
    const normalizedValue = normalizeValue(value, fallbackMonth, fallbackYear);

    const { user } = useAuth();
    const { openModal } = useModal();
    const { agendas: cachedAgendas = [] } = useEvents();
    const { event_types: cachedEventTypes = [] } = useEventTypes();
    const { users = [] } = useUsers();
    const [caseAgendaEventTypes, setCaseAgendaEventTypes] = useState([]);
    const [caseAgendaEvents, setCaseAgendaEvents] = useState([]);
    const [personalAgendaEvents, setPersonalAgendaEvents] = useState([]);
    const [personalEventsLoading, setPersonalEventsLoading] = useState(false);
    const [caseTypesLoading, setCaseTypesLoading] = useState(false);
    const [caseEventsLoading, setCaseEventsLoading] = useState(false);
    const [personalEventsError, setPersonalEventsError] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [refreshNonce, setRefreshNonce] = useState(0);
    const [, startSearchTransition] = useTransition();
    const autoAgendaTargetRef = useRef(null);

    const agendas = useMemo(
        () => (Array.isArray(providedAgendas) ? providedAgendas : cachedAgendas),
        [cachedAgendas, providedAgendas],
    );
    const eventTypes = useMemo(
        () => (Array.isArray(providedEventTypes) ? providedEventTypes : cachedEventTypes),
        [cachedEventTypes, providedEventTypes],
    );
    const usersById = useMemo(
        () => new Map((users || []).map((entry) => [String(entry.id), entry])),
        [users],
    );
    const agendasById = useMemo(
        () => new Map((agendas || []).map((agenda) => [String(agenda.id), agenda])),
        [agendas],
    );
    const eventTypesById = useMemo(
        () => new Map((eventTypes || []).map((eventType) => [String(eventType.id), eventType])),
        [eventTypes],
    );
    const resolvedDefaultAgendaId = useMemo(() => {
        if (defaultAgendaId != null && defaultAgendaId !== '') {
            return String(defaultAgendaId);
        }

        if (defaultCaseId == null || defaultCaseId === '') {
            return null;
        }

        const matchingAgenda = agendas.find((agenda) => String(agenda?.suit_case_id ?? '') === String(defaultCaseId));
        return matchingAgenda?.id != null ? String(matchingAgenda.id) : null;
    }, [agendas, defaultAgendaId, defaultCaseId]);
    const selectedAgendaId = normalizedValue.agendaId ?? resolvedDefaultAgendaId;
    const selectedAgenda = selectedAgendaId ? agendasById.get(String(selectedAgendaId)) ?? null : null;
    const isCaseAgenda = Boolean(selectedAgenda?.suit_case_id);
    const isAutomaticAgendaSelection = normalizedValue.agendaId == null;
    const deferredSearchQuery = useDeferredValue(searchQuery.trim());
    const selectedEventId = normalizedValue.event?.id != null ? String(normalizedValue.event.id) : null;

    const normalizeSelectableEvent = useCallback((eventItem) => {
        if (!eventItem) return null;

        const normalizedEvent = normalizeAgendaEvent(eventItem, agendasById);
        return {
            ...normalizedEvent,
            type: eventTypesById.get(String(normalizedEvent.event_type_id))?.name
                ?? eventItem?.type
                ?? eventItem?.event_type_name
                ?? '',
        };
    }, [agendasById, eventTypesById]);

    const emitChange = useCallback((patch) => {
        const nextValue = {
            ...normalizedValue,
            ...patch,
        };

        onChange({
            agendaId: nextValue.agendaId ? String(nextValue.agendaId) : null,
            eventTypeId: nextValue.eventTypeId ? String(nextValue.eventTypeId) : null,
            event: nextValue.event ?? null,
            month: nextValue.month,
            year: nextValue.year,
        });
    }, [normalizedValue, onChange]);

    useEffect(() => {
        if (!isAutomaticAgendaSelection) {
            autoAgendaTargetRef.current = null;
            return;
        }

        const nextAutoTarget = selectedAgendaId ?? EMPTY_AUTO_TARGET;
        if (autoAgendaTargetRef.current === nextAutoTarget) {
            return;
        }

        autoAgendaTargetRef.current = nextAutoTarget;

        if (normalizedValue.eventTypeId == null && selectedEventId == null && searchQuery === '') {
            return;
        }

        setSearchQuery('');
        emitChange({
            eventTypeId: null,
            event: null,
        });
    }, [
        emitChange,
        isAutomaticAgendaSelection,
        normalizedValue.eventTypeId,
        searchQuery,
        selectedEventId,
        selectedAgendaId,
    ]);

    useEffect(() => {
        if (!selectedAgendaId || !isCaseAgenda || !window.electronAPI?.db?.getAgendaEventTypes) {
            setCaseAgendaEventTypes([]);
            return;
        }

        let cancelled = false;

        const loadEventTypes = async () => {
            setCaseTypesLoading(true);
            try {
                const rows = await window.electronAPI.db.getAgendaEventTypes(selectedAgendaId);
                if (cancelled) return;
                setCaseAgendaEventTypes(Array.isArray(rows) ? rows : []);
            } catch (error) {
                if (cancelled) return;
                void logger.warn('no se pudieron cargar los tipos de evento de la agenda local', {
                    agendaId: selectedAgendaId,
                    error: error?.message || String(error),
                });
                setCaseAgendaEventTypes([]);
            } finally {
                if (!cancelled) {
                    setCaseTypesLoading(false);
                }
            }
        };

        void loadEventTypes();

        return () => {
            cancelled = true;
        };
    }, [isCaseAgenda, refreshNonce, selectedAgendaId]);

    useEffect(() => {
        if (!selectedAgendaId || isCaseAgenda) {
            setPersonalAgendaEvents([]);
            setPersonalEventsError('');
            return;
        }

        let cancelled = false;

        const loadPersonalAgendaEvents = async () => {
            setPersonalEventsLoading(true);
            setPersonalEventsError('');

            try {
                const rows = await getAgendaEventsByMonth(selectedAgendaId, normalizedValue.month, normalizedValue.year);
                if (cancelled) return;

                const normalizedEvents = sortEventsByStartDesc(
                    rows.map((eventItem) => normalizeAgendaEvent(eventItem, agendasById))
                ).map((eventItem) => ({
                    ...eventItem,
                    type: eventTypesById.get(String(eventItem.event_type_id))?.name ?? '',
                }));

                setPersonalAgendaEvents(normalizedEvents);
            } catch (error) {
                if (cancelled) return;

                const message = error?.message || 'No se pudieron cargar los eventos de la agenda.';
                void logger.warn('falló la carga mensual de eventos de agenda personal', {
                    agendaId: selectedAgendaId,
                    month: normalizedValue.month,
                    year: normalizedValue.year,
                    error: message,
                });
                setPersonalAgendaEvents([]);
                setPersonalEventsError(message);
            } finally {
                if (!cancelled) {
                    setPersonalEventsLoading(false);
                }
            }
        };

        void loadPersonalAgendaEvents();

        return () => {
            cancelled = true;
        };
    }, [agendasById, eventTypesById, isCaseAgenda, normalizedValue.month, normalizedValue.year, refreshNonce, selectedAgendaId]);

    useEffect(() => {
        if (!selectedAgendaId || !isCaseAgenda || !window.electronAPI?.db?.searchEvents) {
            setCaseAgendaEvents([]);
            return;
        }

        let cancelled = false;
        setCaseAgendaEvents([]);

        const loadEvents = async () => {
            setCaseEventsLoading(true);
            try {
                const rows = await window.electronAPI.db.searchEvents({
                    agendaId: selectedAgendaId,
                    eventTypeId: normalizedValue.eventTypeId || undefined,
                    query: deferredSearchQuery || undefined,
                });

                if (cancelled) return;
                setCaseAgendaEvents(Array.isArray(rows) ? rows : []);
            } catch (error) {
                if (cancelled) return;
                void logger.warn('falló la búsqueda local de eventos para plantilla', {
                    agendaId: selectedAgendaId,
                    eventTypeId: normalizedValue.eventTypeId,
                    query: deferredSearchQuery,
                    error: error?.message || String(error),
                });
                setCaseAgendaEvents([]);
            } finally {
                if (!cancelled) {
                    setCaseEventsLoading(false);
                }
            }
        };

        void loadEvents();

        return () => {
            cancelled = true;
        };
    }, [deferredSearchQuery, isCaseAgenda, normalizedValue.eventTypeId, refreshNonce, selectedAgendaId]);

    useEffect(() => {
        if (!isAutomaticAgendaSelection || !isCaseAgenda || caseEventsLoading) return;
        if (selectedEventId || caseAgendaEvents.length === 0) return;

        const firstAvailableEvent = caseAgendaEvents[0];
        if (!firstAvailableEvent?.id) return;

        emitChange({
            event: firstAvailableEvent,
        });
    }, [
        caseAgendaEvents,
        caseEventsLoading,
        emitChange,
        isAutomaticAgendaSelection,
        isCaseAgenda,
        selectedEventId,
    ]);

    const availableEventTypeOptions = useMemo(() => {
        const source = isCaseAgenda
            ? caseAgendaEventTypes
            : [...new Set(personalAgendaEvents.map((eventItem) => String(eventItem?.event_type_id ?? '')))]
                .map((eventTypeId) => eventTypesById.get(eventTypeId))
                .filter(Boolean);

        return source
            .map(toEventTypeOption)
            .filter(Boolean);
    }, [caseAgendaEventTypes, eventTypesById, isCaseAgenda, personalAgendaEvents]);

    useEffect(() => {
        if (!normalizedValue.eventTypeId) return;

        const stillAvailable = availableEventTypeOptions.some((option) => option.value === String(normalizedValue.eventTypeId));
        if (stillAvailable) return;

        emitChange({
            eventTypeId: null,
            event: null,
        });
    }, [availableEventTypeOptions, emitChange, normalizedValue.eventTypeId]);

    const agendaGroups = useMemo(() => {
        const personalAgendas = [];
        const caseAgendas = [];

        for (const agenda of agendas || []) {
            const label = agenda?.suit_case_id
                ? (agenda?.name ? agenda.name.replace(/^Agenda:\s*/i, '') : `Agenda #${agenda.id}`)
                : getPersonalAgendaLabel({ agenda, currentUser: user, usersById });

            const option = {
                value: String(agenda.id),
                label,
                isCase: Boolean(agenda?.suit_case_id),
            };

            if (option.isCase) {
                caseAgendas.push(option);
            } else {
                personalAgendas.push(option);
            }
        }

        return {
            personal: personalAgendas,
            cases: caseAgendas,
        };
    }, [agendas, user, usersById]);

    const personalEventOptions = useMemo(() => {
        const normalizedQuery = deferredSearchQuery.toLowerCase();
        const filteredEvents = personalAgendaEvents.filter((eventItem) => {
            if (normalizedValue.eventTypeId && String(eventItem?.event_type_id ?? '') !== String(normalizedValue.eventTypeId)) {
                return false;
            }

            if (!normalizedQuery) return true;
            return String(eventItem?.title ?? '').toLowerCase().includes(normalizedQuery);
        });

        return filteredEvents
            .map(buildEventOption)
            .filter(Boolean);
    }, [deferredSearchQuery, normalizedValue.eventTypeId, personalAgendaEvents]);

    const selectedEventOption = useMemo(
        () => buildEventOption(normalizedValue.event),
        [normalizedValue.event],
    );
    const eventOptions = useMemo(() => {
        const rawOptions = (isCaseAgenda ? caseAgendaEvents : personalEventOptions)
            .map((eventItem) => isCaseAgenda ? buildEventOption(eventItem) : eventItem)
            .filter(Boolean);

        return dedupeEventOptions(rawOptions, selectedEventOption);
    }, [caseAgendaEvents, isCaseAgenda, personalEventOptions, selectedEventOption]);

    const eventsEmptyMessage = useMemo(() => {
        if (!selectedAgendaId) return 'Primero seleccioná una agenda.';
        if (caseEventsLoading || personalEventsLoading) return 'Buscando eventos...';
        if (isCaseAgenda) {
            return 'No hay eventos cacheados para esta agenda con esos filtros.';
        }
        return 'No hay eventos disponibles para el período elegido.';
    }, [caseEventsLoading, isCaseAgenda, personalEventsLoading, selectedAgendaId]);

    const helperMessage = useMemo(() => {
        if (!selectedAgendaId) {
            return isAutomaticAgendaSelection
                ? 'Automático sigue la agenda del caso cuando se seleccione uno. Si hace falta, podés elegir otra agenda manualmente.'
                : 'Seleccioná una agenda para filtrar por tipo y buscar el evento.';
        }

        if (isAutomaticAgendaSelection && isCaseAgenda) {
            return 'La agenda sigue automáticamente el caso elegido y toma el primer evento disponible de esa agenda.';
        }

        if (isCaseAgenda) {
            return 'Los tipos y eventos de agendas de caso se resuelven desde la caché local.';
        }

        return 'Los eventos de agendas personales se consultan directo a la API para el mes elegido.';
    }, [isAutomaticAgendaSelection, isCaseAgenda, selectedAgendaId]);

    const handleEventCreated = useCallback((createdEvent) => {
        const normalizedCreatedEvent = normalizeSelectableEvent(createdEvent);
        if (!normalizedCreatedEvent?.id) return;

        const createdAgendaId = normalizedCreatedEvent.agendaId != null
            ? String(normalizedCreatedEvent.agendaId)
            : null;
        const createdAgenda = createdAgendaId ? agendasById.get(createdAgendaId) ?? null : null;
        const createdIsCaseAgenda = Boolean(createdAgenda?.suit_case_id);
        const { month: createdMonth, year: createdYear } = readEventMonthYear(normalizedCreatedEvent);
        const shouldStayAutomatic = (
            isAutomaticAgendaSelection
            && createdAgendaId != null
            && resolvedDefaultAgendaId != null
            && createdAgendaId === String(resolvedDefaultAgendaId)
        );

        setSearchQuery('');
        emitChange({
            agendaId: shouldStayAutomatic ? null : createdAgendaId,
            eventTypeId: null,
            event: normalizedCreatedEvent,
            month: createdIsCaseAgenda
                ? normalizedValue.month
                : (createdMonth || normalizedValue.month),
            year: createdIsCaseAgenda
                ? normalizedValue.year
                : (createdYear || normalizedValue.year),
        });
        setRefreshNonce((current) => current + 1);
    }, [
        agendasById,
        emitChange,
        isAutomaticAgendaSelection,
        normalizeSelectableEvent,
        normalizedValue.month,
        normalizedValue.year,
        resolvedDefaultAgendaId,
    ]);

    const handleAddEvent = useCallback(() => {
        openModal(StandaloneEventModal, {
            agendaId: selectedAgendaId ?? null,
            caseId: selectedAgenda?.suit_case_id ?? (selectedAgendaId ? null : defaultCaseId ?? null),
            onSuccess: handleEventCreated,
        });
    }, [defaultCaseId, handleEventCreated, openModal, selectedAgenda, selectedAgendaId]);

    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-2">
                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">
                        Agenda
                    </label>
                    <Select
                        value={selectedAgendaId ?? AUTO_AGENDA_VALUE}
                        onValueChange={(agendaId) => {
                            setSearchQuery('');
                            emitChange({
                                agendaId: agendaId === AUTO_AGENDA_VALUE ? null : agendaId,
                                eventTypeId: null,
                                event: null,
                            });
                        }}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Automático" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectGroup>
                                <SelectItem value={AUTO_AGENDA_VALUE}>Automático</SelectItem>
                            </SelectGroup>
                            {(agendaGroups.personal.length > 0 || agendaGroups.cases.length > 0) && (
                                <SelectSeparator />
                            )}
                            {agendaGroups.personal.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>Agendas personales</SelectLabel>
                                    {agendaGroups.personal.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            )}
                            {agendaGroups.personal.length > 0 && agendaGroups.cases.length > 0 && (
                                <SelectSeparator />
                            )}
                            {agendaGroups.cases.length > 0 && (
                                <SelectGroup>
                                    <SelectLabel>Agendas de casos</SelectLabel>
                                    {agendaGroups.cases.map((option) => (
                                        <SelectItem key={option.value} value={option.value}>
                                            {option.label}
                                        </SelectItem>
                                    ))}
                                </SelectGroup>
                            )}
                        </SelectContent>
                    </Select>
                </div>

                <div>
                    <label className="mb-1 block text-xs font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">
                        Tipo de evento
                    </label>
                    <Select
                        value={normalizedValue.eventTypeId ?? '__all__'}
                        onValueChange={(eventTypeId) => {
                            setSearchQuery('');
                            emitChange({
                                eventTypeId: eventTypeId === '__all__' ? null : eventTypeId,
                                event: null,
                            });
                        }}
                        disabled={!selectedAgendaId || caseTypesLoading}
                    >
                        <SelectTrigger>
                            <SelectValue placeholder="Todos los tipos" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="__all__">Todos los tipos</SelectItem>
                            {availableEventTypeOptions.map((option) => (
                                <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>
            </div>

            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card) px-3 py-2 text-xs text-(--text-secondary)">
                <p>{helperMessage}</p>
                {selectedAgendaId && availableEventTypeOptions.length === 0 && !caseTypesLoading && !personalEventsLoading && (
                    <p className="mt-1">
                        {isCaseAgenda
                            ? 'Todavía no hay tipos de evento disponibles en la caché local de esta agenda.'
                            : 'No hay tipos de evento cargados para el período seleccionado.'}
                    </p>
                )}
                {personalEventsError && (
                    <p className="mt-1 text-red-700">{personalEventsError}</p>
                )}
            </div>

            {!isCaseAgenda && selectedAgendaId && (
                <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card) px-4 py-3">
                    <div className="flex items-center justify-between gap-3">
                        <div>
                            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-(--text-tertiary)">
                                Período de búsqueda
                            </p>
                            <p className="mt-1 text-sm text-(--text-secondary)">
                                Elegí el mes y año desde el que querés consultar el evento.
                            </p>
                        </div>
                        <MonthYearSelector
                            month={normalizedValue.month}
                            year={normalizedValue.year}
                            onChange={(month, year) => {
                                setSearchQuery('');
                                emitChange({
                                    month,
                                    year,
                                    eventTypeId: null,
                                    event: null,
                                });
                            }}
                        />
                    </div>
                </div>
            )}

            <div className="space-y-2">
                <FilterAutosuggest
                    label="Evento"
                    placeholder="Buscar evento por título..."
                    value={normalizedValue.event?.id != null ? String(normalizedValue.event.id) : null}
                    options={eventOptions}
                    onChange={(_id, option) => emitChange({ event: option?.object ?? null })}
                    onClear={() => emitChange({ event: null })}
                    onQueryChange={(query) => {
                        startSearchTransition(() => {
                            setSearchQuery(query);
                        });
                    }}
                    onFocus={onFocus}
                    onBlur={onBlur}
                    emptyMessage={eventsEmptyMessage}
                    maxResults={Infinity}
                />

                <div>
                    <button
                        type="button"
                        onClick={handleAddEvent}
                        className="inline-flex items-center gap-2 rounded text-sm font-medium text-blue-600 transition-colors hover:text-blue-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                    >
                        <Plus className="h-4 w-4" />
                        <span>Agregar evento</span>
                    </button>
                </div>

                {(caseEventsLoading || personalEventsLoading) && (
                    <div className="flex items-center gap-2 text-xs text-(--text-secondary)">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span>Cargando eventos...</span>
                    </div>
                )}

                {normalizedValue.event && (
                    <div className="rounded-xl border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-900">
                        <p className="font-medium">{normalizedValue.event.title}</p>
                        <p className="mt-1 text-xs text-blue-800">
                            {[normalizedValue.event.type ?? normalizedValue.event.tipo ?? null, formatEventDateLabel(normalizedValue.event.starts_at)]
                                .filter(Boolean)
                                .join(' · ')}
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
