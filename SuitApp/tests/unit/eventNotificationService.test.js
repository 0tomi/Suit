import { beforeEach, describe, expect, it, vi } from 'vitest';

import {
    createNotification,
    deleteNotification,
    getNotification,
    resetNotificationSyncInFlightState,
    syncAllNotifications,
    updateNotification,
} from '../../src/services/eventNotificationService.js';

describe('eventNotificationService', () => {
    beforeEach(() => {
        resetNotificationSyncInFlightState();
        window.electronAPI = {};
    });

    it('normaliza la configuracion de notificacion devuelta por main', async () => {
        const getEventConfig = vi.fn().mockResolvedValue({
            eventId: 7,
            enabled: true,
            minutes: 45,
            notifyAt: '2026-03-19T19:53:00',
            notifyDate: '2026-03-19',
            notifyTime: '19:53',
        });
        window.electronAPI.notifications = { getEventConfig };

        const result = await getNotification(7);

        expect(getEventConfig).toHaveBeenCalledWith(7);
        expect(result).toEqual({
            eventId: 7,
            enabled: true,
            minutes: 45,
            when_to_notify_minutes: 45,
            notifyAt: '2026-03-19T19:53:00',
            notifyDate: '2026-03-19',
            notifyTime: '19:53',
        });
    });

    it('delegan el reconcile de notificaciones al proceso principal', async () => {
        const reconcileNow = vi.fn().mockResolvedValue([{ event_id: 1 }]);
        window.electronAPI.notifications = { reconcileNow };

        const result = await syncAllNotifications();

        expect(reconcileNow).toHaveBeenCalledTimes(1);
        expect(result).toEqual([{ event_id: 1 }]);
    });

    it('guarda y elimina configuracion usando el bridge de Electron', async () => {
        const saveEventConfig = vi.fn().mockResolvedValue({ ok: true });
        const deleteEventConfig = vi.fn().mockResolvedValue({ ok: true });
        window.electronAPI.notifications = {
            saveEventConfig,
            deleteEventConfig,
        };

        const createResult = await createNotification(9, 30);
        const updateResult = await updateNotification(9, 15);
        const deleteResult = await deleteNotification(9);

        expect(saveEventConfig).toHaveBeenNthCalledWith(1, { eventId: 9, minutes: 30 });
        expect(saveEventConfig).toHaveBeenNthCalledWith(2, { eventId: 9, minutes: 15 });
        expect(deleteEventConfig).toHaveBeenCalledWith(9, {});
        expect(createResult).toEqual({ ok: true });
        expect(updateResult).toEqual({ ok: true });
        expect(deleteResult).toEqual({ ok: true });
    });

    it('devuelve error controlado cuando el entorno no expone el API de notificaciones', async () => {
        expect(await syncAllNotifications()).toEqual([]);
        await expect(getNotification(1)).resolves.toEqual({
            enabled: false,
            minutes: null,
            when_to_notify_minutes: null,
            notifyAt: null,
            notifyDate: null,
            notifyTime: null,
        });
        await expect(createNotification(1, 10)).resolves.toEqual({
            ok: false,
            error: 'La gestion de notificaciones no esta disponible en este entorno.',
        });
        await expect(deleteNotification(1)).resolves.toEqual({
            ok: false,
            error: 'La gestion de notificaciones no esta disponible en este entorno.',
        });
    });
});
