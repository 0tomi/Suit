import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin, waitForPageReady } from './helpers/electronTestUtils.js';

test.describe('Cache unificado SQLite', () => {

    test('Login exitoso y Agenda muestra eventos', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            // Verificar que estamos en la página de Agenda
            await waitForPageReady(window, 'agenda', { timeout: 15000 });

            // Esperar a que la sincronización termine (el texto "Agenda General" confirma
            // que el DataContext cargó correctamente y la UI se renderizó)
            // Verificar que el calendario está presente
            await expect(window.locator('.rbc-calendar')).toBeVisible({ timeout: 15000 });

        } finally {
            await electronApp.close();
        }
    });

    test('Navegación a Clientes muestra datos', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            // Navegar a la sección de Clientes via sidebar
            await goToSection(window, 'clients', { timeout: 15000 });

            // Verificar que hay al menos un cliente en la tabla
            // (el usuario indicó que hay un único cliente disponible)
            await expect(window.locator('table tbody tr').first()).toBeVisible({ timeout: 15000 });

        } finally {
            await electronApp.close();
        }
    });

    test('localStorage no contiene claves suit_cache_*', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            await waitForPageReady(window, 'agenda', { timeout: 15000 });
            // Esperar a que la sincronización termine
            await window.waitForTimeout(5000);

            // Verificar que no hay claves suit_cache_* en localStorage
            const cacheKeys = await window.evaluate(() => {
                const keys = [];
                for (let i = 0; i < localStorage.length; i++) {
                    const key = localStorage.key(i);
                    if (key && key.startsWith('suit_cache_')) {
                        keys.push(key);
                    }
                }
                return keys;
            });

            expect(cacheKeys).toEqual([]);

        } finally {
            await electronApp.close();
        }
    });
});
