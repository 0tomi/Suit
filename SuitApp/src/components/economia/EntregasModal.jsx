import { useEntregas } from '../../hooks/useEntregas';
import { getApiErrorMessage } from '../../utils/apiErrorMessage';
import { useTipoPagos } from '../../context/TipoPagosContext';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NewEntregaForm } from './NewEntregaForm';
import { Modal } from '../ui/Modal';

export function EntregasModal({ closeModal, honorarioId, honorario }) {
    const { entregas, loading, addEntrega, removeEntrega } = useEntregas(honorarioId);
    const { tipo_pagos: tipoPagos = [] } = useTipoPagos();
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();

    const getTipoPagoName = (tipoPagoId) => {
        const tipo = tipoPagos.find(t => String(t.id) === String(tipoPagoId));
        return tipo ? tipo.name : 'N/A';
    };

    const handleDelete = (entregaId) => {
        openDialog({
            title: '¿Eliminar entrega?',
            desc: 'La entrega se eliminará del honorario y esta acción no se puede deshacer.',
            type: 'danger',
            confirmText: 'Eliminar',
            onConfirm: async () => {
                setDialogLoading(true);

                try {
                    const result = await removeEntrega(entregaId);

                    if (result?.ok === false) {
                        setDialogLoading(false);
                        openDialog({
                            title: 'Error al eliminar',
                            desc: getApiErrorMessage(result, 'No se pudo eliminar la entrega.'),
                            type: 'danger',
                            confirmText: 'Aceptar',
                            onConfirm: closeDialog,
                        });
                        return;
                    }

                    closeDialog();
                } catch (error) {
                    setDialogLoading(false);
                    openDialog({
                        title: 'Error al eliminar',
                        desc: error?.message || 'No se pudo eliminar la entrega.',
                        type: 'danger',
                        confirmText: 'Aceptar',
                        onConfirm: closeDialog,
                    });
                }
            },
        });
    };

    return (
        <Modal
            open={true}
            onClose={closeModal}
            title="Entregas del Honorario"
            maxWidth="max-w-4xl"
            noOverlay
        >
            <NewEntregaForm addEntrega={addEntrega} honorario={honorario} entregas={entregas} />

            <div className="mt-4">
                <Table
                    isEmpty={!loading && entregas.length === 0}
                    emptyMessage="No hay entregas registradas para este honorario."
                    columns={[
                        { header: 'Fecha' },
                        { header: 'Monto' },
                        { header: 'Tipo de Pago' },
                        { header: 'Nota' },
                        { header: 'Acciones', align: 'right' },
                    ]}
                >
                    {entregas.map(entrega => (
                        <tr key={entrega.id}>
                            <td className="p-4">{new Date(entrega.created_at).toLocaleDateString()}</td>
                            <td className="p-4">${entrega.monto}</td>
                            <td className="p-4">{getTipoPagoName(entrega.tipo_pago_id)}</td>
                            <td className="p-4">{entrega.nota}</td>
                            <td className="p-4 text-right">
                                <Button variant="destructive" size="sm" onClick={() => handleDelete(entrega.id)}>Eliminar</Button>
                            </td>
                        </tr>
                    ))}
                </Table>
            </div>
            <ConfirmDialog {...dialogProps} />
        </Modal>
    );
}
