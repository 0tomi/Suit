import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { dayjsLocalizer } from 'react-big-calendar';
dayjs.locale('es');

export const agendaLocalizer = dayjsLocalizer(dayjs);

export const CALENDAR_MESSAGES = {
    allDay: 'Todo el día',
    previous: 'Anterior',
    next: 'Siguiente',
    today: 'Hoy',
    month: 'Mes',
    week: 'Semana',
    day: 'Día',
    agenda: 'Agenda',
    date: 'Fecha',
    time: 'Hora',
    event: 'Evento',
    noEventsInRange: 'No hay eventos en este rango.',
    showMore: total => `+ Ver más (${total})`,
};

export function isAgendaEventInPast(event) {
    // Prioridad 1: usar el Date object ya construido por normalizeAgendaEvent.
    if (event?.start instanceof Date && !Number.isNaN(event.start.getTime())) {
        return dayjs(event.start).isBefore(dayjs());
    }

    // Fallback: leer starts_at naive directamente.
    if (!event?.starts_at) return false;
    return dayjs(event.starts_at).isBefore(dayjs());
}
