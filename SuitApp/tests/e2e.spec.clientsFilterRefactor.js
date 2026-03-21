import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Clients page – FilterBar refactor', () => {

    test('shows filter bar with sort controls and no status column', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            window.on('console', msg => console.log('PAGE LOG:', msg.text()));

            // Navegar a Clientes
            await goToSection(window, 'clients', { timeout: 15000 });

            // El FilterBar debe estar visible con el search input correcto
            const searchInput = window.locator('input[placeholder="Buscar por nombre, DNI o email..."]');
            await expect(searchInput).toBeVisible();

            // El selector de ordenamiento debe existir con las opciones
            const sortSelect = window.locator('select').first();
            await expect(sortSelect).toBeVisible();
            await expect(sortSelect.locator('option[value="created_at"]')).toHaveCount(1);
            await expect(sortSelect.locator('option[value="alpha"]')).toHaveCount(1);

            // El botón de dirección de orden debe existir
            const sortBtn = window.locator('button[title*="primero"]');
            await expect(sortBtn).toBeVisible();

            // La columna "Estado" NO debe aparecer en la cabecera
            const estadoHeader = window.locator('th', { hasText: 'Estado' });
            await expect(estadoHeader).toHaveCount(0);

            await window.screenshot({ path: path.join(__dirname, 'clients_filterbar_no_status.png') });

        } catch (e) {
            await window.screenshot({ path: path.join(__dirname, 'clients_filterbar_error.png') });
            throw e;
        } finally {
            await electronApp.close();
        }
    });

    test('shows N clientes encontrados when searching', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            await goToSection(window, 'clients', { timeout: 15000 });

            // Esperar que carguen los clientes
            await window.waitForTimeout(2000);

            const searchInput = window.locator('input[placeholder="Buscar por nombre, DNI o email..."]');
            await searchInput.fill('a');

            // El contador de resultados debe aparecer
            const counter = window.locator('p').filter({ hasText: /cliente[s]? encontrado[s]?/ });
            await expect(counter).toBeVisible({ timeout: 5000 });

            await window.screenshot({ path: path.join(__dirname, 'clients_result_count.png') });

        } catch (e) {
            await window.screenshot({ path: path.join(__dirname, 'clients_result_count_error.png') });
            throw e;
        } finally {
            await electronApp.close();
        }
    });

    test('sort order toggle changes direction', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            await goToSection(window, 'clients', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Click en el botón de dirección para cambiar a asc
            const sortBtn = window.locator('button[title*="primero"]');
            const titleBefore = await sortBtn.getAttribute('title');
            await sortBtn.click();
            const titleAfter = await sortBtn.getAttribute('title');

            expect(titleBefore).not.toEqual(titleAfter);

            await window.screenshot({ path: path.join(__dirname, 'clients_sort_toggle.png') });

        } catch (e) {
            await window.screenshot({ path: path.join(__dirname, 'clients_sort_toggle_error.png') });
            throw e;
        } finally {
            await electronApp.close();
        }
    });

    test('client detail header does not show status text', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            await goToSection(window, 'clients', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Hacer click en el primer cliente de la lista
            const firstRow = window.locator('table tbody tr').first();
            await expect(firstRow).toBeVisible({ timeout: 5000 });
            await firstRow.click();

            // Esperar que cargue el detalle
            await window.waitForTimeout(2000);

            // El encabezado no debe contener "Activo" como texto de estado
            const statusText = window.locator('p').filter({ hasText: /• Activo|• Inactivo|• Deudor/ });
            await expect(statusText).toHaveCount(0);

            await window.screenshot({ path: path.join(__dirname, 'client_detail_no_status.png') });

        } catch (e) {
            await window.screenshot({ path: path.join(__dirname, 'client_detail_no_status_error.png') });
            throw e;
        } finally {
            await electronApp.close();
        }
    });

});
