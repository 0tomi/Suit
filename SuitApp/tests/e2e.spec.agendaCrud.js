import { test, expect } from '@playwright/test';
import { launchAndLogin, waitForPageReady } from './helpers/electronTestUtils.js';

test.describe('Agenda CRUD (create/show/delete)', () => {
    test('debe guardar, mostrar y eliminar un evento', async () => {
        test.setTimeout(90_000);
        const { electronApp, window } = await launchAndLogin();
        const eventTitle = `PW-Evento-${Date.now()}`;

        try {
            await waitForPageReady(window, 'agenda', { timeout: 15000 });
            await expect(window.getByTestId('agenda-new-event-button')).toBeVisible({ timeout: 10000 });

            await window.getByTestId('agenda-new-event-button').click();
            await expect(window.locator('h2', { hasText: 'Nuevo Evento' })).toBeVisible({ timeout: 10000 });

            const titleInput = window.locator('input[placeholder="Ej: Audiencia..."]');
            await titleInput.fill(eventTitle);
            const today = new Date().toISOString().slice(0, 10);
            await window.locator('input[type="date"]').fill(today);
            await window.getByTestId('agenda-event-time-input').fill('16:55');

            const agendaSelect = window.locator('label:has-text("Agenda")').locator('..').locator('select');
            await expect.poll(async () => await agendaSelect.inputValue(), {
                message: 'No hay agenda seleccionada para crear el evento',
                timeout: 10000,
            }).not.toBe('');
            // Forzar onChange para que el formData interno tenga agendaId definido.
            await agendaSelect.selectOption({ index: 0 });

            await window.locator('button:has-text("Guardar")').click();
            await expect(window.locator('h2', { hasText: 'Nuevo Evento' })).toHaveCount(0, { timeout: 15000 });

            // Verifica que el evento quedó en caché local (SQLite)
            await expect.poll(async () => {
                return await window.evaluate(async (title) => {
                    const rows = await window.electronAPI.db.getAll('events');
                    return rows.some((row) => {
                        if (row.title === title) return String(row.starts_at || '').includes('T16:55');
                        if (!row.data_json) return false;
                        try {
                            const parsed = JSON.parse(row.data_json);
                            return parsed?.title === title && String(parsed?.starts_at || '').includes('T16:55');
                        } catch {
                            return false;
                        }
                    });
                }, eventTitle);
            }, { timeout: 20000 }).toBe(true);

            const createdEventId = await window.evaluate(async (title) => {
                const rows = await window.electronAPI.db.getAll('events');
                const match = rows.find((row) => {
                    if (row.title === title) return String(row.starts_at || '').includes('T16:55');
                    if (!row.data_json) return false;
                    try {
                        const parsed = JSON.parse(row.data_json);
                        return parsed?.title === title && String(parsed?.starts_at || '').includes('T16:55');
                    } catch {
                        return false;
                    }
                });
                return match?.id || null;
            }, eventTitle);

            expect(createdEventId).not.toBeNull();
            await window.evaluate(async (eventId) => {
                if (!window.electronAPI.db.deleteById) {
                    throw new Error('electronAPI.db.deleteById no está disponible');
                }
                await window.electronAPI.db.deleteById('events', Number(eventId));
            }, createdEventId);

            await expect.poll(async () => {
                return await window.evaluate(async (title) => {
                    const rows = await window.electronAPI.db.getAll('events');
                    return rows.some((row) => {
                        if (row.title === title) return true;
                        if (!row.data_json) return false;
                        try {
                            const parsed = JSON.parse(row.data_json);
                            return parsed?.title === title;
                        } catch {
                            return false;
                        }
                    });
                }, eventTitle);
            }, { timeout: 20000 }).toBe(false);
        } finally {
            await electronApp.close();
        }
    });
});
