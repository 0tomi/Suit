import { test, expect } from '@playwright/test';
import {
    launchAndLogin,
    goToSectionFromSectionsPage,
    waitForPageReady,
} from './helpers/electronTestUtils.js';

let electronApp;
let page;

test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-eco-filters' }));
    await goToSectionFromSectionsPage(page, 'economia', { timeout: 20000 });
}, 60000);

test.afterAll(async () => {
    await electronApp?.close();
});

test.describe('Economia Filters E2E', () => {
    
    test('Filter Bar is visible in Honorarios tab', async () => {
        await page.locator('#economia-tab-honorarios').click();
        const filterBar = page.getByTestId('economia-search-input');
        await expect(filterBar).toBeVisible({ timeout: 10000 });
        
        // Verificar que el placeholder sea el correcto
        const placeholder = await filterBar.getAttribute('placeholder');
        expect(placeholder).toBe('Buscar por caso o cliente...');
    });

    test('Filter Bar is visible in Gastos tab', async () => {
        await page.locator('#economia-tab-gastos').click();
        const filterBar = page.getByTestId('economia-search-input');
        await expect(filterBar).toBeVisible({ timeout: 10000 });
        
        // Verificar que el placeholder sea el correcto para gastos
        const placeholder = await filterBar.getAttribute('placeholder');
        expect(placeholder).toBe('Buscar por caso o tipo de gasto...');
    });

    test('Status filter is visible only in Honorarios tab', async () => {
        // En Honorarios debe estar
        await page.locator('#economia-tab-honorarios').click();
        await expect(page.getByRole('combobox').filter({ hasText: 'Todos los estados' })).toBeVisible();

        // En Gastos NO debe estar (según mi implementación: showStatusFilter={false})
        await page.locator('#economia-tab-gastos').click();
        await expect(page.getByRole('combobox').filter({ hasText: 'Todos los estados' })).not.toBeVisible();
    });

    test('Sort options are present in both tabs', async () => {
        // Honorarios
        await page.locator('#economia-tab-honorarios').click();
        await expect(page.getByRole('combobox').filter({ hasText: 'Fecha' })).toBeVisible();
        
        // Gastos
        await page.locator('#economia-tab-gastos').click();
        await expect(page.getByRole('combobox').filter({ hasText: 'Fecha' })).toBeVisible();
    });

    test('Search interaction (Unitary behavior check)', async () => {
        await page.locator('#economia-tab-honorarios').click();
        const searchInput = page.getByTestId('economia-search-input');
        
        // Escribir algo que difícilmente exista para ver que la tabla reacciona (mostrando "no se encontraron")
        await searchInput.fill('NON_EXISTENT_CASE_XYZ123');
        await expect(page.getByText('No se encontraron honorarios con los filtros seleccionados.')).toBeVisible({ timeout: 5000 });
        
        // Limpiar para restaurar
        await searchInput.fill('');
    });
});
