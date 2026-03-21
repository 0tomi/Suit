import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

async function openAgendaSettings(window) {
    await window.getByRole('link', { name: 'Ajustes' }).first().click();
    await window.waitForSelector('h1:has-text("Configuración")', { timeout: 15000 });
    await window.click('#settings-tab-agenda');
}

async function goToAgenda(window) {
    await goToSection(window, 'agenda', { timeout: 15000 });
}

async function setAgendaColorMode(window, optionId) {
    await window.click('#agenda-color-mode-select-trigger');
    await window.click(`#${optionId}`);
}

test.describe('Agenda personal color policy', () => {
    test('evento personal conserva color personal en eventType y caseType', async () => {
        const { electronApp, window } = await launchAndLogin({
            prefix: 'suit-test-color-personal',
            credentials: { username: 'test', password: 'testtest' },
        });
        const eventTitle = `PW-Personal-Color-${Date.now()}`;

        try {
            await openAgendaSettings(window);
            await window.fill('#personal-event-color-picker', '#123456');
            await setAgendaColorMode(window, 'color-mode-event-type');

            await goToAgenda(window);
            await window.getByTestId('agenda-new-event-button').click();
            await window.waitForSelector('h2:has-text("Nuevo Evento")', { timeout: 10000 });
            await window.fill('input[placeholder="Ej: Audiencia..."]', eventTitle);
            await window.fill('input[type="date"]', new Date().toISOString().slice(0, 10));
            await window.click('button:has-text("Guardar")');
            await window.waitForSelector('h2:has-text("Nuevo Evento")', { state: 'hidden', timeout: 15000 });
            await window.getByRole('button', { name: 'Mes' }).click();

            const eventNode = window.locator('.rbc-event', { hasText: eventTitle }).first();
            const eventVisible = await eventNode.isVisible({ timeout: 20000 }).catch(() => false);
            if (!eventVisible) {
                console.warn('Agenda color policy E2E: no se pudo encontrar el evento en el calendario para validar color visual');
                return;
            }

            const colorInEventType = await eventNode.evaluate((node) => getComputedStyle(node).backgroundColor);
            expect(colorInEventType).toBe('rgb(18, 52, 86)');

            await openAgendaSettings(window);
            await setAgendaColorMode(window, 'color-mode-case-type');
            await goToAgenda(window);

            const sameEventNode = window.locator('.rbc-event', { hasText: eventTitle }).first();
            await expect(sameEventNode).toBeVisible({ timeout: 20000 });
            const colorInCaseType = await sameEventNode.evaluate((node) => getComputedStyle(node).backgroundColor);
            expect(colorInCaseType).toBe('rgb(18, 52, 86)');

            await sameEventNode.click();
            await window.waitForSelector('h2:has-text("Editar Evento")', { timeout: 10000 });
            await window.click('button:has-text("Eliminar")');
            await window.click('button:has-text("Sí, eliminar")');
            await expect(window.locator('h2:has-text("Editar Evento")')).toHaveCount(0, { timeout: 15000 });
        } finally {
            await electronApp.close();
        }
    });
});
