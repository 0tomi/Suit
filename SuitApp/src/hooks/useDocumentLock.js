import { useCallback, useEffect, useRef, useState } from 'react';
import { getDocumentLockStatus, lockDocument, unlockDocument } from '../services/documentService.js';

const LOCK_HEARTBEAT_INTERVAL_MS = 4.5 * 60 * 1000; // 4.5 min — lock TTL es 5 min
import { createLogger } from '../services/logService.js';

const logger = createLogger('use-document-lock');

export function useDocumentLock({ id, setSaveMessage, onLockAcquired = null }) {
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
        try {
            const result = await unlockDocument(id);
            if (!result?.ok) {
                void logger.error('unlockDocument request failed', {
                    documentId: id,
                    status: result?.status ?? null,
                    error: result?.error || null,
                    message: result?.data?.message || null,
                });
            }
        } catch (error) {
            void logger.error('unlockDocument threw unexpectedly', {
                documentId: id,
                error: error?.message || String(error),
            });
        }
    }, [id]);

    useEffect(() => () => {
        void releaseLock();
    }, [releaseLock]);

    // Heartbeat: renueva el lock cada 4.5 min mientras el usuario está editando.
    // El lock expira en 5 min en el servidor, por lo que el intervalo es conservador.
    useEffect(() => {
        if (!id || !isEditing) return undefined;

        const renewLock = async () => {
            if (!hasActiveLockRef.current) return;
            try {
                await lockDocument(id);
            } catch (error) {
                void logger.warn('heartbeat de lock falló', {
                    documentId: id,
                    error: error?.message || String(error),
                });
            }
        };

        const intervalId = setInterval(renewLock, LOCK_HEARTBEAT_INTERVAL_MS);
        return () => clearInterval(intervalId);
    }, [id, isEditing]);

    useEffect(() => {
        if (!id) return undefined;

        let cancelled = false;

        const syncInitialLockStatus = async () => {
            try {
                const lockStatus = await getDocumentLockStatus(id);
                if (cancelled || !lockStatus.ok || hasActiveLockRef.current) return;

                if (lockStatus.is_locked) {
                    setIsEditing(false);
                    setIsLockedByOther(true);
                    setLockerName(lockStatus.data?.locker?.name || 'otro usuario');
                } else {
                    setIsLockedByOther(false);
                    setLockerName('');
                }
            } catch (error) {
                void logger.warn('initial document lock status check failed', {
                    documentId: id,
                    error: error?.message || String(error),
                });
            }
        };

        void syncInitialLockStatus();

        return () => {
            cancelled = true;
        };
    }, [id]);

    // Libera el lock y regresa al modo visualización.
    // Llamar después de guardar o cuando el usuario cancela la edición.
    const exitEditMode = useCallback(async () => {
        await releaseLock();
        setIsEditing(false);
        setIsLockedByOther(false);
        setLockerName('');
    }, [releaseLock]);

    const enableEdit = useCallback(async () => {
        if (!id || isEditing || isCheckingEdit) return { ok: false, reason: 'noop' };

        setIsCheckingEdit(true);
        setIsLockedByOther(false);
        setLockerName('');
        setSaveMessage(null);

        try {
            // Intentar adquirir el lock directamente, sin pre-chequear /is-locked.
            // El endpoint /is-locked devuelve true incluso cuando el lock lo tiene el usuario actual,
            // por lo que el pre-chequeo bloqueaba el re-ingreso a edición después de navegar y volver.
            // Si el usuario ya tiene un lock activo, el servidor lo renueva en lugar de rechazarlo.
            const lockResult = await lockDocument(id);

            if (lockResult?.ok) {
                hasActiveLockRef.current = true;
                didUnlockRef.current = false;

                if (typeof onLockAcquired === 'function') {
                    try {
                        await onLockAcquired({
                            documentId: id,
                            lockResult,
                        });
                    } catch (error) {
                        hasActiveLockRef.current = false;
                        didUnlockRef.current = true;

                        try {
                            await unlockDocument(id);
                        } catch (unlockError) {
                            void logger.error('failed to rollback lock after post-lock sync failure', {
                                documentId: id,
                                error: unlockError?.message || String(unlockError),
                            });
                        }

                        setIsEditing(false);
                        setIsLockedByOther(false);
                        setLockerName('');
                        setSaveMessage({
                            type: 'error',
                            text: error?.message || 'No se pudo sincronizar el documento antes de editar.',
                        });
                        return { ok: false, reason: 'post-lock-sync-failed' };
                    }
                }

                setIsEditing(true);
                setIsLockedByOther(false);
                setLockerName('');
                return { ok: true, lockResult };
            }

            // Lock falló — determinar causa para mostrar mensaje apropiado.
            hasActiveLockRef.current = false;
            setIsEditing(false);

            if (lockResult?.status === 0) {
                setIsLockedByOther(true);
                setLockerName('sin conexión');
                setSaveMessage({
                    type: 'error',
                    text: 'Sin conexión al servidor. No se pudo habilitar edición.',
                });
                return { ok: false, reason: 'lock-status-unavailable' };
            }

            // Consultar /is-locked para intentar obtener el nombre del bloqueante.
            let blockerName = 'otro usuario';
            try {
                const lockStatus = await getDocumentLockStatus(id);
                if (lockStatus.ok && lockStatus.data?.locker?.name) {
                    blockerName = lockStatus.data.locker.name;
                }
            } catch {
                // best-effort: si falla, usar nombre genérico
            }

            setIsLockedByOther(true);
            setLockerName(blockerName);
            setSaveMessage({
                type: 'error',
                text: `No se pudo adquirir el bloqueo. El documento está en uso por ${blockerName}.`,
            });
            return { ok: false, reason: 'locked-by-other' };
        } catch (error) {
            hasActiveLockRef.current = false;
            setIsEditing(false);
            setIsLockedByOther(true);
            setLockerName('sin conexión');
            setSaveMessage({
                type: 'error',
                text: `No se pudo habilitar edición: ${error.message}`,
            });
            return { ok: false, reason: 'exception', error };
        } finally {
            setIsCheckingEdit(false);
        }
    }, [id, isCheckingEdit, isEditing, onLockAcquired, setSaveMessage]);

    return {
        isEditing,
        isCheckingEdit,
        isLockedByOther,
        lockerName,
        enableEdit,
        exitEditMode,
        releaseLock,
    };
}
