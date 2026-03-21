import { test, expect } from '@playwright/test';
import { launchAndLogin, goToSection, waitForPageReady } from './helpers/electronTestUtils.js';

test.describe('Sistema de Hotkeys', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        ({ electronApp, window } = await launchAndLogin({ prefix: 'hotkeys-test' }));
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test('Navegación global mediante atajos', async () => {
        // Por defecto, Ctrl+Shift+A es Agenda (pero ya estamos ahí)
        // Probamos Ctrl+Shift+E para Expedientes (Cases)
        await window.keyboard.press('Control+Shift+E');
        await waitForPageReady(window, 'cases');

        // Ctrl+Shift+C para Clientes
        await window.keyboard.press('Control+Shift+C');
        await waitForPageReady(window, 'clients');

        // Ctrl+Shift+V para Vencimientos
        await window.keyboard.press('Control+Shift+V');
        await waitForPageReady(window, 'deadlines');

        // Ctrl+Shift+A para volver a Agenda
        await window.keyboard.press('Control+Shift+A');
        await waitForPageReady(window, 'agenda');
    });

    test('Disparadores globales de creación', async () => {
        // Ctrl+Alt+E para Nuevo Expediente (desde Agenda)
        await window.keyboard.press('Control+Alt+E');
        await waitForPageReady(window, 'cases');
        await expect(window.getByTestId('case-modal')).toBeVisible();
        await window.keyboard.press('Escape');

        // Ctrl+Alt+A para Nuevo Evento (desde Cases)
        await window.keyboard.press('Control+Alt+A');
        await waitForPageReady(window, 'agenda');
        await expect(window.getByTestId('agenda-modal')).toBeVisible();
        await window.keyboard.press('Escape');

        // Ctrl+Alt+C para Nuevo Cliente
        await window.keyboard.press('Control+Alt+C');
        await waitForPageReady(window, 'clients');
        await expect(window.getByTestId('add-client-modal')).toBeVisible();
        await window.keyboard.press('Escape');
    });

    test('Atajos contextuales y refresco', async () => {
        await goToSection(window, 'agenda');
        
        // F2 para nuevo evento contextual
        await window.keyboard.press('F2');
        await expect(window.getByTestId('agenda-modal')).toBeVisible();
        await window.keyboard.press('Escape');

        // F5 para refrescar (difícil de testear visualmente sin red, pero verificamos que no rompa nada)
        await window.keyboard.press('F5');
    });

    test('Personalización de atajos en Ajustes', async () => {
        await goToSection(window, 'sections'); // Navegamos a Ajustes > Atajos requiere pasar por sidebar
        await window.getByTestId('sidebar-nav-settings').click();
        await window.locator('#settings-tab-atajos').click();

        // Buscar el atajo de Agenda y cambiarlo
        const agendaRow = window.locator('div:has-text("Navegar a Agenda")').first();
        const agendaInput = agendaRow.locator('input');
        
        // Enfocar y presionar una nueva combinación (ej: Ctrl+G)
        await agendaInput.click();
        await window.keyboard.press('Control+g');
        
        // Verificar que el input muestra la nueva combinación
        // El input es de tipo 'text' pero manejado por recordHotkey
        await expect(agendaInput).toHaveValue(/Ctrl\+G/i);

        // Probar el nuevo atajo
        await goToSection(window, 'cases');
        await window.keyboard.press('Control+g');
        await waitForPageReady(window, 'agenda');
    });
});
