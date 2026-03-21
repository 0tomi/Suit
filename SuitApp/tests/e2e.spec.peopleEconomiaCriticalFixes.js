/**
 * e2e.spec.peopleEconomiaCriticalFixes.js
 *
 * Tests de regresión para los fixes críticos resueltos:
 *   - INFRA-1: Input, Label, Select, DateRangePicker faltantes en ui/
 *   - CAS-1/2/3: imports y destructuring incorrectos en NewCaseForm
 *   - ECO-1: DateRangePicker inexistente → crash al abrir Economía
 *   - PAR-1/2: usePartes destructuring + botón "Nueva Parte" inoperante
 *   - ROL-1: useRoles destructuring incorrecto en RolesTab
 *
 * Navegación: usa ensureSectionPinned + goToSection (nunca hash directo).
 * Diseño: una sola instancia de Electron por describe para evitar el costo
 * de startup (~35s) por test. El timeout global en playwright.config.js es
 * 90s, lo que cubre launchAndLogin + navegación dentro de beforeAll.
 */

import { test, expect } from '@playwright/test';
import {
    launchAndLogin,
    goToSection,
    ensureSectionPinned,
} from './helpers/electronTestUtils.js';

// ---------------------------------------------------------------------------
// PERSONAS — PARTES
// ---------------------------------------------------------------------------

test.describe('Personas — Sección Partes (fixes de destructuring)', () => {

    let electronApp;
    let page;

    test.beforeAll(async () => {
        // Una sola instancia de Electron para todo el grupo de tests.
        // El timeout del beforeAll es el global de playwright.config.js (90s),
        // suficiente para launchAndLogin (~35s) + navegación + click tab Partes.
        ({ electronApp, window: page } = await launchAndLogin());

        // Asegurar que "Personas" esté anclada en el sidebar antes de navegar.
        await ensureSectionPinned(page, 'people');
        await goToSection(page, 'people');

        // Activar el tab Partes como estado compartido para todos los tests del grupo.
        const partesTab = page.locator('#people-tab-partes');
        await partesTab.waitFor({ state: 'visible', timeout: 10000 });
        await partesTab.click();

        // Esperar que PartesTab haya montado correctamente.
        await page.locator('h1').filter({ hasText: 'Partes' }).waitFor({ state: 'visible', timeout: 10000 });
    });

    test.afterAll(async () => {
        await electronApp?.close();
    });

    test('La sección Partes carga sin errores de runtime y muestra la tabla', async () => {
        // El subtítulo confirma que el componente montó sin crash de destructuring.
        await expect(
            page.getByText('Gestiona las partes involucradas en los casos.')
        ).toBeVisible({ timeout: 5000 });

        // La tabla debe renderizar con thead — si hay error de runtime, no hay thead.
        const tableHeader = page.locator('table thead th').filter({ hasText: 'Nombre' });
        await expect(tableHeader).toBeVisible({ timeout: 8000 });
    });

    test('La sección Partes muestra tabla o estado vacío (nunca pantalla en blanco)', async () => {
        // Debe existir tabla o mensaje vacío — un crash de runtime daría pantalla en blanco.
        const tableEl = page.locator('table');
        const emptyMsg = page.getByText('No se encontraron partes.');

        const tableVisible = await tableEl.isVisible().catch(() => false);
        const emptyVisible = await emptyMsg.isVisible().catch(() => false);
        expect(tableVisible || emptyVisible).toBe(true);
    });

    test('El botón "Nueva Parte" abre el modal con el formulario', async () => {
        const nuevaParteBtn = page.getByText('Nueva Parte');
        await expect(nuevaParteBtn).toBeVisible({ timeout: 5000 });
        await nuevaParteBtn.click();

        // El modal se renderiza via ModalContext con AnimatePresence.
        const modalHeading = page.getByText('Crear Nueva Parte');
        await expect(modalHeading).toBeVisible({ timeout: 8000 });

        // Verificar que los campos del formulario están presentes.
        // Un crash de destructuring en useRoles/usePartes los habría ocultado.
        await expect(page.locator('input#nombre')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('input#apellido')).toBeVisible({ timeout: 5000 });
        await expect(page.locator('input#email')).toBeVisible({ timeout: 5000 });

        // Cerrar el modal para que el siguiente test arranque en estado limpio.
        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(modalHeading).not.toBeVisible({ timeout: 5000 });
    });

    test('El modal "Nueva Parte" se cierra sin crash al presionar Cancelar', async () => {
        await page.getByText('Nueva Parte').click();
        const modalHeading = page.getByText('Crear Nueva Parte');
        await expect(modalHeading).toBeVisible({ timeout: 8000 });

        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(modalHeading).not.toBeVisible({ timeout: 5000 });

        // La tabla debe seguir visible después de cerrar el modal.
        await expect(
            page.locator('table thead th').filter({ hasText: 'Nombre' })
        ).toBeVisible({ timeout: 5000 });
    });

});

// ---------------------------------------------------------------------------
// ECONOMÍA
// ---------------------------------------------------------------------------

test.describe('Economía — Carga de sección sin errores tras mover catálogos a Categorías', () => {

    let electronApp;
    let page;

    test.beforeAll(async () => {
        // Una sola instancia para los tests de Economía.
        // El timeout global de 90s cubre launchAndLogin + navegación.
        ({ electronApp, window: page } = await launchAndLogin());

        await ensureSectionPinned(page, 'economia');
        await goToSection(page, 'economia', { timeout: 20000 });
    });

    test.afterAll(async () => {
        await electronApp?.close();
    });

    test('La sección Economía carga y muestra el título y el tab Honorarios', async () => {
        // El heading confirma que la página renderizó sin crash por DateRangePicker faltante.
        const heading = page.locator('h1').filter({ hasText: 'Economía' });
        await expect(heading).toBeVisible({ timeout: 8000 });

        await expect(
            page.getByText('Gestión de honorarios, gastos y finanzas de los casos.')
        ).toBeVisible({ timeout: 5000 });

        // Tab "Honorarios" generado por SideMenuPageLayout con sectionIdPrefix="economia-tab".
        await expect(page.locator('#economia-tab-honorarios')).toBeVisible({ timeout: 8000 });
    });

    test('El tab Gastos carga sin crashear', async () => {
        const gastosTab = page.locator('#economia-tab-gastos');
        await gastosTab.waitFor({ state: 'visible', timeout: 8000 });
        await gastosTab.click();

        await page.waitForTimeout(1500);

        // El heading debe seguir visible — si crasheó, React desmontaría todo.
        await expect(page.locator('h1').filter({ hasText: 'Economía' })).toBeVisible({ timeout: 5000 });
    });

    test('La sección Economía ya no muestra los tabs de catálogos movidos', async () => {
        await expect(page.locator('#economia-tab-tiposDeGasto')).toHaveCount(0);
        await expect(page.locator('#economia-tab-tiposDePago')).toHaveCount(0);
        await expect(page.locator('h1').filter({ hasText: 'Economía' })).toBeVisible({ timeout: 5000 });
    });

});
