import { test, expect } from '@playwright/test';
import { getCurrentUser, launchAndLogin } from './helpers/electronTestUtils.js';

test.describe('Notificaciones futuras del dia', () => {
    test('reclasifica una futura-hoy como scheduled y no la muestra en pasadas', async () => {
        const { electronApp, window } = await launchAndLogin({ prefix: 'suit-notif-future-today' });
        const reminderTitle = `PW-FuturaHoy-${Date.now()}`;

        try {
            const currentUser = await getCurrentUser(window);
            if (!currentUser?.id) throw new Error('No authenticated user');

            await window.evaluate(async () => {
                await window.electronAPI.db.clearTable('event_notifications');
            });

            const seeded = await window.evaluate(async ({ userId, reminderTitle }) => {
                const formatLocalPart = (value) => String(value).padStart(2, '0');
                const toLocalDateTime = (dateValue) => (
                    `${dateValue.getFullYear()}-${formatLocalPart(dateValue.getMonth() + 1)}-${formatLocalPart(dateValue.getDate())}T${formatLocalPart(dateValue.getHours())}:${formatLocalPart(dateValue.getMinutes())}:00`
                );
                const eventId = Math.floor(Date.now() / 1000);
                const now = new Date();
                const eventDate = new Date(now.getTime() + 30 * 60 * 1000);
                const notifyDate = new Date(eventDate.getTime() - 60 * 1000);
                const startsAt = toLocalDateTime(eventDate);
                const notifyAt = new Date(toLocalDateTime(notifyDate)).toISOString();

                await window.electronAPI.db.upsertMany('events', [{
                    id: eventId,
                    agenda_id: 1,
                    suit_case_id: null,
                    event_type_id: 1,
                    title: reminderTitle,
                    description: 'Recordatorio futuro del dia',
                    starts_at: startsAt,
                    is_all_day: 0,
                    data_json: JSON.stringify({
                        id: eventId,
                        agenda_id: 1,
                        suit_case_id: null,
                        event_type_id: 1,
                        title: reminderTitle,
                        description: 'Recordatorio futuro del dia',
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
                    data_json: JSON.stringify({
                        event_id: eventId,
                        user_id: userId,
                        title: reminderTitle,
                        notify_at: notifyAt,
                        status: 'pending_read',
                    }),
                    synced_at: new Date().toISOString(),
                }]);

                return { eventId, notifyAt };
            }, { userId: currentUser.id, reminderTitle });

            await window.evaluate(async () => {
                await window.electronAPI.notifications.reconcileNow();
            });

            await expect.poll(async () => {
                return await window.evaluate(async ({ eventId, userId }) => {
                    const rows = await window.electronAPI.db.getAll('event_notifications');
                    const row = rows.find((entry) =>
                        Number(entry.event_id) === Number(eventId) &&
                        Number(entry.user_id) === Number(userId)
                    );

                    return row
                        ? {
                            status: row.status,
                            handled_at: row.handled_at,
                        }
                        : null;
                }, { eventId: seeded.eventId, userId: currentUser.id });
            }, { timeout: 10000 }).toEqual({
                status: 'scheduled',
                handled_at: null,
            });

            const pastNotifications = await window.evaluate(async () => {
                return await window.electronAPI.notifications.listPast();
            });

            expect(pastNotifications.some((item) => item.title === reminderTitle)).toBe(false);
        } finally {
            await electronApp.close();
        }
    });
});
