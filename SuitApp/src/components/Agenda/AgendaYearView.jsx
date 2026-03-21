import { useMemo } from 'react';
import dayjs from 'dayjs';

// Array of capitalized month names in Spanish hoisted outside of component
const months = [
    'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
    'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'
];

const AgendaYearView = ({ date, events, onNavigate, onView }) => {
    // Fixing an array so dayjs doesn't need localeData explicitly to map months if avoiding importing more plugins
    const year = dayjs(date).year();

    const getDaysInMonth = (monthIndex) => {
        const start = dayjs(new Date(year, monthIndex, 1));
        const days = [];
        for (let i = 0; i < start.daysInMonth(); i++) {
            days.push(start.add(i, 'days'));
        }
        return days;
    };

    const eventColorsByDate = useMemo(() => {
        const map = {};
        for (const ev of events) {
            const dateKey = dayjs(ev.start).format('YYYY-MM-DD');
            if (!map[dateKey]) map[dateKey] = [];
            if (ev.resolvedColor) map[dateKey].push(ev.resolvedColor);
        }
        return map;
    }, [events]);

    const hasEvent = (day) => {
        return !!eventColorsByDate[day.format('YYYY-MM-DD')];
    };

    const getEventColors = (day) => {
        return eventColorsByDate[day.format('YYYY-MM-DD')] || [];
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6 p-4 overflow-y-auto h-full">
            {months.map((monthName, index) => {
                const days = getDaysInMonth(index);
                const firstDayWeekday = days[0].day();
                const leadingEmptyKeys = Array.from(
                    { length: firstDayWeekday },
                    (_, offset) => `${monthName}-empty-${offset + 1}`
                );

                return (
                    <button
                        type="button"
                        key={monthName}
                        className="bg-white rounded-lg border border-gray-100 p-4 shadow-sm hover:shadow-md transition-shadow text-left"
                        onClick={() => {
                            const newDate = dayjs(new Date(year, index, 1)).toDate();
                            onNavigate('DATE', newDate);
                            onView('month');
                        }}
                    >
                        <h3 className="font-bold text-gray-900 mb-2 capitalize text-center">{monthName}</h3>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs mb-1">
                            <span className="text-gray-400">D</span>
                            <span className="text-gray-400">L</span>
                            <span className="text-gray-400">M</span>
                            <span className="text-gray-400">M</span>
                            <span className="text-gray-400">J</span>
                            <span className="text-gray-400">V</span>
                            <span className="text-gray-400">S</span>
                        </div>
                        <div className="grid grid-cols-7 gap-1 text-center text-xs">
                            {leadingEmptyKeys.map((emptyKey) => (
                                <div key={emptyKey} />
                            ))}
                            {days.map(day => {
                                const dayKey = day.format('YYYY-MM-DD');
                                const isToday = day.isSame(new Date(), 'day');
                                const hasEv = hasEvent(day);
                                const evColors = getEventColors(day);
                                // Show up to 3 color dots
                                const dotsToShow = [...new Set(evColors)].slice(0, 3);
                                return (
                                    <div
                                        key={dayKey}
                                        className={`
                                            aspect-square flex flex-col items-center justify-center rounded-full
                                            ${isToday ? 'bg-blue-600 text-white font-bold' : ''}
                                            ${hasEv && !isToday ? 'font-semibold' : ''}
                                        `}
                                    >
                                        <span>{day.date()}</span>
                                        {hasEv && !isToday && dotsToShow.length > 0 && (
                                            <div className="flex gap-0.5 mt-0.5">
                                                {dotsToShow.map((color) => (
                                                    <span
                                                        key={`${dayKey}-${color}`}
                                                        className="w-1 h-1 rounded-full"
                                                        style={{ backgroundColor: color }}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </button>
                );
            })}
        </div>
    );
};

export default AgendaYearView;
