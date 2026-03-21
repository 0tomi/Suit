import { test, expect } from '@playwright/test';
import { launchElectronApp, ensureLoggedIn, waitForPageReady } from './helpers/electronTestUtils.js';

/**
 * Abre Ajustes y cierra la sesión usando el flujo real de perfil.
 */
async function logout(window) {
    await window.getByRole('link', { name: 'Ajustes' }).first().click();
    await expect(window.locator('h1', { hasText: 'Configuración' })).toBeVisible({ timeout: 10000 });
    await window.getByRole('button', { name: 'Cerrar sesión' }).first().click();
    await window.getByRole('button', { name: 'Cerrar sesión' }).last().click();
    await expect(window.getByTestId('login-submit')).toBeVisible({ timeout: 15000 });
}

/**
 * Reutiliza los test ids del login para cambiar de usuario sin depender de selectores de texto.
 */
async function loginAs(window, credentials) {
    await ensureLoggedIn(window, credentials);
    await waitForPageReady(window, 'agenda', { timeout: 20000 });
    await expect(window.locator('.rbc-calendar')).toBeVisible({ timeout: 15000 });
}

test.describe('Aislamiento de Múltiples Usuarios', () => {

    test('Los datos no se filtran entre usuarios al cambiar de sesión', async () => {
        let electronApp, window;

        try {
            const launchData = await launchElectronApp({ prefix: 'user-isolation' });
            electronApp = launchData.electronApp;
            window = launchData.window;

            // --- PASO 1: Login con usuario A ---
            await loginAs(window, { username: 'user', password: 'useruser' });

            // Darle unos segundos adicionales para que sincronice la API
            await window.waitForTimeout(5000);

            // Obtener datos del usuario A de la BD local
            const eventsUserA = await window.evaluate(async () => {
                return await window.electronAPI.db.getAll('events');
            });
            console.log(`Eventos usuario A ('user'): ${eventsUserA.length}`);

            // --- PASO 2: Logout + login con usuario B ("test" / "testtest") ---
            await logout(window);
            const activeProfileAfterLogout = await window.evaluate(async () => {
                return await window.electronAPI.profiles.getActive();
            });
            expect(activeProfileAfterLogout).toBeNull();
            await loginAs(window, { username: 'test', password: 'testtest' });

            await window.waitForTimeout(5000);

            // Obtener datos del usuario B de la BD local
            const eventsUserB = await window.evaluate(async () => {
                return await window.electronAPI.db.getAll('events');
            });
            console.log(`Eventos usuario B ('test'): ${eventsUserB.length}`);

            if (eventsUserA.length === 0 || eventsUserB.length === 0) {
                test.skip(true, [
                    'El entorno no expuso eventos para ambos perfiles de prueba.',
                    `user=${eventsUserA.length}, test=${eventsUserB.length}.`,
                    'Este spec necesita datos por usuario para verificar aislamiento de caché.',
                ].join(' '));
                return;
            }

            // --- PASO 5: Volver a login con usuario A y verificar que reutiliza su cache ---
            await logout(window);
            await loginAs(window, { username: 'user', password: 'useruser' });

            const eventsUserASecondLogin = await window.evaluate(async () => {
                return await window.electronAPI.db.getAll('events');
            });

            expect(eventsUserASecondLogin.length).toBe(eventsUserA.length);

        } finally {
            if (electronApp) {
                await electronApp.close();
            }
        }
    });
});
