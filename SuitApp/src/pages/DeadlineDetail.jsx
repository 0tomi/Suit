import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useDeadlines } from '../context/DeadlinesContext';
import {
    canPostponeDeadline,
    deleteDeadline,
    getDeadlineActionErrorMessage,
    markDeadlineCompleted,
    postponeDeadline,
} from '../services/deadlineService';
import { useConfirmDialog } from '../hooks/useConfirmDialog';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Modal } from '../components/ui/Modal';
import { Button } from '../components/ui/Button';
import { Badge } from '../components/ui/Badge';
import { showAppToast } from '../components/ui/show-app-toast';
import { ArrowLeft, CheckCircle, Clock, Trash2, Edit2 } from 'lucide-react';

import NewDeadlineForm from '../components/deadlines/NewDeadlineForm';
import PostponeModal from '../components/deadlines/PostponeModal';
import { useDeadlineColors } from '../hooks/useDeadlineColors';
import { createLogger } from '../services/logService.js';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import localizedFormat from 'dayjs/plugin/localizedFormat';
const logger = createLogger('page:deadline-detail');

dayjs.locale('es');
dayjs.extend(localizedFormat);

/** Badge de estado alineado con los valores reales de la API. */
function getStatusBadge(status) {
    switch (status) {
        case 'Cumplido':   return <Badge variant="success">Cumplido</Badge>;
        case 'Vencido':    return <Badge variant="danger">Vencido</Badge>;
        case 'Prorrogado': return <Badge variant="warning">Prorrogado</Badge>;
        case 'Pendiente':
        default:           return <Badge variant="info">Pendiente</Badge>;
    }
}

export default function DeadlineDetail() {
    const { id } = useParams();
    const navigate = useNavigate();
    const { deadlines, refreshDeadlines } = useDeadlines();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const { getDeadlineStyle } = useDeadlineColors();

    const [deadline, setDeadline] = useState(null);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [postponeModalOpen, setPostponeModalOpen] = useState(false);

    useEffect(() => {
        if (!deadlines || !id) return;
        const found = deadlines.find((d) => String(d.id) === String(id));
        setDeadline(found ?? null);
    }, [deadlines, id]);

    if (!deadline) {
        return <div className="p-8 text-(--text-secondary)">Cargando vencimiento...</div>;
    }

    const handleEditSuccess = async () => {
        setIsEditModalOpen(false);
        await refreshDeadlines();
    };

    const handleMarkCompleted = () => {
        openDialog({
            title: 'Marcar como cumplido',
            desc: `¿Deseas dar por cumplido "${deadline.title}"?`,
            type: 'warning',
            confirmText: 'Sí, cumplir',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await markDeadlineCompleted(deadline.id);
                    if (!result.ok) {
                        throw new Error(getDeadlineActionErrorMessage(result, 'No se pudo marcar el vencimiento como cumplido.'));
                    }
                    await refreshDeadlines();
                    showAppToast({ title: 'Éxito', description: 'Vencimiento cumplido', variant: 'success' });
                    closeDialog();
                } catch (e) {
                    closeDialog();
                    openDialog({ title: 'Error', desc: e.message, type: 'danger', onConfirm: closeDialog });
                }
            },
        });
    };

    const handlePostponeConfirm = async (newDate) => {
        try {
            const result = await postponeDeadline(deadline.id, newDate);
            await refreshDeadlines();
            if (!result.ok) {
                showAppToast({
                    title: result.partialSuccess ? 'Prórroga parcial' : 'Error',
                    description: getDeadlineActionErrorMessage(result, 'No se pudo prorrogar'),
                    variant: result.partialSuccess ? 'warning' : 'destructive',
                });
                return;
            }
            showAppToast({ title: 'Éxito', description: 'Vencimiento prorrogado', variant: 'success' });
        } catch (e) {
            void logger.error('failed to postpone deadline', e);
            showAppToast({ title: 'Error', description: 'No se pudo prorrogar', variant: 'destructive' });
        } finally {
            setPostponeModalOpen(false);
        }
    };

    const handleDelete = () => {
        openDialog({
            title: 'Eliminar vencimiento',
            desc: `¿Estás seguro de eliminar "${deadline.title}"? Esta acción no se puede deshacer.`,
            type: 'danger',
            confirmText: 'Sí, eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    const result = await deleteDeadline(deadline.id);
                    if (!result.ok) {
                        throw new Error(getDeadlineActionErrorMessage(result, 'No se pudo eliminar el vencimiento.'));
                    }
                    if (window.electronAPI?.db?.deleteById) {
                        await window.electronAPI.db.deleteById('deadlines', deadline.id);
                    }
                    await refreshDeadlines();
                    showAppToast({ title: 'Éxito', description: 'Vencimiento eliminado', variant: 'success' });
                    closeDialog();
                    navigate('/deadlines');
                } catch (e) {
                    closeDialog();
                    openDialog({ title: 'Error', desc: e.message, type: 'danger', onConfirm: closeDialog });
                }
            },
        });
    };

    const rowStyle = getDeadlineStyle(deadline);

    return (
        <div className="space-y-6 relative p-6 max-w-4xl mx-auto">
            <button
                onClick={() => navigate('/deadlines')}
                className="flex items-center text-sm font-medium text-blue-600 hover:text-blue-800 transition-colors"
            >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Volver a Vencimientos
            </button>

            <div
                className="p-6 rounded-xl border border-(--border-default) shadow-sm"
                style={rowStyle}
            >
                <div className="flex justify-between items-start mb-6 border-b border-(--border-default) pb-4">
                    <div>
                        <h1 className="text-2xl font-bold text-(--text-primary) mb-2">{deadline.title}</h1>
                        <div className="flex gap-2 items-center flex-wrap">
                            {getStatusBadge(deadline.status)}
                            {deadline.priority === 'Urgente' ? (
                                <Badge variant="warning">Urgente</Badge>
                            ) : (
                                <Badge variant="default">Normal</Badge>
                            )}
                        </div>
                    </div>

                    <div className="flex gap-2 flex-wrap justify-end">
                        {deadline.status !== 'Cumplido' && (
                            <>
                                <Button variant="secondary" onClick={handleMarkCompleted}>
                                    <CheckCircle className="w-4 h-4 mr-1 text-green-600" />
                                    Cumplir
                                </Button>
                                {canPostponeDeadline(deadline) && (
                                    <Button variant="secondary" onClick={() => setPostponeModalOpen(true)}>
                                        <Clock className="w-4 h-4 mr-1 text-amber-600" />
                                        Prorrogar
                                    </Button>
                                )}
                                <Button variant="secondary" onClick={() => setIsEditModalOpen(true)}>
                                    <Edit2 className="w-4 h-4" />
                                </Button>
                            </>
                        )}
                        <Button variant="danger" onClick={handleDelete}>
                            <Trash2 className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Detalles</h3>
                        <dl className="space-y-4">
                            <div>
                                <dt className="text-xs text-(--text-secondary) mb-1">Fecha Límite</dt>
                                <dd className="text-lg font-medium text-(--text-primary)">
                                    {(() => {
                                        if (!deadline.due_date) return 'N/A';
                                        const dateObj = dayjs(deadline.due_date).locale('es');
                                        const hasTime = deadline.due_date.includes(':') && !deadline.due_date.includes('00:00:00');
                                        if (hasTime) {
                                            return dateObj.format('D [de] MMMM, YYYY - HH:mm [hs]');
                                        }
                                        return dateObj.format('D [de] MMMM, YYYY');
                                    })()}
                                </dd>
                            </div>
                            {deadline.description && (
                                <div>
                                    <dt className="text-xs text-(--text-secondary) mb-1">Descripción</dt>
                                    <dd className="text-sm text-(--text-primary) whitespace-pre-wrap">{deadline.description}</dd>
                                </div>
                            )}
                            {deadline.notify_at && (
                                <div>
                                    <dt className="text-xs text-(--text-secondary) mb-1">Notificación programada</dt>
                                    <dd className="text-sm text-(--text-primary)">
                                        {dayjs(deadline.notify_at).locale('es').format('D [de] MMMM, YYYY [a las] HH:mm')}
                                    </dd>
                                </div>
                            )}
                        </dl>
                    </div>

                    <div>
                        <h3 className="text-sm font-semibold text-(--text-secondary) uppercase tracking-wider mb-3">Asociaciones</h3>
                        <dl className="space-y-4">
                            {deadline.suit_case_id && (
                                <div>
                                    <dt className="text-xs text-(--text-secondary) mb-1">Caso Vinculado</dt>
                                    <dd>
                                        <button
                                            type="button"
                                            className="text-sm text-blue-600 hover:underline"
                                            onClick={() => navigate(`/cases/${deadline.suit_case_id}`)}
                                        >
                                            Ir al Caso #{deadline.suit_case_id}
                                        </button>
                                    </dd>
                                </div>
                            )}
                            {deadline.event_id && (
                                <div>
                                    <dt className="text-xs text-(--text-secondary) mb-1">Evento asociado</dt>
                                    <dd className="text-sm text-(--text-primary)">Evento #{deadline.event_id}</dd>
                                </div>
                            )}
                        </dl>
                    </div>
                </div>
            </div>

            <Modal
                open={isEditModalOpen}
                onClose={() => setIsEditModalOpen(false)}
                title="Editar Vencimiento"
                maxWidth="max-w-2xl"
                footerAlignment="justify-end"
                footer={
                    <>
                        <Button variant="secondary" onClick={() => setIsEditModalOpen(false)}>Cancelar</Button>
                        <Button type="submit" form="new-deadline-form">Guardar Cambios</Button>
                    </>
                }
            >
                <NewDeadlineForm
                    initialData={deadline}
                    onSuccess={handleEditSuccess}
                    openDialog={openDialog}
                    closeDialog={closeDialog}
                />
            </Modal>

            <PostponeModal
                isOpen={postponeModalOpen}
                onClose={() => setPostponeModalOpen(false)}
                deadline={deadline}
                onConfirm={handlePostponeConfirm}
            />

            <ConfirmDialog {...dialogProps} />
        </div>
    );
}
