import { test, expect } from '@playwright/test';
import path from 'path';
import os from 'os';
import { goToSection, launchAndLogin as launchAndLoginHelper } from './helpers/electronTestUtils.js';

async function launchAndLogin(userDataDir = path.join(os.tmpdir(), `suit-test-settings-${Date.now()}-${Math.random().toString(36).substring(2)}`)) {
    return launchAndLoginHelper({ userDataDir });
}

async function openSettings(window) {
    const settingsLink = window.getByRole('link', { name: 'Ajustes' }).first();
    await expect(settingsLink).toBeVisible({ timeout: 10000 });
    await settingsLink.click();
    await window.waitForSelector('h1:has-text("Configuración")', { timeout: 10000 });
}

async function openGeneralSettings(window) {
    await openSettings(window);
    await window.click('#settings-tab-general');
}

async function openAgendaSettings(window) {
    await openSettings(window);
    await window.click('#settings-tab-agenda');
}

async function goToAgenda(window) {
    await goToSection(window, 'agenda', { timeout: 10000 });
}

async function setSidebarMode(window, modeOptionId) {
    await window.click('#sidebar-mode-select-trigger');
    await window.click(`#${modeOptionId}`);
}

async function setSidebarAnimationSpeed(window, speedOptionId) {
    await window.click('#sidebar-animation-speed-select-trigger');
    await window.click(`#${speedOptionId}`);
}

async function setAgendaColorMode(window, optionId) {
    await window.click('#agenda-color-mode-select-trigger');
    await window.click(`#${optionId}`);
}

test.describe('Settings Page and Agenda Colors', () => {

    test('Sidebar has settings link and no dark mode toggle', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            // Dark mode toggle should no longer be in sidebar
            const darkModeBtn = window.locator('button', { hasText: 'Modo oscuro' });
            await expect(darkModeBtn).not.toBeVisible();

            // Settings navlink should be visible in the sidebar
            const settingsLink = window.locator('a[href="/settings"], a[href="#/settings"]');
            await expect(settingsLink.first()).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    test('Settings page renders General and Agenda sections and sidebar settings selects', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openGeneralSettings(window);

            // Verify page heading
            const heading = window.locator('h1', { hasText: 'Configuración' });
            await expect(heading).toBeVisible();

            // Verify General tab button
            const generalTab = window.locator('#settings-tab-general');
            await expect(generalTab).toBeVisible();
            await generalTab.click();

            // Verify dark mode toggle exists
            const darkModeToggle = window.locator('#toggle-dark-mode');
            await expect(darkModeToggle).toBeVisible();

            const sidebarModeSelect = window.locator('#sidebar-mode-select-trigger');
            const animationSpeedSelect = window.locator('#sidebar-animation-speed-select-trigger');
            await expect(sidebarModeSelect).toBeVisible();
            await expect(animationSpeedSelect).toBeVisible();

            await sidebarModeSelect.click();
            await expect(window.locator('#sidebar-mode-option-hover')).toBeVisible();
            await expect(window.locator('#sidebar-mode-option-click')).toBeVisible();
            await expect(window.locator('#sidebar-mode-option-always-open')).toBeVisible();
            await expect(window.locator('#sidebar-mode-option-always-closed')).toBeVisible();
            await window.click('#sidebar-mode-option-hover');

            await animationSpeedSelect.click();
            await expect(window.locator('#sidebar-animation-speed-option-x1')).toBeVisible();
            await expect(window.locator('#sidebar-animation-speed-option-x0-5')).toBeVisible();
            await expect(window.locator('#sidebar-animation-speed-option-x0')).toBeVisible();
            await window.click('#sidebar-animation-speed-option-x1');

            // Verify Agenda tab button
            const agendaTab = window.locator('#settings-tab-agenda');
            await expect(agendaTab).toBeVisible();
            await agendaTab.click();

            await expect(window.locator('text=Notificacion predeterminada al crear un evento')).toBeVisible();

            const agendaColorModeSelect = window.locator('#agenda-color-mode-select-trigger');
            await expect(agendaColorModeSelect).toBeVisible();
            await agendaColorModeSelect.click();
            await expect(window.locator('#color-mode-event-type')).toBeVisible();
            await expect(window.locator('#color-mode-case-type')).toBeVisible();
            await window.click('#color-mode-event-type');

            // Verifica que el select de notificacion predeterminada permita opcion "No"
            const defaultNotificationSelect = window.locator('select').first();
            await expect(defaultNotificationSelect).toBeVisible();
            await defaultNotificationSelect.selectOption('off');
            await expect(defaultNotificationSelect).toHaveValue('off');

            // "Por Tipo de Evento" should be selected by default
            await expect(agendaColorModeSelect).toContainText('Por Tipo de Evento');
        } finally {
            await electronApp.close();
        }
    });

    test('Dark mode toggle works from Settings page', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openGeneralSettings(window);

            // Check initial state
            const htmlEl = window.locator('html');
            const initialClass = await htmlEl.getAttribute('class');
            const wasAlreadyDark = initialClass?.includes('dark') ?? false;

            // Toggle dark mode
            await window.click('#toggle-dark-mode');
            await window.waitForTimeout(300);

            const newClass = await htmlEl.getAttribute('class');
            if (wasAlreadyDark) {
                expect(newClass).not.toContain('dark');
            } else {
                expect(newClass).toContain('dark');
            }

            // Toggle back
            await window.click('#toggle-dark-mode');
            await window.waitForTimeout(300);
            const finalClass = await htmlEl.getAttribute('class');
            expect(finalClass?.includes('dark')).toBe(wasAlreadyDark);
        } finally {
            await electronApp.close();
        }
    });

    test('Color mode preference persists after re-render', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openAgendaSettings(window);

            // Switch to "Por Tipo de Caso"
            await setAgendaColorMode(window, 'color-mode-case-type');
            await window.waitForTimeout(300);

            // Should now show caseType selected
            await expect(window.locator('#agenda-color-mode-select-trigger')).toContainText('Por Tipo de Caso');

            // Navigate away and come back
            await goToAgenda(window);
            await openAgendaSettings(window);

            // Preference should persist
            await expect(window.locator('#agenda-color-mode-select-trigger')).toContainText('Por Tipo de Caso');

            // Reset back to eventType for other tests
            await setAgendaColorMode(window, 'color-mode-event-type');
        } finally {
            await electronApp.close();
        }
    });

    test('Agenda renders events without crash after color mode changes', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            // Navigate to Agenda
            await goToAgenda(window);
            const agendaH1 = window.locator('h1', { hasText: 'Agenda General' });

            // Calendar should render
            await expect(window.locator('.rbc-calendar, .custom-calendar')).toBeVisible();

            // Go to Settings, change color mode
            await openAgendaSettings(window);
            await setAgendaColorMode(window, 'color-mode-case-type');
            await window.waitForTimeout(300);

            // Go back to Agenda — should still render without errors
            await goToAgenda(window);
            await expect(agendaH1).toBeVisible();
            await expect(window.locator('.rbc-calendar, .custom-calendar')).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    test('Hover mode collapses and expands on mouse hover', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openGeneralSettings(window);
            await setSidebarMode(window, 'sidebar-mode-option-hover');
            await goToAgenda(window);

            const sidebar = window.locator('#app-sidebar');
            await window.mouse.move(500, 300);
            await expect(sidebar).toHaveAttribute('data-expanded', 'false');

            await sidebar.hover();
            await expect(sidebar).toHaveAttribute('data-expanded', 'true');

            await window.mouse.move(500, 300);
            await expect(sidebar).toHaveAttribute('data-expanded', 'false');
        } finally {
            await electronApp.close();
        }
    });

    test('Click mode starts collapsed and toggles with icon', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openGeneralSettings(window);
            await setSidebarMode(window, 'sidebar-mode-option-click');
            await goToAgenda(window);

            const sidebar = window.locator('#app-sidebar');
            await expect(sidebar).toHaveAttribute('data-expanded', 'false');

            const toggle = window.locator('#sidebar-click-toggle');
            await expect(toggle).toBeVisible();
            await toggle.click();
            await expect(sidebar).toHaveAttribute('data-expanded', 'true');
            await expect(toggle).toContainText('Contraer');

            await toggle.click();
            await expect(sidebar).toHaveAttribute('data-expanded', 'false');
        } finally {
            await electronApp.close();
        }
    });

    test('Always open and always closed modes force sidebar state', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openGeneralSettings(window);

            const sidebar = window.locator('#app-sidebar');
            await setSidebarMode(window, 'sidebar-mode-option-always-open');
            await goToAgenda(window);
            await window.mouse.move(500, 300);
            await expect(sidebar).toHaveAttribute('data-expanded', 'true');

            await openGeneralSettings(window);
            await setSidebarMode(window, 'sidebar-mode-option-always-closed');
            await goToAgenda(window);
            await expect(sidebar).toHaveAttribute('data-expanded', 'false');
            await expect(window.locator('#sidebar-click-toggle')).toHaveCount(0);
            await expect(window.locator('button[aria-label="Servidor conectado"], button[aria-label="Sin conexión"]')).toHaveCount(0);

            const collapsedBadges = window.locator('[data-testid="sidebar-bell-badge-collapsed"]');
            const collapsedBadgesCount = await collapsedBadges.count();
            expect(collapsedBadgesCount).toBeLessThanOrEqual(1);
            if (collapsedBadgesCount === 1) {
                await expect(window.locator('#sidebar-missed-button [data-testid="sidebar-bell-badge-collapsed"]')).toBeVisible();
            }
        } finally {
            await electronApp.close();
        }
    });

    test('Sidebar mode persists after restart and click mode starts collapsed', async () => {
        const userDataDir = path.join(os.tmpdir(), `suit-test-settings-persist-${Date.now()}-${Math.random().toString(36).substring(2)}`);
        const firstRun = await launchAndLogin(userDataDir);
        try {
            await openGeneralSettings(firstRun.window);
            await setSidebarMode(firstRun.window, 'sidebar-mode-option-click');
        } finally {
            await firstRun.electronApp.close();
        }

        const secondRun = await launchAndLogin(userDataDir);
        try {
            await openGeneralSettings(secondRun.window);
            await expect(secondRun.window.locator('#sidebar-mode-select-trigger')).toContainText('Abrir al clickear icono');
            await goToAgenda(secondRun.window);
            await expect(secondRun.window.locator('#app-sidebar')).toHaveAttribute('data-expanded', 'false');
        } finally {
            await secondRun.electronApp.close();
        }
    });

    test('Sidebar animation speed is configurable and persists', async () => {
        const userDataDir = path.join(os.tmpdir(), `suit-test-sidebar-animation-${Date.now()}-${Math.random().toString(36).substring(2)}`);
        const firstRun = await launchAndLogin(userDataDir);
        try {
            await openGeneralSettings(firstRun.window);
            await setSidebarAnimationSpeed(firstRun.window, 'sidebar-animation-speed-option-x0');
            await expect(firstRun.window.locator('#sidebar-animation-speed-select-trigger')).toContainText('x0 (Sin animación)');
        } finally {
            await firstRun.electronApp.close();
        }

        const secondRun = await launchAndLogin(userDataDir);
        try {
            await goToAgenda(secondRun.window);
            await expect(secondRun.window.locator('#app-sidebar')).toHaveAttribute('data-animation-speed', 'x0');
            await openGeneralSettings(secondRun.window);
            await expect(secondRun.window.locator('#sidebar-animation-speed-select-trigger')).toContainText('x0 (Sin animación)');
        } finally {
            await secondRun.electronApp.close();
        }
    });
});
