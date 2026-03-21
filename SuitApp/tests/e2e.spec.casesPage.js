import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

test.describe('Página de Casos — Mejoras UI y Filtros', () => {

    test('Tabla de casos: estructura de columnas correcta', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            // Navegar a la sección de Casos
            await goToSection(window, 'cases', { timeout: 15000 });

            // Esperar a que la tabla cargue (al menos el thead)
            const thead = window.locator('table thead tr th');
            await thead.first().waitFor({ timeout: 15000 });

            // Obtener los headers de la tabla
            const headers = await thead.allTextContents();

            // ✅ No debe haber columna "ID"
            expect(headers.some(h => h.trim() === 'ID')).toBe(false);

            // ✅ Debe existir columna "Carátula"
            expect(headers.some(h => h.trim() === 'Carátula')).toBe(true);

            // ✅ Debe existir columna "Categoría"
            expect(headers.some(h => h.trim() === 'Categoría')).toBe(true);

            // ✅ No debe haber ícono de balanza (Scale) en las filas
            const scaleIcons = window.locator('table tbody [data-lucide="scale"]');
            expect(await scaleIcons.count()).toBe(0);

        } finally {
            await electronApp.close();
        }
    });

    test('Casos activos carga solo activos por default', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            await goToSection(window, 'cases', { timeout: 15000 });

            // Esperar a que la tabla cargue
            await window.waitForTimeout(3000);

            // El filtro de estado por default es "Activos"
            const statusSelect = window.getByTestId('cases-filter-status');
            await expect(statusSelect).toHaveValue('Activo');

            // Las filas visibles deben ser activas (no debe haber badges "Finalizado" visibles)
            const finalizadoBadges = window.locator('table tbody').getByText('Finalizado');
            expect(await finalizadoBadges.count()).toBe(0);

        } finally {
            await electronApp.close();
        }
    });

    test('Al seleccionar Finalizados se intenta cargar los casos cerrados', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            await goToSection(window, 'cases', { timeout: 15000 });

            // Esperar a que la carga inicial termine
            await window.waitForTimeout(2000);

            // Cambiar el filtro de estado a "Finalizados"
            const statusSelect = window.getByTestId('cases-filter-status');
            await statusSelect.selectOption('Finalizado');

            // Esperar a que la carga del API termine (skeleton desaparece)
            await window.waitForTimeout(4000);

            // Verificar que el skeleton desapareció (no hay filas con animate-pulse)
            const skeletonRows = window.locator('table tbody tr.animate-pulse');
            expect(await skeletonRows.count()).toBe(0);

            // Si hay casos cerrados, deben tener badge "Finalizado".
            // Si no hay, la tabla muestra el mensaje vacío. Ambos son válidos.
            const emptyMsg = window.locator('text=No se encontraron casos');
            const finalizadoBadges = window.locator('table tbody').getByText('Finalizado');
            const hasEmpty = await emptyMsg.isVisible();
            const hasFinished = await finalizadoBadges.count() > 0;
            expect(hasEmpty || hasFinished).toBe(true);

        } finally {
            await electronApp.close();
        }
    });

    test('Filtros de ordenamiento existen y son funcionales', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            await goToSection(window, 'cases', { timeout: 15000 });

            // Esperar carga
            await window.waitForTimeout(3000);

            // El selector de "Ordenar por" debe existir
            const sortSelect = window.getByTestId('cases-filter-sort-by');
            await expect(sortSelect).toBeVisible();

            // Cambiar a "Fecha de inicio"
            await sortSelect.selectOption('start_date');
            await expect(sortSelect).toHaveValue('start_date');

            // El botón toggle de dirección debe existir
            const directionBtn = window.getByTestId('cases-filter-sort-order');
            await expect(directionBtn).toBeVisible();

            // Click en el toggle y verifica que cambia
            await directionBtn.click();
            const newTitle = await directionBtn.getAttribute('title');
            expect(newTitle).toContain('primero');

        } finally {
            await electronApp.close();
        }
    });

    test('Contador de resultados visible al buscar', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            await goToSection(window, 'cases', { timeout: 15000 });
            await window.waitForTimeout(3000);

            // Sin búsqueda activa, el contador NO debe verse
            const counter = window.locator('text=/\\d+ caso[s]? encontrado[s]?/');
            expect(await counter.isVisible()).toBe(false);

            // Escribir algo en el buscador
            const searchInput = window.getByTestId('cases-search-input');
            await searchInput.fill('a');
            await window.waitForTimeout(500);

            // Ahora el contador SÍ debe aparecer
            await expect(counter).toBeVisible({ timeout: 3000 });

        } finally {
            await electronApp.close();
        }
    });

    test('Memoria de filtros: el statusFilter se restaura al volver', async () => {
        const { electronApp, window } = await launchAndLogin({ prefix: 'suit-filter-memory' });

        try {
            await goToSection(window, 'cases', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Cambiar el filtro de estado a "Todos"
            await window.getByTestId('cases-filter-status').selectOption('all');
            await window.waitForTimeout(1000);

            // Navegar a otra sección y volver
            await goToSection(window, 'agenda', { timeout: 10000 });
            await goToSection(window, 'cases', { timeout: 10000 });
            await window.waitForTimeout(2000);

            // El filtro debe recordar "Todos"
            await expect(window.getByTestId('cases-filter-status')).toHaveValue('all');

        } finally {
            await electronApp.close();
        }
    });

});
