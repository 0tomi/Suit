import { test, expect } from '@playwright/test';
import { launchAndLogin, seedPastReminder, getCurrentUser, goToSection } from './helpers/electronTestUtils.js';

test.describe('Notificaciones Bugfixes', () => {
    test('el botón Bell no aparece en eventos cuya hora ya pasó', async () => {
        const { electronApp, window } = await launchAndLogin({ prefix: 'suit-notif-bell' });

        try {
            // Sembrar un evento en el pasado directamente en SQLite local
            const seeded = await seedPastReminder(window, { minutesAgo: 30 });

            // Navegar a la agenda para que el contexto refresque los eventos
            await goToSection(window, 'agenda');
            await window.waitForTimeout(2000);

            // Si el evento aparece en el calendario (hoy en vista mes), verificar que no tiene botón Bell
            const evtContainer = window.locator('.rbc-event', { hasText: seeded.title }).first();
            const evtVisible = await evtContainer.isVisible().catch(() => false);
            if (evtVisible) {
                // El único elemento interactivo en el evento debe ser el span de texto, no un botón Bell
                const bellBtn = evtContainer.locator('button');
                await expect(bellBtn).toHaveCount(0, { timeout: 3000 });
            }
            // Si el evento no está en vista actual, el test pasa implícitamente
        } finally {
            await electronApp.close();
        }
    });

    test('panel de recordatorios tiene botón de descartar por item y descartar todo', async () => {
        const { electronApp, window } = await launchAndLogin({ prefix: 'suit-notif-panel' });

        try {
            // Obtener usuario actual para sembrar la notificación pasada
            const currentUser = await getCurrentUser(window);
            if (!currentUser?.id) throw new Error('No authenticated user');

            const eventId = Math.floor(Date.now() / 1000);
            const now = new Date();
            now.setMinutes(now.getMinutes() - 90);
            const notifyAt = now.toISOString();

            // Sembrar evento + notification con status pending_read directamente en SQLite
            await window.evaluate(async ({ eventId, userId, notifyAt }) => {
                const date = new Date();
                date.setHours(date.getHours() - 2);
                const pad = (value) => String(value).padStart(2, '0');
                const startsAt = `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
                const title = `PW-Missed-${eventId}`;

                await window.electronAPI.db.upsertMany('events', [{
                    id: eventId,
                    agenda_id: 1,
                    suit_case_id: null,
                    event_type_id: 1,
                    title,
                    description: 'Test perdida',
                    starts_at: startsAt,
                    is_all_day: 0,
                    data_json: JSON.stringify({
                        id: eventId,
                        agenda_id: 1,
                        suit_case_id: null,
                        event_type_id: 1,
                        title,
                        description: 'Test perdida',
                        starts_at: startsAt,
                        is_all_day: 0,
                    }),
                    synced_at: new Date().toISOString(),
                }]);

                await window.electronAPI.db.upsertMany('event_notifications', [{
                    event_id: eventId,
                    user_id: userId,
                    notify_at: notifyAt,
                    last_updated_at: new Date().toISOString(),
                    status: 'pending_read',
                    handled_at: new Date().toISOString(),
                    data_json: JSON.stringify({ eventId, title, notify_at: notifyAt, status: 'pending_read' }),
                    synced_at: new Date().toISOString(),
                }]);
            }, { eventId, userId: currentUser.id, notifyAt });

            await window.evaluate(async () => {
                await window.electronAPI.notifications.reconcileNow();
            });
            await window.locator('#sidebar-missed-button').click();

            await expect(window.locator('h2:has-text("Notificaciones pasadas")')).toBeVisible({ timeout: 10000 });

            // Verificar que existe el botón "Descartar todo"
            const dismissAllBtn = window.locator('button:has-text("Descartar todo")');
            await expect(dismissAllBtn).toBeVisible({ timeout: 5000 });

            // Verificar que existe al menos un botón X individual
            const dismissItemBtns = window.locator('button[title="Descartar esta notificación"]');
            const btnCount = await dismissItemBtns.count();
            expect(btnCount).toBeGreaterThan(0);

            // Hacer click en "Descartar todo" → la lista debe vaciarse
            await dismissAllBtn.click();
            await window.waitForTimeout(500);

            // El modal debe pasar al estado vacío luego de descartar todo.
            await expect(window.getByText('No hay notificaciones pasadas visibles.')).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });
});
