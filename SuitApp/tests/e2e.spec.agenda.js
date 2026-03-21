import { test, expect } from '@playwright/test';
import { launchAndLogin, waitForPageReady } from './helpers/electronTestUtils.js';

test.describe('Agenda Refactoring Tests', () => {

    test('Agenda view should render orchestrator and subcomponents correctly', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            // Verify Toolbar components
            const title = window.getByTestId('page-agenda-title');
            await waitForPageReady(window, 'agenda');
            await expect(title).toBeVisible();

            // Verify there is a "Nuevo Evento" button from AgendaComponent
            const newEventBtn = window.getByTestId('agenda-new-event-button');
            await expect(newEventBtn).toBeVisible();

            // Verify Custom Toolbar buttons exist (Mes, Semana, Año)
            await expect(window.locator('button', { hasText: 'Mes' })).toBeVisible();
            await expect(window.locator('button', { hasText: 'Semana' })).toBeVisible();
            await expect(window.locator('button', { hasText: 'Año' })).toBeVisible();

            // Open Modal
            await newEventBtn.click();

            // Modal subcomponent: verify title field
            const modalTitle = window.locator('h2', { hasText: 'Nuevo Evento' });
            await expect(modalTitle).toBeVisible();

            const eventTitleInput = window.locator('input[placeholder="Ej: Audiencia..."]');
            await expect(eventTitleInput).toBeVisible();

            // Close modal
            await window.locator('.fixed.inset-0 button').first().click(); // Clic al icono X del modal

            // Verify Filter Select (Radix UI)
            const filterButton = window.locator('button[role="combobox"]').first();
            await expect(filterButton).toBeVisible();
            await filterButton.click();

            // El portal se debe abrir
            const selectContent = window.locator('[role="listbox"]');
            await expect(selectContent).toBeVisible();
            await expect(window.locator('[role="option"]', { hasText: 'Todas las agendas' })).toBeVisible();

            // Escape para cerrar el selector
            await window.keyboard.press('Escape');

            // Switch to Year view
            await window.getByText('Año').click();

            // Verifica que los meses se rendericen (AgendaYearView component)
            await expect(window.locator('h3', { hasText: 'Enero' })).toBeVisible();
            await expect(window.locator('h3', { hasText: 'Diciembre' })).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });
});
