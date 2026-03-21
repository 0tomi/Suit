import { test, expect } from '@playwright/test';
import { launchAndLogin, waitForPageReady } from './helpers/electronTestUtils.js';

function buildFutureEventValues() {
    const future = new Date();
    future.setDate(future.getDate() + 1);
    future.setHours(15, 0, 0, 0);
    const pad = (value) => String(value).padStart(2, '0');
    return {
        date: `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}`,
        time: `${pad(future.getHours())}:${pad(future.getMinutes())}`,
        startsAt: `${future.getFullYear()}-${pad(future.getMonth() + 1)}-${pad(future.getDate())}T${pad(future.getHours())}:${pad(future.getMinutes())}:${pad(future.getSeconds())}`,
    };
}

async function createFutureEvent(window, { eventTitle, date, time }) {
    await window.getByTestId('agenda-new-event-button').click();
    await expect(window.locator('h2', { hasText: 'Nuevo Evento' })).toBeVisible({ timeout: 10000 });

    await window.locator('input[placeholder="Ej: Audiencia..."]').fill(eventTitle);
    await window.locator('input[type="date"]').fill(date);
    await window.getByTestId('agenda-event-time-input').fill(time);

    // Reforzamos el change del select para que el modal persista la agenda actual.
    const agendaSelect = window.locator('label:has-text("Agenda")').locator('..').locator('select');
    await expect.poll(async () => agendaSelect.inputValue(), {
        message: 'No hay agenda seleccionada para crear el evento del modal',
        timeout: 10000,
    }).not.toBe('');
    await agendaSelect.selectOption(await agendaSelect.inputValue());

    await window.locator('button:has-text("Guardar")').click();
    await expect(window.locator('h2', { hasText: 'Nuevo Evento' })).toHaveCount(0, { timeout: 15000 });
}

async function findEventId(window, { title, startsAt }) {
    return await window.evaluate(async ({ expectedTitle, expectedStartsAt }) => {
        const rows = await window.electronAPI.db.getAll('events');
        const match = rows.find((row) => {
            if (row.title === expectedTitle && row.starts_at === expectedStartsAt) return true;
            if (!row.data_json) return false;
            try {
                const parsed = JSON.parse(row.data_json);
                return parsed?.title === expectedTitle && parsed?.starts_at === expectedStartsAt;
            } catch {
                return false;
            }
        });

        const eventId = Number(match?.id);
        return Number.isFinite(eventId) ? eventId : null;
    }, { expectedTitle: title, expectedStartsAt: startsAt });
}

async function selectAllAgendas(window) {
    const filterButton = window.locator('button[role="combobox"]').first();
    await expect(filterButton).toBeVisible({ timeout: 10000 });
    await filterButton.click();
    await window.getByRole('option', { name: 'Todas las agendas' }).click();
    await expect(filterButton).toContainText('Todas las agendas', { timeout: 5000 });
}

async function openNotificationForEvent(window, eventTitle) {
    const eventCard = window.locator('.rbc-event:visible').filter({ hasText: eventTitle }).first();
    await expect(eventCard).toBeVisible({ timeout: 15000 });

    const bellButton = eventCard.locator('button[title="Notificación"]:visible').first();
    await expect(bellButton).toBeVisible({ timeout: 10000 });
    await bellButton.click();
    await expect(window.locator('h3', { hasText: 'Notificaciones' })).toBeVisible({ timeout: 8000 });
}

async function focusCreatedEventInWeekView(window) {
    await window.getByRole('button', { name: 'Semana' }).click();
    await expect(window.locator('.rbc-time-view')).toBeVisible({ timeout: 5000 });
}

test.describe('EventNotificationModal CRUD', () => {
    test('configurar, actualizar y eliminar una notificación desde la agenda', async () => {
        test.setTimeout(90_000);

        const eventTitle = `PW-Notif-${Date.now()}`;
        const futureEvent = buildFutureEventValues();
        const session = await launchAndLogin({ prefix: 'suit-notif-modal' });

        try {
            const { window } = session;

            await waitForPageReady(window, 'agenda', { timeout: 15000 });
            await createFutureEvent(window, {
                eventTitle,
                date: futureEvent.date,
                time: futureEvent.time,
            });
            await selectAllAgendas(window);
            await expect.poll(async () => {
                return await findEventId(window, {
                    title: eventTitle,
                    startsAt: futureEvent.startsAt,
                });
            }, { timeout: 20000 }).not.toBeNull();
            const eventId = await findEventId(window, {
                title: eventTitle,
                startsAt: futureEvent.startsAt,
            });
            await window.reload();
            await waitForPageReady(window, 'agenda', { timeout: 15000 });
            await selectAllAgendas(window);
            await focusCreatedEventInWeekView(window);
            await openNotificationForEvent(window, eventTitle);

            await expect(window.locator('text=Notificacion desactivada.')).toBeVisible({ timeout: 10000 });

            await window.locator('button', { hasText: 'Configurar' }).click();
            const saveButton = window.locator('button[type="submit"]', { hasText: 'Guardar' });
            await saveButton.click();

            await expect(window.locator('text=Recordatorio guardado correctamente')).toBeVisible({ timeout: 10000 });
            await expect(window.locator('text=Se notificara 15 minutos antes.')).toBeVisible({ timeout: 10000 });

            await window.locator('button', { hasText: 'Cambiar' }).click();
            await window.locator('form select').first().selectOption('60');
            await saveButton.click();

            await expect(window.locator('text=Recordatorio guardado correctamente')).toBeVisible({ timeout: 10000 });
            await expect(window.locator('text=Se notificara 1 hora antes.')).toBeVisible({ timeout: 10000 });
            await expect.poll(async () => {
                const config = await window.evaluate(async (seededEventId) => (
                    await window.electronAPI.notifications.getEventConfig(seededEventId)
                ), eventId);
                return Number(config?.minutes ?? null);
            }, { timeout: 10000 }).toBe(60);

            await window.locator('button', { hasText: 'Desactivar' }).click();
            await expect(window.locator('text=Recordatorio desactivado')).toBeVisible({ timeout: 10000 });
            await expect(window.locator('text=Notificacion desactivada.')).toBeVisible({ timeout: 10000 });
            await expect.poll(async () => {
                return await window.evaluate(async (seededEventId) => (
                    await window.electronAPI.notifications.getEventConfig(seededEventId)
                ), eventId);
            }, { timeout: 10000 }).toBeNull();
        } finally {
            await session.electronApp.close().catch(() => {});
        }
    });
});
