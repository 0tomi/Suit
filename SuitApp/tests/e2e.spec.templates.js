import { expect, test } from '@playwright/test';
import { launchAndLogin, ensureSectionPinned, goToSection } from './helpers/electronTestUtils.js';

/**
 * E2E Spec: Flujo de creación y eliminación de plantillas (Templates).
 *
 * Valida el flujo completo:
 *  1. Crear un modelo desde cero vía el nuevo modal de selección
 *  2. Verificar que el modelo aparece inmediatamente en la galería
 *  3. Eliminar el modelo
 *  4. Verificar que desaparece de la galería
 *
 * Usa el usuario `tag:test` para no interferir con datos de otros usuarios.
 * La app Electron corre en modo headless con xvfb-run en Linux.
 */
test.describe('Galería de Modelos — Crear y Eliminar', () => {
    let electronApp;
    let page;

    test.beforeAll(async () => {
        ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-templates-test' }));
        await ensureSectionPinned(page, 'templates');
    }, 90000);

    test.afterAll(async () => {
        if (electronApp) await electronApp.close();
    });

    /**
     * Test 1: Crear un modelo desde cero.
     *
     * Flujo:
     *  - Navegar a la galería
     *  - Abrir modal "Crear nuevo Modelo"
     *  - Elegir "Crear desde cero"
     *  - Ingresar título en el editor
     *  - Guardar y verificar redirección a la galería
     *  - Comprobar que la card del nuevo modelo es visible
     */
    test('debe crear un modelo desde cero y mostrarlo en la galería', async () => {
        await goToSection(page, 'templates');

        // Verificar que la galería carga correctamente
        const galleryTitle = page.getByTestId('page-templates-title');
        await expect(galleryTitle).toBeVisible({ timeout: 10000 });

        // Abrir el modal de creación
        await page.getByRole('button', { name: /crear nuevo modelo/i }).click();

        // Esperar que el modal esté visible
        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible({ timeout: 5000 });

        // Elegir "Crear desde cero"
        await page.getByRole('button', { name: /crear desde cero/i }).click();

        // El editor de plantillas debe cargar
        await expect(page.locator('input[placeholder="Título del modelo..."]')).toBeVisible({ timeout: 10000 });

        // Ingresar el título del modelo
        const templateTitle = `Modelo Test E2E ${Date.now()}`;
        await page.locator('input[placeholder="Título del modelo..."]').fill(templateTitle);

        // Guardar el modelo
        await page.getByRole('button', { name: /guardar modelo/i }).click();

        // Esperar redirección a la galería de modelos
        await expect(page.getByTestId('page-templates-title')).toBeVisible({ timeout: 15000 });

        // El modelo recién creado debe aparecer en la galería
        const templateCard = page.locator('h3', { hasText: templateTitle });
        await expect(templateCard).toBeVisible({ timeout: 10000 });
    });

    /**
     * Test 2: Eliminar el modelo recién creado.
     *
     * Flujo:
     *  - Localizar el modelo por título en la galería
     *  - Hacer clic en el botón de eliminar (icono trash)
     *  - Confirmar el diálogo
     *  - Verificar que la card desaparece de la galería
     *
     * Nota: usa el mismo título generado en el test anterior buscando la card más reciente.
     * Como los tests corren secuencialmente (workers: 1), la card estará presente.
     */
    test('debe eliminar el modelo y desaparecer de la galería', async () => {
        // Confirmar que seguimos en la galería
        await expect(page.getByTestId('page-templates-title')).toBeVisible({ timeout: 10000 });

        // Buscar la primera card de plantilla que tenga botón eliminar visible
        // La card tiene un article con un button title="Eliminar plantilla"
        const deleteButton = page.locator('button[title="Eliminar plantilla"]').first();
        await expect(deleteButton).toBeVisible({ timeout: 10000 });

        // Obtener el título de la card que se va a eliminar para verificar su desaparición
        const cardArticle = deleteButton.locator('xpath=ancestor::article');
        const cardTitle = await cardArticle.locator('h3').first().innerText().catch(() => '');

        // Clic en eliminar
        await deleteButton.click();

        // El diálogo de confirmación debe aparecer (Radix AlertDialog)
        const confirmBtn = page.getByRole('button', { name: /sí, eliminar/i });
        await expect(confirmBtn).toBeVisible({ timeout: 5000 });
        await confirmBtn.click();

        // La card debe desaparecer
        if (cardTitle) {
            await expect(page.locator('h3', { hasText: cardTitle })).toBeHidden({ timeout: 10000 });
        } else {
            // Fallback: verificar que el botón de eliminar ya no existe para esa card
            await expect(deleteButton).toBeHidden({ timeout: 10000 });
        }
    });
});

/**
 * E2E Spec: Visibilidad inmediata al crear y eliminar (flujo completo en un solo test).
 *
 * Test más robusto: mantiene el título en scope para validar
 * creación Y eliminación en la misma sesión.
 */
test.describe('Galería de Modelos — Ciclo completo crear → verificar → eliminar', () => {
    let electronApp;
    let page;

    test.beforeAll(async () => {
        ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-templates-cycle' }));
        await ensureSectionPinned(page, 'templates');
    }, 90000);

    test.afterAll(async () => {
        if (electronApp) await electronApp.close();
    });

    test('crear un modelo, verificar que aparece, y luego eliminarlo verificando que desaparece', async () => {
        await goToSection(page, 'templates');
        await expect(page.getByTestId('page-templates-title')).toBeVisible({ timeout: 10000 });

        // ── CREAR ─────────────────────────────────────────────────────────────────
        await page.getByRole('button', { name: /crear nuevo modelo/i }).click();

        const modal = page.getByRole('dialog');
        await expect(modal).toBeVisible({ timeout: 5000 });

        await page.getByRole('button', { name: /crear desde cero/i }).click();

        const titleInput = page.locator('input[placeholder="Título del modelo..."]');
        await expect(titleInput).toBeVisible({ timeout: 10000 });

        const uniqueTitle = `Modelo-Ciclo-${Date.now()}`;
        await titleInput.fill(uniqueTitle);

        await page.getByRole('button', { name: /guardar modelo/i }).click();

        // ── VERIFICAR APARICIÓN ────────────────────────────────────────────────────
        await expect(page.getByTestId('page-templates-title')).toBeVisible({ timeout: 15000 });

        const createdCard = page.locator('h3', { hasText: uniqueTitle });
        await expect(createdCard).toBeVisible({ timeout: 10000 });

        // ── ELIMINAR ─────────────────────────────────────────────────────────────
        // El botón de eliminar está en el article que contiene el h3 con el título
        const cardArticle = page.locator('article').filter({ has: page.locator('h3', { hasText: uniqueTitle }) });
        await expect(cardArticle).toBeVisible({ timeout: 5000 });

        const deleteBtn = cardArticle.locator('button[title="Eliminar plantilla"]');
        await expect(deleteBtn).toBeVisible({ timeout: 5000 });
        await deleteBtn.click();

        // Confirmar diálogo
        const confirmBtn = page.getByRole('button', { name: /sí, eliminar/i });
        await expect(confirmBtn).toBeVisible({ timeout: 5000 });
        await confirmBtn.click();

        // ── VERIFICAR DESAPARICIÓN ─────────────────────────────────────────────────
        await expect(createdCard).toBeHidden({ timeout: 10000 });
    });
});
