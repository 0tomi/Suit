import { useCallback, useReducer } from 'react';
import dayjs from 'dayjs';

const calendarInitial = {
    view: 'month',
    date: new Date(),
    selectedFilterAgenda: '',
};

function calendarReducer(state, action) {
    switch (action.type) {
        case 'SET_VIEW':
            return { ...state, view: action.payload };
        case 'SET_DATE':
            if (dayjs(state.date).isValid() && dayjs(action.payload).isValid()) {
                const currentMs = dayjs(state.date).valueOf();
                const nextMs = dayjs(action.payload).valueOf();
                if (currentMs === nextMs) return state;
            }
            return { ...state, date: action.payload };
        case 'SET_FILTER':
            return { ...state, selectedFilterAgenda: action.payload };
        default:
            return state;
    }
}

export function useAgendaCalendarState() {
    const [cal, dispatchCal] = useReducer(calendarReducer, calendarInitial);

    const setCalendarView = useCallback((view) => {
        dispatchCal({ type: 'SET_VIEW', payload: view });
    }, []);

    const setSelectedFilterAgenda = useCallback((agendaId) => {
        dispatchCal({ type: 'SET_FILTER', payload: agendaId });
    }, []);

    const setCalendarDate = useCallback((date) => {
        const parsed = dayjs(date);
        if (!parsed.isValid()) return;
        dispatchCal({ type: 'SET_DATE', payload: parsed.toDate() });
    }, []);

    const handleNavigate = useCallback((action, newDate) => {
        if (newDate) {
            setCalendarDate(newDate);
            return;
        }

        const now = dayjs(cal.date);
        if (action === 'PREV') setCalendarDate(now.subtract(1, cal.view === 'agenda' ? 'day' : cal.view).toDate());
        if (action === 'NEXT') setCalendarDate(now.add(1, cal.view === 'agenda' ? 'day' : cal.view).toDate());
        if (action === 'TODAY') setCalendarDate(new Date());
    }, [cal.date, cal.view, setCalendarDate]);

    const handleCalendarNavigate = useCallback((newDate, _view, action) => {
        handleNavigate(action, newDate);
    }, [handleNavigate]);

    return {
        cal,
        setCalendarView,
        setSelectedFilterAgenda,
        handleNavigate,
        handleCalendarNavigate,
    };
}
