import { test, expect } from '@playwright/test';
import { ensureSectionPinned, goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

async function launchAndLoginAdmin(prefix = 'suit-categories-admin') {
    return launchAndLogin({
        prefix,
        credentials: { username: 'admin', password: 'adminadmin' },
    });
}

test.describe('Categorías — Admin', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        ({ electronApp, window } = await launchAndLoginAdmin());
        await ensureSectionPinned(window, 'categorias');
        await goToSection(window, 'categorias');
    }, 60000);

    test.afterAll(async () => {
        await electronApp?.close();
    });

    test('admin ve CRUD en Categorías y las tabs viejas desaparecen', async () => {
        await expect(window.getByTestId('categories-create-area-fueros')).toBeVisible();

        await window.getByTestId('categories-group-agenda').click();
        await expect(window.getByTestId('categories-create-area-tipos-evento')).toBeVisible();

        await window.getByTestId('categories-group-economia').click();
        await expect(window.getByTestId('categories-create-area-tipos-gasto')).toBeVisible();
        await window.getByTestId('categories-catalog-tipos-pago').click();
        await expect(window.getByTestId('categories-create-area-tipos-pago')).toBeVisible();

        await ensureSectionPinned(window, 'economia');
        await goToSection(window, 'economia');
        await expect(window.locator('#economia-tab-tiposDeGasto')).toHaveCount(0);
        await expect(window.locator('#economia-tab-tiposDePago')).toHaveCount(0);

        await ensureSectionPinned(window, 'people');
        await goToSection(window, 'people');
        await expect(window.locator('#people-tab-roles')).toHaveCount(0);

        await ensureSectionPinned(window, 'admin');
        await goToSection(window, 'admin');
        await expect(window.getByRole('button', { name: 'Usuarios' })).toBeVisible();
        await expect(window.locator('#admin-tab-eventTypes')).toHaveCount(0);
        await expect(window.locator('#admin-tab-caseTypes')).toHaveCount(0);
        await expect(window.locator('#admin-tab-radicaciones')).toHaveCount(0);
    });
});
