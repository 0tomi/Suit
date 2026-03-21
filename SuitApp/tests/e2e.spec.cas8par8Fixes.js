/**
 * e2e.spec.cas8par8Fixes.js
 *
 * Regresión para:
 *   CAS-8: refreshPartes() ya no bloquea onParteCreated si lanza excepción.
 *          Observable: modal cierra tras submit exitoso.
 *   PAR-8: useEffect redundante eliminado de PartesTab.
 *          Observable: sección Partes sigue cargando sin ese useEffect.
 *
 * Una sola instancia de Electron (Regla 1 e2e-electron-safe).
 * API requiere: nombre, apellido, rol_id para crear una parte.
 * Select es componente custom (no Radix) — SelectItem renderiza como <button>.
 */

import { test, expect } from '@playwright/test';
import {
    launchAndLogin,
    goToSection,
    ensureSectionPinned,
} from './helpers/electronTestUtils.js';

let electronApp;
let page;

test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-cas8par8' }));
    await ensureSectionPinned(page, 'people');
    await goToSection(page, 'people', { timeout: 15000 });

    const partesTab = page.locator('#people-tab-partes');
    await partesTab.waitFor({ state: 'visible', timeout: 10000 });
    await partesTab.click();
    await page.locator('h1').filter({ hasText: 'Partes' }).waitFor({ state: 'visible', timeout: 10000 });
}, 90000);

test.afterAll(async () => {
    await electronApp?.close();
});

// PAR-8: sección carga correctamente sin el useEffect redundante
test('PAR-8 — PartesTab carga sin el useEffect redundante', async () => {
    const tableHeader = page.locator('table thead th').filter({ hasText: 'Nombre' });
    const emptyMsg = page.getByText('No se encontraron partes.');

    const tableVisible = await tableHeader.isVisible({ timeout: 8000 }).catch(() => false);
    const emptyVisible = await emptyMsg.isVisible({ timeout: 1000 }).catch(() => false);
    expect(tableVisible || emptyVisible, 'Tabla o estado vacío visible — no pantalla en blanco').toBe(true);
});

// CAS-8: crear parte con campos requeridos → modal cierra
test('CAS-8 — crear parte exitosa: modal cierra (refreshPartes no bloquea el flujo)', async () => {
    const uniqueName = `CAS8-${Date.now()}`;

    // Abrir modal
    await page.getByRole('button', { name: 'Nueva Parte' }).click();
    const modalHeading = page.getByRole('heading', { name: 'Crear Nueva Parte' });
    await expect(modalHeading).toBeVisible({ timeout: 8000 });
    await page.waitForTimeout(400);

    // Completar campos requeridos por la API (nombre, apellido, rol_id)
    await page.locator('input#nombre').fill(uniqueName);
    await page.locator('input#apellido').fill('TestApellido');

    // Abrir el Select de Rol (es custom, SelectTrigger renderiza como <button>) y elegir "Juez"
    await page.getByRole('button', { name: 'Seleccionar rol...' }).click();
    await page.getByRole('button', { name: 'Juez' }).click();

    // Click directo en el botón submit (type="button" + onClick en React 18 + Electron)
    await page.getByRole('button', { name: 'Crear Parte' }).click();

    // El modal debe cerrar en ≤15s (si CAS-8 no estuviera reparado y refreshPartes
    // lanzara excepción, closeModal nunca se ejecutaría y el modal quedaría abierto)
    await expect(modalHeading).not.toBeVisible({ timeout: 15000 });

    // La tabla debe seguir renderizando tras el cierre
    await expect(page.locator('table thead th').filter({ hasText: 'Nombre' })).toBeVisible({ timeout: 8000 });
});

// Smoke: cancelar no crashea
test('CAS-8 smoke — cancelar modal no rompe la sección', async () => {
    await page.getByRole('button', { name: 'Nueva Parte' }).click();
    const modalHeading = page.getByRole('heading', { name: 'Crear Nueva Parte' });
    await expect(modalHeading).toBeVisible({ timeout: 8000 });
    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(modalHeading).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('table thead th').filter({ hasText: 'Nombre' })).toBeVisible({ timeout: 5000 });
});
