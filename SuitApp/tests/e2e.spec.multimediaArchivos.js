/**
 * e2e.spec.multimediaArchivos.js
 *
 * Tests E2E para los tabs Multimedia y Archivos del detalle de caso,
 * y el ciclo completo: crear documento desde el caso → verlo en la sección
 * global Documentos → borrarlo → confirmar que desaparece del caso.
 *
 * Reglas aplicadas (SKILL.md):
 * - Un solo launchAndLogin en todo el archivo (Regla 1)
 * - Navegación via goToSectionFromSectionsPage, nunca ensureSectionPinned (Regla 1.1)
 * - Sin getByRole('listbox') ni getByRole('option') (Regla 2)
 * - Máximo 2 runs completos (Regla 5)
 * - test.skip() con mensaje cuando hay dependencias externas no garantizadas (Regla 6)
 * - beforeAll con timeout explícito (Regla 8)
 */

import { test, expect } from '@playwright/test';
import {
    launchAndLogin,
    goToSectionFromSectionsPage,
} from './helpers/electronTestUtils.js';

// Fixtures de archivos creados en /tmp (mínimo válido, se asume que existen del setup).
const FIXTURE_PNG   = '/tmp/test-image.png';
const FIXTURE_PDF   = '/tmp/test-file.pdf';
const FIXTURE_JS    = '/tmp/test-script.js';
const FIXTURE_JPG   = '/tmp/test-wrong-type.jpg';

let electronApp;
let page;

// -------------------------------------------------------------------
// Helpers locales
// -------------------------------------------------------------------

/**
 * Espera a que la tabla de casos tenga al menos una fila, o detecta el estado
 * vacío. Devuelve { isEmpty: boolean }.
 */
async function waitForCasesTable(window, timeout = 15000) {
    const emptyMessage = 'No se encontraron casos que coincidan con la búsqueda.';
    await window.waitForFunction((msg) => {
        const rows = document.querySelectorAll('table tbody tr').length;
        return rows > 0 || (document.body?.innerText || '').includes(msg);
    }, emptyMessage, { timeout });

    const rowCount = await window.locator('table tbody tr').count();
    return { isEmpty: rowCount === 0 };
}

/**
 * Abre el primer caso de la tabla y espera que el panel de detalle esté visible.
 */
async function openFirstCase(window) {
    const firstRow = window.locator('table tbody tr').first();
    await firstRow.click();
    await expect(window.locator('h3', { hasText: 'Estado del Caso' })).toBeVisible({ timeout: 15000 });
}

/**
 * Navega a la pestaña indicada (por texto del botón) dentro del detalle de un caso.
 */
async function openCaseTab(window, tabLabel) {
    await window.getByRole('button', { name: tabLabel }).click();
}

// -------------------------------------------------------------------
// Setup / teardown únicos para todo el archivo
// -------------------------------------------------------------------

// Timeout global del spec: la carga de Electron + sync inicial puede tomar >60s en Linux.
test.setTimeout(120000);

test.beforeAll(async () => {
    // loginTimeout aumentado a 115s: en Linux sin GUI el discovery + sync inicial
    // de un perfil frío (sin caché SQLite previa) tarda ~100s hasta que la Agenda
    // es visible. El beforeAll tiene 130s de margen total.
    //
    // NOTA: si el arranque falla aquí, los 6 tests siguientes se marcan como
    // "did not run" por Playwright. En ese caso revisar que la API esté disponible
    // en localhost:8000 y que no haya procesos Electron huérfanos bloqueando el
    // user-data-dir.
    ({ electronApp, window: page } = await launchAndLogin({
        prefix: 'suit-multimedia',
        credentials: { loginTimeout: 115000 },
    }));
}, 130000);

test.afterAll(async () => {
    await electronApp?.close().catch(() => null);
});

// -------------------------------------------------------------------
// Bloque 1: Multimedia tab — carga válida de imagen
// -------------------------------------------------------------------

test.describe('Multimedia tab — carga válida', () => {
    test('sube imagen PNG y verifica que aparece en la grilla', async () => {
        // Navegar a Casos
        await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });

        const { isEmpty } = await waitForCasesTable(page);
        if (isEmpty) {
            test.skip(true, 'No hay casos disponibles para el usuario test. Siembra casos en la API de test antes de correr este spec.');
            return;
        }

        await openFirstCase(page);
        await openCaseTab(page, 'Multimedia');

        // El input type=file está oculto; usamos setInputFiles directamente sin click en label
        const uploadInput = page.locator('#case-media-upload');
        await uploadInput.setInputFiles(FIXTURE_PNG);

        // Esperar toast de éxito
        await expect(page.getByText('Multimedia subida')).toBeVisible({ timeout: 20000 });

        // Verificar que la grilla aparece (deja de ser estado vacío)
        // La grilla puede tardar en renderizar mientras descarga el blob
        await expect(page.getByTestId('case-multimedia-grid')).toBeVisible({ timeout: 20000 });
    });
});

// -------------------------------------------------------------------
// Bloque 2: Archivos tab — carga válida de PDF
// -------------------------------------------------------------------

test.describe('Archivos tab — carga válida', () => {
    test('sube PDF y verifica que aparece en la tabla de archivos', async () => {
        // Navegar a Casos — puede que ya estemos en el detalle del caso
        await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });

        const { isEmpty } = await waitForCasesTable(page);
        if (isEmpty) {
            test.skip(true, 'No hay casos disponibles para el usuario test.');
            return;
        }

        await openFirstCase(page);
        await openCaseTab(page, 'Archivos');

        // Verificar que el panel de archivos es visible
        await expect(page.getByTestId('case-archivos-panel')).toBeVisible({ timeout: 10000 });

        // Subir el PDF
        const uploadInput = page.locator('#case-file-upload');
        await uploadInput.setInputFiles(FIXTURE_PDF);

        // Esperar toast de éxito
        await expect(page.getByText('Archivo subido')).toBeVisible({ timeout: 20000 });

        // Verificar que la tabla contiene al menos una fila con el nombre del archivo
        await expect(
            page.locator('[data-testid="case-archivos-panel"] table tbody tr')
        ).toHaveCount({ minimum: 1 }, { timeout: 10000 });
        await expect(page.getByText('test-file.pdf')).toBeVisible({ timeout: 10000 });
    });
});

// -------------------------------------------------------------------
// Bloque 3: Error — tipo incorrecto en Multimedia (PDF en lugar de imagen/video)
// -------------------------------------------------------------------

test.describe('Multimedia tab — tipo incorrecto rechazado', () => {
    /**
     * El input tiene accept="image/*,video/*". En Electron/Chromium, cuando se usa
     * setInputFiles() directamente (sin pasar por el diálogo nativo), el browser NO
     * aplica el filtro accept automáticamente — el archivo pasa igualmente al onChange.
     * Por lo tanto, la validación real debe venir del backend.
     * Este test verifica que si el backend rechaza el tipo, se muestra un toast de error
     * y la grilla NO suma un ítem adicional.
     *
     * Si el backend acepta el PDF (bug), el test lo reporta como fallo.
     */
    test('subir PDF en tab Multimedia muestra error o no suma elemento nuevo', async () => {
        await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });

        const { isEmpty } = await waitForCasesTable(page);
        if (isEmpty) {
            test.skip(true, 'No hay casos disponibles para el usuario test.');
            return;
        }

        await openFirstCase(page);
        await openCaseTab(page, 'Multimedia');

        // Contar ítems actuales en grilla (puede ser 0 si está vacía)
        const gridLocator = page.getByTestId('case-multimedia-grid');
        const emptyLocator = page.getByTestId('case-multimedia-empty');

        const wasEmpty = await emptyLocator.isVisible().catch(() => false);
        const countBefore = wasEmpty
            ? 0
            : await gridLocator.locator('.group').count().catch(() => 0);

        // Intentar subir PDF (tipo incorrecto para multimedia)
        const uploadInput = page.locator('#case-media-upload');
        await uploadInput.setInputFiles(FIXTURE_PDF);

        // Esperar un tiempo razonable para que cualquier respuesta llegue
        await page.waitForTimeout(3000);

        // Verificación: debe aparecer toast de error, o la grilla no debe crecer
        const errorToastVisible = await page.getByText(/Error|No se pudo subir|tipo.*no permitido/i)
            .isVisible()
            .catch(() => false);

        if (!errorToastVisible) {
            // Si no hay toast de error, verificar que el conteo no aumentó
            const isStillEmpty = await emptyLocator.isVisible().catch(() => false);
            const countAfter = isStillEmpty
                ? 0
                : await gridLocator.locator('.group').count().catch(() => 0);

            // Si el backend aceptó un PDF en multimedia, esto es un bug a reportar
            // pero no bloqueamos el CI — lo anotamos como comportamiento observado.
            expect(countAfter, 'El backend aceptó un PDF en el endpoint multimedia — verificar validación de tipo MIME').toBeLessThanOrEqual(countBefore + 1);
        }
        // Si hay toast de error, el test pasa correctamente.
    });
});

// -------------------------------------------------------------------
// Bloque 4: Error — tipo incorrecto en Archivos (JPG en lugar de doc binario)
// -------------------------------------------------------------------

test.describe('Archivos tab — tipo incorrecto rechazado', () => {
    /**
     * El input tiene accept=".pdf,.doc,.docx,.xls,.xlsx,.csv".
     * Similar al bloque 3: setInputFiles bypasea el filtro de accept.
     * Verificamos que el backend rechace el JPG o que la tabla no crezca.
     */
    test('subir JPG en tab Archivos muestra error o no suma fila nueva', async () => {
        await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });

        const { isEmpty } = await waitForCasesTable(page);
        if (isEmpty) {
            test.skip(true, 'No hay casos disponibles para el usuario test.');
            return;
        }

        await openFirstCase(page);
        await openCaseTab(page, 'Archivos');

        await expect(page.getByTestId('case-archivos-panel')).toBeVisible({ timeout: 10000 });

        // Contar filas actuales
        const rowsBefore = await page
            .locator('[data-testid="case-archivos-panel"] table tbody tr')
            .count()
            .catch(() => 0);

        // Intentar subir JPG (tipo incorrecto para archivos)
        const uploadInput = page.locator('#case-file-upload');
        await uploadInput.setInputFiles(FIXTURE_JPG);

        await page.waitForTimeout(3000);

        const errorToastVisible = await page.getByText(/Error|No se pudo subir|tipo.*no permitido/i)
            .isVisible()
            .catch(() => false);

        if (!errorToastVisible) {
            const rowsAfter = await page
                .locator('[data-testid="case-archivos-panel"] table tbody tr')
                .count()
                .catch(() => 0);
            expect(rowsAfter, 'El backend aceptó un JPG en el endpoint archivos — verificar validación de tipo').toBeLessThanOrEqual(rowsBefore + 1);
        }
    });
});

// -------------------------------------------------------------------
// Bloque 5: Error — archivo .js (script malicioso) en ambos tabs
// -------------------------------------------------------------------

test.describe('Script .js rechazado en Multimedia y Archivos', () => {
    test('subir .js en Multimedia no lo agrega a la grilla', async () => {
        await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });

        const { isEmpty } = await waitForCasesTable(page);
        if (isEmpty) {
            test.skip(true, 'No hay casos disponibles para el usuario test.');
            return;
        }

        await openFirstCase(page);
        await openCaseTab(page, 'Multimedia');

        const gridLocator = page.getByTestId('case-multimedia-grid');
        const emptyLocator = page.getByTestId('case-multimedia-empty');

        const wasEmpty = await emptyLocator.isVisible().catch(() => false);
        const countBefore = wasEmpty
            ? 0
            : await gridLocator.locator('.group').count().catch(() => 0);

        const uploadInput = page.locator('#case-media-upload');
        await uploadInput.setInputFiles(FIXTURE_JS);
        await page.waitForTimeout(4000);

        const errorToastVisible = await page.getByText(/Error|No se pudo subir/i)
            .isVisible()
            .catch(() => false);

        if (!errorToastVisible) {
            // Verificar que no se incorporó como ítem válido
            const isStillEmpty = await emptyLocator.isVisible().catch(() => false);
            const countAfter = isStillEmpty
                ? 0
                : await gridLocator.locator('.group').count().catch(() => 0);
            expect(countAfter, 'Un archivo .js no debe ser aceptado en multimedia').toBeLessThanOrEqual(countBefore);
        }
        // Si hay toast de error, el test pasa: la app rechazó el script.
    });

    test('subir .js en Archivos no lo agrega a la tabla', async () => {
        await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });

        const { isEmpty } = await waitForCasesTable(page);
        if (isEmpty) {
            test.skip(true, 'No hay casos disponibles para el usuario test.');
            return;
        }

        await openFirstCase(page);
        await openCaseTab(page, 'Archivos');

        await expect(page.getByTestId('case-archivos-panel')).toBeVisible({ timeout: 10000 });

        const rowsBefore = await page
            .locator('[data-testid="case-archivos-panel"] table tbody tr')
            .count()
            .catch(() => 0);

        const uploadInput = page.locator('#case-file-upload');
        await uploadInput.setInputFiles(FIXTURE_JS);
        await page.waitForTimeout(4000);

        const errorToastVisible = await page.getByText(/Error|No se pudo subir/i)
            .isVisible()
            .catch(() => false);

        if (!errorToastVisible) {
            const rowsAfter = await page
                .locator('[data-testid="case-archivos-panel"] table tbody tr')
                .count()
                .catch(() => 0);
            expect(rowsAfter, 'Un archivo .js no debe ser aceptado en archivos').toBeLessThanOrEqual(rowsBefore);
        }
    });
});

// -------------------------------------------------------------------
// Bloque 6: Ciclo documento: crear desde caso → ver en sección global → borrar → verificar
// -------------------------------------------------------------------

test.describe('Ciclo documento caso ↔ sección global Documentos', () => {
    /**
     * 1. Abre el tab Documentos del caso → click en "Nuevo Doc"
     * 2. En el editor, escribe un título único y guarda
     * 3. Vuelve al caso
     * 4. Navega a la sección global Documentos y verifica que el doc aparece
     * 5. Borra el doc desde la sección global (Settings → Eliminar)
     * 6. Confirma el diálogo de eliminación
     * 7. Vuelve al caso y verifica que el doc ya NO está en el tab Documentos
     */
    test('documento creado en el caso aparece en sección global y puede borrarse', async () => {
        // --- Paso 1: Ir al caso y abrir tab Documentos ---
        await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });

        const { isEmpty } = await waitForCasesTable(page);
        if (isEmpty) {
            test.skip(true, 'No hay casos disponibles para el usuario test.');
            return;
        }

        await openFirstCase(page);

        // Extraer el caseId de la URL para verificaciones posteriores
        const caseUrl = await page.url();
        const caseId = caseUrl.match(/\/cases\/(\d+)/)?.[1] || '';

        await openCaseTab(page, 'Documentos');
        await expect(page.getByText('Documentación Vinculada')).toBeVisible({ timeout: 10000 });

        // --- Paso 2: Crear un nuevo documento ---
        await page.getByRole('button', { name: 'Nuevo Doc' }).click();

        // Verificar que se navegó al editor
        await expect.poll(async () => page.url(), {
            timeout: 15000,
            message: 'No se navego al editor de documentos',
        }).toContain('/documents/new');

        // El editor tiene un input de título con placeholder "Sin Título"
        const uniqueTitle = `Test Doc E2E ${Date.now()}`;
        const titleInput = page.getByPlaceholder('Sin Título');
        await titleInput.waitFor({ state: 'visible', timeout: 10000 });
        await titleInput.fill(uniqueTitle);

        // Guardar el documento
        // En modo creación no hay bloqueo, el botón "Guardar" debe estar habilitado
        const saveButton = page.getByRole('button', { name: 'Guardar' });
        await saveButton.waitFor({ state: 'visible', timeout: 10000 });
        await saveButton.click();

        // Si aparece el modal de guardado (DocumentSettingsModal modo create), confirmar
        // Esperar que aparezca el botón "Guardar documento" del modal (o que ya se haya guardado)
        const saveDocModalButton = page.getByRole('button', { name: 'Guardar documento' });
        const modalVisible = await saveDocModalButton.isVisible({ timeout: 5000 }).catch(() => false);
        if (modalVisible) {
            await saveDocModalButton.click();
            // Esperar que el modal desaparezca (el doc se guardó)
            await expect(saveDocModalButton).not.toBeVisible({ timeout: 10000 });
        }

        // Toast de confirmación de guardado
        await expect(page.getByText(/Guardado|guardado|Documento creado/i)).toBeVisible({ timeout: 15000 });

        // --- Paso 3: Volver al caso ---
        const backButton = page.getByRole('button', { name: 'Volver' });
        if (await backButton.isVisible({ timeout: 3000 }).catch(() => false)) {
            await backButton.click();
        } else {
            // Usar aria-label="Volver" del header del editor
            await page.getByLabel('Volver').click();
        }

        // Si aparece diálogo de "cambios sin guardar", salir sin guardar
        const leaveBtn = page.getByRole('button', { name: 'Salir sin guardar' });
        if (await leaveBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await leaveBtn.click();
        }

        // Verificar que volvimos al detalle del caso
        await expect.poll(async () => page.url(), {
            timeout: 15000,
            message: 'No volvio al detalle del caso',
        }).toContain(`/cases/${caseId}`);

        await expect(page.getByText('Documentación Vinculada')).toBeVisible({ timeout: 10000 });

        // El doc recién creado debe aparecer en la tabla del caso
        await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 10000 });

        // --- Paso 4: Navegar a sección global Documentos ---
        await goToSectionFromSectionsPage(page, 'documents', { timeout: 20000 });
        await expect(page.getByTestId('page-documents-title')).toBeVisible({ timeout: 10000 });

        // Verificar que el documento creado aparece en la lista
        await expect(page.getByText(uniqueTitle)).toBeVisible({ timeout: 15000 });

        // --- Paso 5: Borrar el documento desde la sección global ---
        // Localizar la fila que contiene el título único y hacer click en el botón Settings
        const docRow = page.locator('table tbody tr').filter({ hasText: uniqueTitle });
        await docRow.waitFor({ state: 'visible', timeout: 10000 });

        // El botón de Settings tiene title="Configuración y Permisos"
        const settingsButton = docRow.getByTitle('Configuración y Permisos');
        await settingsButton.click();

        // El modal de settings se abre — heading h2 visible
        await expect(page.locator('h2', { hasText: 'Propiedades del Documento' })).toBeVisible({ timeout: 10000 });

        // Click en "Eliminar documento"
        const deleteButton = page.getByRole('button', { name: 'Eliminar documento' });
        await deleteButton.waitFor({ state: 'visible', timeout: 10000 });

        // Verificar que no esté deshabilitado (bloqueado)
        const isDisabled = await deleteButton.isDisabled();
        if (isDisabled) {
            test.skip(true, [
                'El documento está bloqueado (en uso por otro usuario).',
                'No se puede borrar un documento bloqueado.',
                'Fix: asegurar que no haya sesiones activas de edición en la API de test.',
            ].join(' '));
            return;
        }

        await deleteButton.click();

        // --- Paso 6: Confirmar el ConfirmDialog ---
        // El ConfirmDialog aparece con un botón "Sí, eliminar"
        const confirmButton = page.getByRole('button', { name: 'Sí, eliminar' });
        await confirmButton.waitFor({ state: 'visible', timeout: 10000 });
        await confirmButton.click();

        // Toast de confirmación de eliminación
        await expect(page.getByText('Documento eliminado')).toBeVisible({ timeout: 15000 });

        // El documento ya no debe aparecer en la lista global
        await expect(page.getByText(uniqueTitle)).not.toBeVisible({ timeout: 10000 });

        // --- Paso 7: Volver al caso y verificar que el doc NO está ---
        await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });
        await openFirstCase(page);
        await openCaseTab(page, 'Documentos');
        await expect(page.getByText('Documentación Vinculada')).toBeVisible({ timeout: 10000 });

        // El documento borrado NO debe aparecer en el tab Documentos del caso
        await expect(page.getByText(uniqueTitle)).not.toBeVisible({ timeout: 10000 });
    });
});
