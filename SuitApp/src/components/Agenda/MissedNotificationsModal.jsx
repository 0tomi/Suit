import dayjs from 'dayjs';
import { X, Trash2 } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { buildLocalDateFromNaiveIso } from '../../utils/dateTimeAdapter.js';

function parseWallClockDate(value) {
    const parsed = buildLocalDateFromNaiveIso(value);
    if (!parsed) return null;

    const wrapped = dayjs(parsed);
    return wrapped.isValid() ? wrapped : null;
}

export default function MissedNotificationsModal({ open, items, onClose, onOpenEvent, onDismissItem, onDismissAll }) {
    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Notificaciones pasadas"
            subtitle="Notificaciones que ya ocurrieron mientras no estabas"
            maxWidth="max-w-3xl"
        >
            <div className="space-y-4">
                <div className="flex items-start justify-end gap-4">
                    {items.length > 0 && onDismissAll && (
                        <button
                            type="button"
                            onClick={onDismissAll}
                            className="flex items-center gap-1.5 shrink-0 px-3 py-1 rounded-lg text-xs font-medium border border-(--border-default) text-(--text-secondary) hover:bg-(--bg-card-hover) hover:text-(--text-primary) transition-colors"
                            title="Descartar todas las notificaciones"
                        >
                            <Trash2 size={13} />
                            Descartar todo
                        </button>
                    )}
                </div>

                {items.length === 0 ? (
                    <p className="text-sm text-(--text-secondary)">No hay notificaciones pasadas visibles.</p>
                ) : (
                    <div className="space-y-3">
                        {items.map((item) => (
                            <div
                                key={`${item.event_id}-${item.notify_at}`}
                                className="rounded-xl border border-(--border-default) bg-(--bg-card) overflow-hidden"
                            >
                                <div className="flex items-stretch">
                                    <button
                                        type="button"
                                        onClick={() => onOpenEvent(item.event_id, item.notify_at)}
                                        className="flex-1 p-4 text-left transition-colors hover:bg-(--bg-card-hover)"
                                    >
                                        <div className="flex items-center justify-between gap-4">
                                            <div>
                                                {(() => {
                                                    const startsAt = parseWallClockDate(item.starts_at);

                                                    return (
                                                        <>
                                                <p className="font-semibold text-(--text-primary)">
                                                    {item.title || 'Evento sin título'}
                                                </p>
                                                <p className="mt-1 text-sm text-(--text-secondary)">
                                                    {startsAt ? startsAt.format('DD/MM/YYYY') : ''}
                                                    {item.is_all_day ? ' - Todo el día' : (startsAt ? ` a las ${startsAt.format('HH:mm')} hs` : '')}
                                                </p>
                                                {item.description ? (
                                                    <p className="mt-2 text-sm text-(--text-secondary)">
                                                        {item.description}
                                                    </p>
                                                ) : null}
                                                        </>
                                                    );
                                                })()}
                                            </div>

                                            <div className="text-right text-xs text-(--text-secondary)">
                                                <p>Recordatorio previsto</p>
                                                <p>{parseWallClockDate(item.notify_at)?.format('DD/MM/YYYY HH:mm') || ''}</p>
                                            </div>
                                        </div>
                                    </button>

                                    {onDismissItem && (
                                        <button
                                            type="button"
                                            onClick={() => onDismissItem(item.event_id, item.notify_at)}
                                            className="px-3 border-l border-(--border-default) text-(--text-secondary) hover:text-red-500 hover:bg-red-50 transition-colors"
                                            title="Descartar esta notificación"
                                        >
                                            <X size={16} />
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </Modal>
    );
}
