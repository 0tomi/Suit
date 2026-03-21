import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import { ensureLoggedIn, launchAndLogin } from './helpers/electronTestUtils.js';

async function openGeneralSettings(window) {
    const settingsLink = window.getByRole('link', { name: 'Ajustes' }).first();
    await expect(settingsLink).toBeVisible({ timeout: 10000 });
    await settingsLink.click();
    await window.click('#settings-tab-general');
    await expect(window.locator('h1', { hasText: 'Configuración' })).toBeVisible();
}

async function logout(window) {
    await window.getByRole('button', { name: 'Salir' }).click();
    await expect(window.getByTestId('login-submit')).toBeVisible({ timeout: 15000 });
}

async function loginAs(window, { username, password }) {
    await ensureLoggedIn(window, { username, password });
}

async function readTableCountForProfile(window, { profileId, table }) {
    return await window.evaluate(async (payload) => {
        const previousProfile = await window.electronAPI.profiles.getActive();
        await window.electronAPI.profiles.activate(payload.profileId);

        try {
            const rows = await window.electronAPI.db.getAll(payload.table);
            return Array.isArray(rows) ? rows.length : 0;
        } finally {
            if (previousProfile?.id) {
                await window.electronAPI.profiles.activate(previousProfile.id);
            }
        }
    }, { profileId, table });
}

test.describe('Settings cache resync', () => {
    test('muestra advertencia si hay cambios pendientes antes de borrar cache', async () => {
        const { electronApp, window } = await launchAndLogin({ prefix: 'cache-resync-warning' });

        try {
            await window.evaluate(async () => {
                await window.electronAPI.db.upsertEventOutbox({
                    local_event_id: -999001,
                    remote_event_id: null,
                    event_payload_json: JSON.stringify({ title: 'Pendiente local' }),
                    notification_payload_json: null,
                    status: 'pending_event',
                    retry_count: 0,
                    last_error: null,
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                });
            });

            await openGeneralSettings(window);
            await window.getByTestId('settings-clear-cache-button').click();

            await expect(window.getByText('¿Borrar cache?')).toBeVisible();
            await expect(window.getByText(/Hay 1 cambio local pendiente de subirse/i)).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    test('resincroniza solo el perfil activo y no toca otras bases locales', async () => {
        test.setTimeout(90_000);
        const userDataDir = path.join(
            os.tmpdir(),
            `suit-test-cache-resync-${Date.now()}-${Math.random().toString(36).slice(2)}`
        );
        const fakeTitle = `Evento local-resync-${Date.now()}`;
        const credentialsA = { username: 'user', password: 'useruser' };
        const credentialsB = { username: 'test', password: 'testtest' };
        const { electronApp, window } = await launchAndLogin({
            prefix: 'cache-resync-isolation',
            userDataDir,
            credentials: credentialsA,
        });

        try {
            const profileA = await window.evaluate(async () => {
                return await window.electronAPI.profiles.getActive();
            });

            await window.evaluate(async ({ title }) => {
                const agendas = await window.electronAPI.db.getAll('agendas');
                const firstAgendaId = Number(agendas?.[0]?.id || 1);
                const now = new Date();
                const pad = (value) => String(value).padStart(2, '0');
                const startsAt = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}T10:00:00`;

                await window.electronAPI.db.upsertMany('events', [{
                    id: 987654321,
                    agenda_id: firstAgendaId,
                    suit_case_id: null,
                    event_type_id: 1,
                    title,
                    description: 'Fila local para validar el resync',
                    starts_at: startsAt,
                    is_all_day: 0,
                    data_json: JSON.stringify({
                        id: 987654321,
                        agenda_id: firstAgendaId,
                        suit_case_id: null,
                        event_type_id: 1,
                        title,
                        description: 'Fila local para validar el resync',
                        starts_at: startsAt,
                        is_all_day: 0,
                    }),
                    synced_at: new Date().toISOString(),
                }]);
            }, { title: fakeTitle });

            await logout(window);
            await loginAs(window, credentialsB);

            const profileB = await window.evaluate(async () => {
                return await window.electronAPI.profiles.getActive();
            });
            // El login deja visible Agenda antes de que termine el sync inicial del catálogo.
            // Esperamos a que el perfil B estabilice su caché local antes de tomar la línea base.
            await expect.poll(async () => {
                return await readTableCountForProfile(window, {
                    profileId: profileB.id,
                    table: 'agendas',
                });
            }, {
                timeout: 20000,
            }).toBeGreaterThan(0);
            const profileBAgendaCountBefore = await readTableCountForProfile(window, {
                profileId: profileB.id,
                table: 'agendas',
            });

            await logout(window);
            await loginAs(window, credentialsA);
            await openGeneralSettings(window);
            await window.getByTestId('settings-clear-cache-button').click();
            await window.getByRole('button', { name: 'Borrar cache' }).last().click();

            await expect(window.getByText('¡Resincronizado con exito!')).toBeVisible({ timeout: 45000 });
            await expect.poll(async () => {
                return await window.evaluate(async (title) => {
                    const events = await window.electronAPI.db.getAll('events');
                    return events.some((row) => row.title === title);
                }, fakeTitle);
            }, {
                timeout: 20000,
            }).toBe(false);

            const profileAAgendaCountAfter = await readTableCountForProfile(window, {
                profileId: profileA.id,
                table: 'agendas',
            });
            const profileBAgendaCountAfter = await readTableCountForProfile(window, {
                profileId: profileB.id,
                table: 'agendas',
            });

            expect(profileAAgendaCountAfter).toBeGreaterThan(0);
            expect(profileBAgendaCountAfter).toBe(profileBAgendaCountBefore);
        } finally {
            await electronApp.close();
        }
    });
});
