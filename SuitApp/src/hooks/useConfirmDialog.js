import { useState, useCallback } from 'react';

export const useConfirmDialog = () => {
    const [dialogState, setDialogState] = useState({
        open: false,
        title: '',
        desc: '',
        type: 'info',
        onConfirm: null,
        onCancel: null,
        cancelText: 'Cancelar',
        confirmText: 'Aceptar',
        loading: false
    });

    const openDialog = useCallback((config) => {
        setDialogState(prev => ({
            ...prev,
            ...config,
            open: true
        }));
    }, []);

    const closeDialog = useCallback(() => {
        setDialogState(prev => ({
            ...prev,
            open: false,
            loading: false
        }));
    }, []);

    const setDialogLoading = useCallback((isLoading) => {
        setDialogState(prev => ({
            ...prev,
            loading: isLoading
        }));
    }, []);

    const dialogProps = {
        open: dialogState.open,
        onOpenChange: (open) => {
            if (!open) closeDialog();
        },
        title: dialogState.title,
        description: dialogState.desc,
        type: dialogState.type,
        cancelText: dialogState.cancelText,
        confirmText: dialogState.confirmText,
        onCancel: dialogState.onCancel,
        onConfirm: dialogState.onConfirm,
        loading: dialogState.loading
    };

    return { dialogState, openDialog, closeDialog, setDialogLoading, dialogProps };
};
