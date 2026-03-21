import { test, expect } from '@playwright/test';
import { launchAndLogin, seedPastReminder } from './helpers/electronTestUtils.js';

test.describe('Notificaciones visuales', () => {
    test.skip(!process.env.RUN_VISUAL_NOTIFICATION_TEST, 'Manual visual test only');

    test('muestra una notificacion del sistema mientras la app esta oculta en tray', async () => {
        test.setTimeout(90_000);

        const { electronApp, window } = await launchAndLogin({ prefix: 'suit-visual-notifications' });

        try {
            const notificationSupport = await electronApp.evaluate(({ Notification }) => {
                return Notification.isSupported();
            });

            expect(notificationSupport).toBe(true);

            console.log('');
            console.log('Visual test: la app se ocultara al tray y disparara una notificacion del sistema.');
            console.log('Observa una notificacion nativa asociada al recordatorio en tu escritorio.');
            console.log('Si no aparece, revisa la configuracion del sistema operativo para notificaciones de SuitAPP/Electron.');

            await window.evaluate(async () => {
                await window.electronAPI.db.clearTable('event_notifications');
            });

            const reminder = await seedPastReminder(window, {
                title: `PW-Visual-${Date.now()}`,
                minutesAgo: 8,
            });

            await electronApp.evaluate(({ BrowserWindow }) => {
                BrowserWindow.getAllWindows()[0].close();
            });

            await window.evaluate(async () => {
                await window.electronAPI.notifications.reconcileNow();
            });

            await expect.poll(async () => {
                return await window.evaluate(async ({ eventId, userId }) => {
                    const notifications = await window.electronAPI.db.getAll('event_notifications');
                    return {
                        pastReminder: notifications.some((row) =>
                            Number(row.event_id) === Number(eventId) &&
                            Number(row.user_id) === Number(userId) &&
                            row.status === 'pending_read'
                        ),
                    };
                }, { eventId: reminder.eventId, userId: reminder.userId });
            }, { timeout: 10000 }).toEqual({
                pastReminder: true,
            });

            console.log(`Visual test: deberias ver la notificacion nativa asociada al recordatorio "${reminder.title}".`);
            await window.waitForTimeout(10_000);

            await electronApp.evaluate(({ BrowserWindow }) => {
                const win = BrowserWindow.getAllWindows()[0];
                win.show();
                win.focus();
            });

            await expect(window.locator('h1', { hasText: 'Agenda General' })).toBeVisible({ timeout: 10000 });
        } finally {
            await electronApp.close();
        }
    });
});
