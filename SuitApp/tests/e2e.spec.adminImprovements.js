import { test, expect } from '@playwright/test';
import {
    ensureSectionPinned,
    goToSection,
    launchAndLogin as launchAndLoginHelper,
} from './helpers/electronTestUtils.js';
import { createE2ETestDiagnostics } from './helpers/e2eDiagnostics.js';

/**
 * Feature: mejoras de administración
 * Hipótesis cubiertas:
 * - H1: si el admin entra al panel, ve el panel simplificado y puede abrir la edición de usuarios.
 * - H2: si el admin navega a Modelos, puede abrir el modal para crear categoría.
 * - H3: si el admin abre la edición de un usuario, puede iniciar un cambio de contraseña
 *   y la UI bloquea inputs inválidos antes de tocar el backend.
 *
 * Riesgo cubierto:
 * - Regresión de navegación sobre secciones no pinneadas por default.
 * - Timeouts silenciosos en flujos de Admin/Modelos dentro de Electron.
 * - Pérdida de validación visible en el flujo de cambio de contraseña.
 */

async function launchAndLoginAdmin(prefix = 'suit-admin-improvements') {
    return launchAndLoginHelper({
        prefix,
        credentials: { username: 'admin', password: 'adminadmin' },
    });
}

const ROLE_VALUE_BY_LABEL = {
    Admin: 'admin',
    Abogado: 'lawyer',
    Usuario: 'user',
};

test.describe('Admin improvements', () => {
    test.setTimeout(45_000);

    let diagnostics = null;
    let electronApp = null;
    let window = null;

    test.afterEach(async ({ browserName }, testInfo) => {
        void browserName;

        if (diagnostics) {
            await diagnostics.finalize();
            diagnostics = null;
        }

        if (electronApp) {
            await electronApp.close().catch(() => null);
            electronApp = null;
            window = null;
        }

        await testInfo.attach('admin-timeout-budget', {
            body: JSON.stringify({ timeoutMs: testInfo.timeout }, null, 2),
            contentType: 'application/json',
        });
    });

    test('panel admin concentra usuarios y ya no expone tabs de catálogos movidas', async ({ browserName }, testInfo) => {
        void browserName;
        ({ electronApp, window } = await launchAndLoginAdmin('suit-admin-panel'));
        diagnostics = createE2ETestDiagnostics({
            window,
            testInfo,
            featureTag: 'admin-test',
        });
        await diagnostics.init();

        let userRows = null;
        let targetRow = null;
        let expectedTag = '';
        let expectedName = '';
        let expectedRoleValue = '';
        let expectedEmail = '';

        await diagnostics.runStep('pin-admin-section', async () => {
            await ensureSectionPinned(window, 'admin');
        });

        await diagnostics.runStep('open-admin-panel', async () => {
            await goToSection(window, 'admin');
        });

        await diagnostics.runStep('assert-admin-tabs', async () => {
            await expect(window.getByRole('button', { name: 'Usuarios' })).toBeVisible();
            await expect(window.locator('#admin-tab-eventTypes')).toHaveCount(0);
            await expect(window.locator('#admin-tab-caseTypes')).toHaveCount(0);
            await expect(window.locator('#admin-tab-radicaciones')).toHaveCount(0);
            await expect(window.getByRole('button', { name: 'Partes' })).toHaveCount(0);
        });

        await diagnostics.runStep('open-users-tab', async () => {
            await window.getByRole('button', { name: 'Usuarios' }).click();
            await expect(window.locator('h2', { hasText: 'Gestión de Usuarios' })).toBeVisible();
            await expect(window.locator('#admin-users-create-button')).toBeVisible();
        });

        await diagnostics.runStep('wait-for-user-row', async () => {
            userRows = window.locator('tbody tr').filter({
                has: window.getByTitle('Editar usuario'),
            });
            await expect(userRows.first()).toBeVisible({ timeout: 15000 });
        });

        await diagnostics.runStep('capture-row-values', async () => {
            targetRow = userRows.first();
            const cells = targetRow.locator('td');
            const expectedRoleLabel = (await cells.nth(2).textContent())?.trim() || '';
            const expectedEmailText = (await cells.nth(3).textContent())?.trim() || '';

            expectedTag = (await cells.nth(0).textContent())?.trim() || '';
            expectedName = (await cells.nth(1).textContent())?.trim() || '';
            expectedRoleValue = ROLE_VALUE_BY_LABEL[expectedRoleLabel] || '';
            expectedEmail = expectedEmailText === '—' ? '' : expectedEmailText;
        });

        await diagnostics.runStep('open-edit-user-modal', async () => {
            await targetRow.getByTitle('Editar usuario').click();
            await expect(window.locator('h2', { hasText: `Editar Usuario: ${expectedTag}` })).toBeVisible();
        });

        await diagnostics.runStep('assert-edit-user-values', async () => {
            await expect(window.getByLabel('Tag *')).toHaveValue(expectedTag);
            await expect(window.getByLabel('Nombre *')).toHaveValue(expectedName);
            await expect(window.getByLabel('Email (opcional)')).toHaveValue(expectedEmail);

            if (expectedRoleValue) {
                await expect(window.getByLabel('Rol *')).toHaveValue(expectedRoleValue);
            }
        });
    });

    test('edicion de usuario expone cambio de contraseña y valida errores locales', async ({ browserName }, testInfo) => {
        void browserName;
        ({ electronApp, window } = await launchAndLoginAdmin('suit-admin-password'));
        diagnostics = createE2ETestDiagnostics({
            window,
            testInfo,
            featureTag: 'admin-test',
        });
        await diagnostics.init();

        let userRows = null;
        let targetRow = null;

        await diagnostics.runStep('open-admin-panel', async () => {
            await goToSection(window, 'admin');
            await window.getByRole('button', { name: 'Usuarios' }).click();
            await expect(window.locator('h2', { hasText: 'Gestión de Usuarios' })).toBeVisible();
        });

        await diagnostics.runStep('open-first-edit-user-modal', async () => {
            userRows = window.locator('tbody tr').filter({
                has: window.getByTitle('Editar usuario'),
            });
            await expect(userRows.first()).toBeVisible({ timeout: 15000 });
            targetRow = userRows.first();
            await targetRow.getByTitle('Editar usuario').click();
            await expect(window.getByLabel('Nueva contraseña (opcional)')).toBeVisible();
            await expect(window.getByLabel('Confirmar nueva contraseña')).toBeVisible();
            await expect(window.getByText('Si dejas ambos campos vacios, la contraseña actual del usuario no se modifica.')).toBeVisible();
        });

        await diagnostics.runStep('assert-short-password-validation', async () => {
            await window.getByLabel('Nueva contraseña (opcional)').fill('corta');
            await window.getByLabel('Confirmar nueva contraseña').fill('corta');
            await window.getByRole('button', { name: 'Guardar cambios' }).click();

            await expect(window.getByText('La nueva contraseña debe tener al menos 8 caracteres.')).toBeVisible();
            await expect(window.locator('h2', { hasText: 'Editar Usuario:' })).toBeVisible();
        });

        await diagnostics.runStep('assert-password-confirmation-validation', async () => {
            await window.getByLabel('Nueva contraseña (opcional)').fill('nuevaClave9');
            await window.getByLabel('Confirmar nueva contraseña').fill('otraClave9');
            await window.getByRole('button', { name: 'Guardar cambios' }).click();

            await expect(window.getByText('La confirmación de la contraseña no coincide.')).toBeVisible();
            await expect(window.locator('h2', { hasText: 'Editar Usuario:' })).toBeVisible();
        });
    });

    test('modelos expone boton admin para crear categoria y abre modal', async ({ browserName }, testInfo) => {
        void browserName;
        ({ electronApp, window } = await launchAndLoginAdmin('suit-admin-templates'));
        diagnostics = createE2ETestDiagnostics({
            window,
            testInfo,
            featureTag: 'admin-test',
        });
        await diagnostics.init();

        await diagnostics.runStep('pin-templates-section', async () => {
            await ensureSectionPinned(window, 'templates');
        });

        await diagnostics.runStep('open-templates-gallery', async () => {
            await goToSection(window, 'templates');
        });

        await diagnostics.runStep('open-create-category-modal', async () => {
            const createCategoryBtn = window.getByRole('button', { name: /Nueva Categ/i }).first();
            await expect(createCategoryBtn).toBeVisible();
            await createCategoryBtn.click();

            await expect(window.locator('h2')).toContainText(/Crear categor/i);
            await expect(window.locator('#template-category-form')).toBeVisible();
        });
    });
});
