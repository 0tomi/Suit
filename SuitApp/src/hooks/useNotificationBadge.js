import { useState, useEffect, useCallback } from 'react';
import {
    clearAllPastNotifications,
    closePastNotification,
    getPastNotifications,
} from '../services/missedNotificationService';
import { createLogger } from '../services/logService.js';
const logger = createLogger('hook:notification-badge');


/**
 * Mantiene el conteo y listado de notificaciones pasadas visibles desde la campana.
 * El historial se elimina solo por acciones explicitas del usuario.
 */
export function useNotificationBadge() {
    const [count, setCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const [items, setItems] = useState([]);

    const syncItems = useCallback(async () => {
        try {
            const past = await getPastNotifications();
            setItems((prev) => (prev.length > 0 ? past : prev));
            setCount(past.length);
            return past;
        } catch (err) {
            // Feature secundaria: badge muestra 0, la UI degrada graciosamente
            void logger.warn('error fetching past notifications', err);
            return [];
        }
    }, []);

    const openModal = useCallback(async () => {
        const past = await syncItems();
        setItems(past);
        setIsOpen(true);
    }, [syncItems]);

    const closeModal = useCallback(() => {
        setIsOpen(false);
    }, []);

    const dismissItem = useCallback(async (eventId, notifyAt) => {
        setItems((prev) => prev.filter((item) => !(item.event_id === eventId && item.notify_at === notifyAt)));
        setCount((prev) => Math.max(0, prev - 1));

        try {
            await closePastNotification(eventId, notifyAt);
        } catch (err) {
            void logger.error('error closing past notification', err);
        }
    }, []);

    const dismissAll = useCallback(async () => {
        setItems([]);
        setCount(0);

        try {
            await clearAllPastNotifications();
        } catch (err) {
            void logger.error('error clearing all past notifications', err);
        }
    }, []);

    useEffect(() => {
        const initialSyncTimeout = window.setTimeout(() => {
            void syncItems();
        }, 0);

        const unsubscribe = window.electronAPI?.notifications?.onPastChanged?.((nextItems = []) => {
            const normalized = Array.isArray(nextItems) ? nextItems : [];
            setCount(normalized.length);
            setItems((prev) => (prev.length > 0 ? normalized : prev));
        });

        return () => {
            window.clearTimeout(initialSyncTimeout);
            unsubscribe?.();
        };
    }, [syncItems]);

    return { count, isOpen, items, openModal, closeModal, dismissItem, dismissAll };
}
