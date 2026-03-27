import { Bell } from 'lucide-react';
import { isAgendaEventInPast } from './agendaCalendarConfig.js';

const AgendaCalendarEventContent = ({ event, onOpenNotification, isNew, onMarkAsSeen }) => {
    return (
        <div
            className="group relative flex justify-between items-center w-full h-full"
            onMouseEnter={() => isNew && onMarkAsSeen('events', event.id)}
        >
            {isNew && (
                <div className="absolute top-0 right-0 z-20 px-1.5 py-0.5 bg-red-600 text-white text-[7px] font-black uppercase leading-none rounded-bl-md shadow-sm border-l border-b border-white/20 animate-pulse-subtle select-none">
                    Nuevo
                </div>
            )}
            <div className={`flex items-center gap-1.5 min-w-0 ${isNew ? 'pr-10' : 'pr-4'}`}>
                {event.pendingSync && (
                    <span
                        className="inline-block h-2 w-2 rounded-full bg-amber-300/90 flex-shrink-0"
                        title={event.pendingSyncError || 'Pendiente de sincronizacion'}
                    />
                )}
                <span className="truncate" title={event.title}>{event.title}</span>
            </div>
            {!isAgendaEventInPast(event) && (
                <button
                    className="p-1 hover:bg-black/10 rounded ml-1 flex-shrink-0"
                    onClick={(e) => {
                        e.stopPropagation();
                        onOpenNotification(event);
                    }}
                    title="Notificación"
                >
                    <Bell
                        size={14}
                        className={event.hasNotification ? 'text-amber-300 fill-amber-300' : 'text-white/60'}
                    />
                </button>
            )}
        </div>
    );
};

export default AgendaCalendarEventContent;
