import { test, expect } from '@playwright/test';
import { launchAndLogin, waitForPageReady } from './helpers/electronTestUtils';

test.describe('Atajo de navegación a Modelos', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        ({ electronApp, window } = await launchAndLogin({ prefix: 'templates-hotkey' }));
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test('debe navegar a la galería de modelos al presionar la tecla M', async () => {
        // Aseguramos que estamos en otra página (Agenda por defecto tras login)
        await waitForPageReady(window, 'agenda');

        // Presionamos la tecla 'm'
        await window.keyboard.press('m');

        // Verificamos que navegó a Modelos
        await waitForPageReady(window, 'templates');
        
        const title = window.getByTestId('page-templates-title');
        await expect(title).toBeVisible();
        await expect(title).toContainText('Galería de Modelos');
    });

    test('debe aparecer el atajo en la configuración de atajos', async () => {
        // Navegamos a configuración
        await window.getByTestId('sidebar-nav-settings').click();
        
        // Vamos a la pestaña de Atajos
        // Nota: En Settings.jsx, los tabs de categorías se renderizan con CATEGORIES.map
        // y el id es el id de la categoría.
        const hotkeysTab = window.locator('button').filter({ hasText: 'Atajos' });
        await hotkeysTab.click();

        // Buscamos el atajo "Ir a Modelos"
        const hotkeyRow = window.locator('div').filter({ hasText: 'Ir a Modelos' }).last();
        await expect(hotkeyRow).toBeVisible();
        
        // Verificamos que el valor inicial sea M
        const recorderButton = hotkeyRow.locator('button');
        await expect(recorderButton).toContainText('M');
    });
});
