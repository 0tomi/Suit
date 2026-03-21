import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocumentLockStatus, lockDocument, unlockDocument } from '../services/documentService.js';

export function useDocumentLock({ id, setSaveMessage }) {
    const [isEditing, setIsEditing] = useState(!id);
    const [isCheckingEdit, setIsCheckingEdit] = useState(false);
    const [isLockedByOther, setIsLockedByOther] = useState(false);
    const [lockerName, setLockerName] = useState('');

    const didUnlockRef = useRef(false);
    const hasActiveLockRef = useRef(false);

    const releaseLock = useCallback(async () => {
        if (!id || !hasActiveLockRef.current || didUnlockRef.current) return;

        didUnlockRef.current = true;
        hasActiveLockRef.current = false;
        await unlockDocument(id);
    }, [id]);

    useEffect(() => () => {
        void releaseLock();
    }, [releaseLock]);

    const enableEdit = useCallback(async () => {
        if (!id || isEditing || isCheckingEdit) return;

        setIsCheckingEdit(true);
        setIsLockedByOther(false);
        setLockerName('');
        setSaveMessage(null);

        try {
            const lockStatus = await getDocumentLockStatus(id);

            if (!lockStatus.ok) {
                hasActiveLockRef.current = false;
                setIsEditing(false);
                setIsLockedByOther(true);
                setLockerName('sin conexión');
                setSaveMessage({
                    type: 'error',
                    text: 'Sin conexión al servidor. No se pudo habilitar edición.',
                });
                return;
            }

            if (lockStatus.is_locked) {
                hasActiveLockRef.current = false;
                setIsEditing(false);
                setIsLockedByOther(true);
                setLockerName('otro usuario');
                setSaveMessage({
                    type: 'error',
                    text: 'El documento está bloqueado por otro usuario.',
                });
                return;
            }

            const lockResult = await lockDocument(id);
            if (lockResult?.ok) {
                hasActiveLockRef.current = true;
                didUnlockRef.current = false;
                setIsEditing(true);
                setIsLockedByOther(false);
                setLockerName('');
                return;
            }

            hasActiveLockRef.current = false;
            setIsEditing(false);
            setIsLockedByOther(true);
            setLockerName(lockResult?.status === 0 ? 'sin conexión' : 'otro usuario');
            setSaveMessage({
                type: 'error',
                text: lockResult?.status === 0
                    ? 'Sin conexión al servidor. No se pudo habilitar edición.'
                    : 'No se pudo adquirir el lock de edición.',
            });
        } catch (error) {
            hasActiveLockRef.current = false;
            setIsEditing(false);
            setIsLockedByOther(true);
            setLockerName('sin conexión');
            setSaveMessage({
                type: 'error',
                text: `No se pudo habilitar edición: ${error.message}`,
            });
        } finally {
            setIsCheckingEdit(false);
        }
    }, [id, isCheckingEdit, isEditing, setSaveMessage]);

    return {
        isEditing,
        isCheckingEdit,
        isLockedByOther,
        lockerName,
        enableEdit,
        releaseLock,
    };
}
