import { useMemo } from 'react';
import { Button } from '../ui/Button.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog.jsx';
import { useConfirmDialog } from '../../hooks/useConfirmDialog.js';
import { useProfileCacheResync } from '../../hooks/useProfileCacheResync.js';
import { showAppToast } from '../ui/show-app-toast.jsx';

function buildPendingWarning(count) {
    if (!count) return null;

    return (
        <span className="block rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            Hay {count} cambio{count === 1 ? '' : 's'} local{count === 1 ? '' : 'es'} pendiente{count === 1 ? '' : 's'} de subirse.
            Si continuás, se descartarán.
        </span>
    );
}

export default function SettingsCacheResetRow() {
    const { dialogProps, openDialog, closeDialog, setDialogLoading } = useConfirmDialog();
    const {
        pendingUploadsCount,
        resyncing,
        disabled,
        runResync,
    } = useProfileCacheResync();

    const dialogDescription = useMemo(() => (
        <>
            <span className="block mb-3">
                Borra la cache y resincroniza con el servidor. Util por si tenes problemas con la app.
            </span>
            {buildPendingWarning(pendingUploadsCount)}
        </>
    ), [pendingUploadsCount]);

    const handleOpenDialog = () => {
        if (disabled) return;

        openDialog({
            title: '¿Borrar cache?',
            desc: dialogDescription,
            type: 'danger',
            confirmText: 'Borrar cache',
            cancelText: 'Cancelar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    await runResync();
                    closeDialog();
                    showAppToast({
                        title: '¡Resincronizado con exito!',
                        description: 'La app ya está resincronizada con el servidor.',
                        variant: 'success',
                    });
                } catch (error) {
                    setDialogLoading(false);
                    openDialog({
                        title: 'No se pudo borrar la cache',
                        desc: error?.message || 'La resincronización no pudo completarse.',
                        type: 'danger',
                        confirmText: 'Cerrar',
                        onConfirm: closeDialog,
                    });
                }
            },
        });
    };

    return (
        <>
            <div className="flex items-start justify-between gap-6 py-5 border-b border-(--border-default) last:border-b-0">
                <div className="flex-1">
                    <p className="font-medium text-(--text-primary)">Borrar cache</p>
                    <p className="text-sm text-(--text-secondary) mt-0.5">
                        Borra la cache y resincroniza con el servidor. Util por si tenes problemas con la app.
                    </p>
                    {!disabled ? null : (
                        <p className="text-xs text-(--text-tertiary) mt-2">
                            Disponible solo cuando la app está conectada y no hay otra sincronización en curso.
                        </p>
                    )}
                </div>
                <div className="shrink-0">
                    <Button
                        id="settings-clear-cache-button"
                        data-testid="settings-clear-cache-button"
                        variant="danger"
                        isLoading={resyncing}
                        disabled={disabled}
                        onClick={handleOpenDialog}
                    >
                        Borrar cache
                    </Button>
                </div>
            </div>
            <ConfirmDialog {...dialogProps} />
        </>
    );
}
