import { useEffect, useRef } from 'react';
import { useBlocker } from 'react-router-dom';
import { useConfirmDialog } from './useConfirmDialog';

export function useUnsavedChanges(isDirty, options = {}) {
    const {
        title = 'Cambios sin guardar',
        desc = '¿Seguro que quieres salir? Perderás los cambios no guardados.',
        confirmText = 'Salir sin guardar',
        cancelText = 'Quedarme',
    } = options;

    const { dialogProps, openDialog, closeDialog } = useConfirmDialog();
    const dialogOpenRef = useRef(false);

    // Block internal React Router navigation
    const blocker = useBlocker(
        ({ currentLocation, nextLocation }) =>
            isDirty && currentLocation.pathname !== nextLocation.pathname
    );

    useEffect(() => {
        if (blocker.state === 'blocked' && !dialogOpenRef.current) {
            dialogOpenRef.current = true;
            openDialog({
                title,
                desc,
                type: 'warning',
                confirmText,
                cancelText,
                onConfirm: () => {
                    dialogOpenRef.current = false;
                    closeDialog();
                    blocker.proceed();
                },
                onCancel: () => {
                    dialogOpenRef.current = false;
                    closeDialog();
                    blocker.reset();
                }
            });
        }
    }, [blocker, openDialog, closeDialog, title, desc, confirmText, cancelText]);

    // Block native window close/reload
    useEffect(() => {
        const handleBeforeUnload = (e) => {
            if (isDirty) {
                e.preventDefault();
                e.returnValue = desc;
                return desc;
            }
        };

        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [isDirty, desc]);

    return { dialogProps };
}
