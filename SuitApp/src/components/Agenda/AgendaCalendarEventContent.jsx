import { Bell } from 'lucide-react';
import { isAgendaEventInPast } from './agendaCalendarConfig.js';

const AgendaCalendarEventContent = ({ event, onOpenNotification }) => {
    return (
        <div className="flex justify-between items-center w-full h-full overflow-hidden">
            <div className="flex items-center gap-1.5 min-w-0">
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
