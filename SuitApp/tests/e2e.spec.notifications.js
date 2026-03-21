import { test, expect } from '@playwright/test';
import { launchAndLogin, seedPastReminder } from './helpers/electronTestUtils.js';

test.describe('Notificaciones Electron', () => {
    test('cerrar la ventana principal la oculta en vez de cerrar la app', async () => {
        const { electronApp, window } = await launchAndLogin({ prefix: 'suit-tray' });

        try {
            const hiddenState = await electronApp.evaluate(async ({ BrowserWindow, app }) => {
                const win = BrowserWindow.getAllWindows()[0];
                win.close();

                return {
                    isReady: app.isReady(),
                    visible: win.isVisible(),
                    destroyed: win.isDestroyed(),
                    windowCount: BrowserWindow.getAllWindows().length,
                };
            });

            expect(hiddenState.isReady).toBe(true);
            expect(hiddenState.visible).toBe(false);
            expect(hiddenState.destroyed).toBe(false);
            expect(hiddenState.windowCount).toBe(1);

            const restoredState = await electronApp.evaluate(({ BrowserWindow }) => {
                const win = BrowserWindow.getAllWindows()[0];
                win.show();
                win.focus();
                return win.isVisible();
            });

            expect(restoredState).toBe(true);
            await expect(window.locator('h1', { hasText: 'Agenda General' })).toBeVisible({ timeout: 10000 });
        } finally {
            await electronApp.close();
        }
    });

    test('abre el modal de recordatorios perdidos y los resuelve desde el evento IPC', async () => {
        const { electronApp, window } = await launchAndLogin({ prefix: 'suit-notifications' });
        const reminderTitle = `PW-Perdida-${Date.now()}`;

        try {
            await window.evaluate(async () => {
                await window.electronAPI.db.clearTable('event_notifications');
            });

            const reminder = await seedPastReminder(window, {
                title: reminderTitle,
                minutesAgo: 12,
            });

            await window.evaluate(async () => {
                await window.electronAPI.notifications.reconcileNow();
            });

            const missedBeforeOpen = await window.evaluate(async () => {
                return await window.electronAPI.notifications.listPast();
            });

            expect(missedBeforeOpen.some((item) => item.title === reminderTitle)).toBe(true);

            await window.locator('#sidebar-missed-button').click();
            await expect(window.locator('h2', { hasText: 'Notificaciones pasadas' })).toBeVisible({ timeout: 10000 });
            await expect(window.locator(`text=${reminderTitle}`)).toBeVisible({ timeout: 10000 });

            await expect.poll(async () => {
                return await window.evaluate(async ({ eventId, userId }) => {
                    const notifications = await window.electronAPI.db.getAll('event_notifications');
                    return {
                        reminderPersisted: notifications.some((row) =>
                            Number(row.event_id) === Number(eventId) &&
                            Number(row.user_id) === Number(userId) &&
                            row.status === 'pending_read'
                        ),
                    };
                }, { eventId: reminder.eventId, userId: reminder.userId });
            }, { timeout: 10000 }).toEqual({
                reminderPersisted: true,
            });
        } finally {
            await electronApp.close();
        }
    });
});
