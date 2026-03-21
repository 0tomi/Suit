import { test, expect } from '@playwright/test';
import { ensureSectionPinned, goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

test.describe('Categorías — Solo lectura', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        ({ electronApp, window } = await launchAndLogin({ prefix: 'suit-categories-user' }));
        await ensureSectionPinned(window, 'categorias');
        await goToSection(window, 'categorias');
    }, 60000);

    test.afterAll(async () => {
        await electronApp?.close();
    });

    test('usuario no admin puede consultar categorías sin ver CRUD', async () => {
        await expect(window.getByTestId('page-categorias-title')).toBeVisible();
        await expect(window.getByTestId('categories-group-casos')).toBeVisible();
        await expect(window.getByTestId('categories-group-agenda')).toBeVisible();
        await expect(window.getByTestId('categories-group-economia')).toBeVisible();

        await expect(window.getByTestId('categories-section-fueros')).toBeVisible();
        await expect(window.getByText('Solo lectura')).toBeVisible();
        await expect(window.getByTestId('categories-create-area-fueros')).toHaveCount(0);

        await window.getByTestId('categories-group-agenda').click();
        await expect(window.getByTestId('categories-section-tipos-evento')).toBeVisible();
        await expect(window.getByTestId('categories-create-area-tipos-evento')).toHaveCount(0);
    });
});
