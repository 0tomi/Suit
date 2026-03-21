import { ChevronLeft, ChevronRight } from 'lucide-react';
import dayjs from 'dayjs';

const VIEWS = [
    { id: 'month', label: 'Mes' },
    { id: 'week', label: 'Semana' },
    { id: 'day', label: 'Día' },
    { id: 'agenda', label: 'Agenda' },
    { id: 'year', label: 'Año' }
];

const AgendaToolbar = ({ date, view, onView, onNavigate }) => {
    const goToBack = () => {
        if (view === 'year') {
            onNavigate('PREV', dayjs(date).subtract(1, 'year').toDate());
        } else {
            onNavigate('PREV');
        }
    };

    const goToNext = () => {
        if (view === 'year') {
            onNavigate('NEXT', dayjs(date).add(1, 'year').toDate());
        } else {
            onNavigate('NEXT');
        }
    };

    const goToCurrent = () => {
        onNavigate('TODAY', new Date());
    };

    const getLabel = () => {
        if (view === 'year') {
            return dayjs(date).format('YYYY');
        }
        return dayjs(date).format('MMMM YYYY');
    };

    return (
        <div className="flex flex-col md:flex-row justify-between items-center mb-4 p-2 gap-4 bg-(--bg-card) rounded-xl border border-(--border-subtle) shadow-sm">
            <div className="flex items-center gap-2">
                <button
                    onClick={goToBack}
                    className="p-1.5 hover:bg-(--bg-card-hover) rounded-lg text-(--text-secondary) transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>
                <button
                    onClick={goToCurrent}
                    className="px-3 py-1.5 bg-(--bg-input) hover:bg-(--border-default) rounded-lg text-sm font-medium text-(--text-primary) transition-colors"
                >
                    Hoy
                </button>
                <button
                    onClick={goToNext}
                    className="p-1.5 hover:bg-(--bg-card-hover) rounded-lg text-(--text-secondary) transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
                <div className="ml-4 text-lg font-bold text-(--text-primary) capitalize min-w-[150px]">
                    {getLabel()}
                </div>
            </div>

            <div className="flex bg-(--bg-input) border border-(--border-default) p-1 rounded-lg">
                {VIEWS.map(item => (
                    <button
                        key={item.id}
                        onClick={() => onView(item.id)}
                        className={`
                            px-4 py-1.5 rounded-md text-sm font-medium transition-all
                            ${view === item.id
                                ? 'bg-(--bg-card) shadow text-blue-500'
                                : 'text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-card-hover)'
                            }
                        `}
                    >
                        {item.label}
                    </button>
                ))}
            </div>
        </div>
    );
};

export default AgendaToolbar;
