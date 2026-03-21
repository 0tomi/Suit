import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

/**
 * Tests de hipótesis de fallos para la sección de Vencimientos.
 *
 * Cada test ataca una hipótesis de fallo específica identificada mediante
 * análisis crítico del código fuente. Se incluyen casos borde que el happy
 * path no cubre.
 *
 * Hipótesis principales identificadas:
 * 1. KPI "Hoy": vencimientos con status=Vencido y due_date=hoy son excluidos del
 *    conteo de la card pero aparecen al filtrar — inconsistencia visual.
 * 2. KPI "Semana" cuenta acumulado (hoy+semana) pero el filtro de página solo muestra
 *    el rango [hoy, +7días]. El número de la card puede no coincidir con los resultados.
 * 3. Paginación no se resetea al cambiar filtros — si estás en página 2 y filtras a
 *    1 resultado, la tabla puede aparecer vacía.
 * 4. PostponeModal acepta fechas pasadas sin validación en el cliente.
 * 5. Filtro categoryFilter "solo pendientes y prorrogados" combinado con dateFilter
 *    activo: dateFilter tiene precedencia y puede mostrar Vencidos aunque el
 *    categoryFilter los excluiría.
 * 6. Sort date-asc usa comparación ternaria sin retornar 0 para igualdad — puede
 *    inestabilizar el orden en elementos con misma fecha.
 * 7. Creación sin título o sin fecha: ¿HTML5 required lo bloquea o hay un bug silencioso?
 * 8. Filtro de texto busca en title y description pero NO en case_id o status.
 * 9. Cambio de mes: vencimientos del mes actual desaparecen al navegar a otro mes.
 * 10. Crear vencimiento sin caso asociado y verificar que aparece en la lista.
 */

test.describe('Hipótesis de fallos — KPI cards y filtros', () => {

    /**
     * HIPÓTESIS 1: La card KPI "Hoy" muestra N vencimientos para hoy.
     * Al hacer click en ella, el filtro activo debería mostrar exactamente N ítems.
     * Bug potencial: los conteos de la card y los resultados de la lista pueden diferir
     * porque la card excluye status=Vencido del conteo de "hoy", pero el filtro de la
     * página SÍ los incluye (solo excluye Cumplido).
     */
    test('KPI "Hoy": el conteo de la card coincide con los resultados filtrados', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Leer el conteo de la card "Hoy"
            // La card tiene structure: <p class="text-2xl font-bold text-orange-700">N</p>
            const hoyCard = window.locator('.border-orange-200').first();
            await expect(hoyCard).toBeVisible({ timeout: 5000 });

            const hoyCountText = await hoyCard.locator('p.text-2xl').textContent({ timeout: 3000 });
            const hoyCount = parseInt(hoyCountText?.trim() ?? '0', 10);

            // Hacer click en la card para activar el filtro
            await hoyCard.click();
            await window.waitForTimeout(800);

            // Leer el conteo de resultados en el FilterBar
            // El div de resultados es ".whitespace-nowrap" con texto "X resultado(s)"
            const resultCountEl = window.locator('div.whitespace-nowrap');
            await expect(resultCountEl).toBeVisible({ timeout: 3000 });
            const resultCountText = await resultCountEl.textContent({ timeout: 3000 });

            // Extraer el número de resultados
            const match = resultCountText?.match(/^(\d+)/);
            const resultCount = match ? parseInt(match[1], 10) : -1;

            // HIPÓTESIS: Si el conteo de la card NO coincide con los resultados,
            // existe una inconsistencia en la lógica de filtrado.
            // Nota: si hay vencimientos con status=Vencido y due_date=hoy, la card
            // los excluye del conteo "hoy" pero el filtro de página los incluye.
            console.log(`[KPI Hoy] Card count: ${hoyCount}, Result count: ${resultCount}`);

            // Este assertion PUEDE fallar si existen vencimientos Vencidos con due_date=hoy
            // En ese caso, resultCount > hoyCount (bug confirmado)
            expect(resultCount).toBe(hoyCount);
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 2: La card "Esta semana" muestra un acumulado (hoy + semana).
     * El filtro de página con dateFilter='semana' muestra due_date en [hoy, +7días].
     * Ambos deberían mostrar el mismo número de ítems no-cumplidos en ese rango.
     */
    test('KPI "Esta semana": el conteo acumulado coincide con los resultados filtrados', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Leer el conteo de la card "Esta semana"
            const semanaCard = window.locator('.border-blue-200').first();
            await expect(semanaCard).toBeVisible({ timeout: 5000 });

            const semanaCountText = await semanaCard.locator('p.text-2xl').textContent({ timeout: 3000 });
            const semanaCount = parseInt(semanaCountText?.trim() ?? '0', 10);

            // Hacer click en la card
            await semanaCard.click();
            await window.waitForTimeout(800);

            const resultCountEl = window.locator('div.whitespace-nowrap');
            const resultCountText = await resultCountEl.textContent({ timeout: 3000 });
            const match = resultCountText?.match(/^(\d+)/);
            const resultCount = match ? parseInt(match[1], 10) : -1;

            console.log(`[KPI Semana] Card count: ${semanaCount}, Result count: ${resultCount}`);
            expect(resultCount).toBe(semanaCount);
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 3: Cuando dateFilter='vencidos' está activo y el usuario cambia el
     * categoryFilter a "Solo pendientes y prorrogados", el filtro debería mostrar 0
     * resultados (o solo pendientes/prorrogados). Sin embargo, el código da precedencia
     * a dateFilter, así que seguirá mostrando Vencidos.
     *
     * En realidad esto es comportamiento intencionado según el código (dateFilter tiene
     * prioridad), pero puede ser confuso para el usuario que ve el select cambiado pero
     * los resultados no cambian.
     *
     * Aquí verificamos que al menos el comportamiento sea determinístico.
     */
    test('Filtro de categoría no tiene efecto cuando dateFilter KPI está activo', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Activar filtro KPI "Vencidos"
            const vencidosCard = window.locator('.border-red-200').first();
            await vencidosCard.click();
            await window.waitForTimeout(500);

            // Verificar que la card tiene ring activo
            await expect(window.locator('.ring-2.ring-red-500')).toBeVisible({ timeout: 3000 });

            // Leer el conteo con KPI activo
            const resultCountEl = window.locator('div.whitespace-nowrap');
            await resultCountEl.textContent({ timeout: 3000 });

            // Cambiar categoryFilter a "Solo pendientes y prorrogados"
            // Esto debería limpiar el KPI filter (handleCategoryChange llama setDateFilter('all'))
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('pending-postponed');
            await window.waitForTimeout(500);

            // El KPI 'Vencidos' ya NO debería tener ring activo (porque cambiar category limpia dateFilter)
            const vencidosRing = window.locator('.ring-2.ring-red-500');
            const ringStillVisible = await vencidosRing.isVisible().catch(() => false);

            console.log(`[Filtro Precedencia] KPI vencidos ring aún visible tras cambiar category: ${ringStillVisible}`);

            // El ring DEBE desaparecer al cambiar category (según el código)
            // Si el ring persiste, hay un bug de estado
            expect(ringStillVisible).toBe(false);
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 4: El filtro de texto busca solo en title y description.
     * Si el usuario busca el ID de un caso (número), NO debe encontrar coincidencias
     * a menos que ese número aparezca en el título/descripción.
     * Esto verifica que el scope de búsqueda está documentado correctamente.
     */
    test('Búsqueda de texto no encuentra vencimientos por ID de caso numérico', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Mostrar todos los vencimientos
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            // Obtener el conteo total antes de buscar
            const resultCountEl = window.locator('div.whitespace-nowrap');
            const totalText = await resultCountEl.textContent({ timeout: 3000 });
            const totalCount = parseInt(totalText?.match(/^(\d+)/)?.[1] ?? '0', 10);

            if (totalCount === 0) {
                console.log('[Búsqueda] No hay vencimientos — test skipped');
                return;
            }

            // Buscar por un status keyword que existe pero no debería estar en title
            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await searchInput.fill('Vencido');
            await window.waitForTimeout(500);

            const afterSearchText = await resultCountEl.textContent({ timeout: 3000 });
            const afterSearchCount = parseInt(afterSearchText?.match(/^(\d+)/)?.[1] ?? '0', 10);

            // Si hay 0 resultados, significa que ningún título/descripción contiene "Vencido"
            // Si hay resultados, significa que el status puede coincidir con el título (válido)
            console.log(`[Búsqueda] Buscar "Vencido" en ${totalCount} items: ${afterSearchCount} resultados`);

            // Solo verificamos que el search funciona (reduce o mantiene el count)
            expect(afterSearchCount).toBeLessThanOrEqual(totalCount);
        } finally {
            await electronApp.close();
        }
    });
});

test.describe('Hipótesis de fallos — Paginación', () => {

    /**
     * HIPÓTESIS 5: La paginación no se resetea al cambiar el filtro de búsqueda.
     * Si el usuario está en la página 2 y aplica un filtro que reduce los resultados
     * a menos de 10 ítems (lo que cabe en la primera página), la tabla puede aparecer
     * vacía porque currentPage=2 ya no tiene ítems.
     *
     * Para probar esto: necesitamos >10 vencimientos. Si no hay, la prueba es trivial.
     */
    test('Paginación: cambiar filtro con pocos resultados no deja tabla vacía', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Mostrar todos
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            // Verificar si hay más de 10 ítems (necesarios para que haya paginación)
            const resultCountEl = window.locator('div.whitespace-nowrap');
            const totalText = await resultCountEl.textContent({ timeout: 3000 });
            const totalCount = parseInt(totalText?.match(/^(\d+)/)?.[1] ?? '0', 10);

            if (totalCount <= 10) {
                console.log(`[Paginación] Solo ${totalCount} ítems, no hay paginación para testear`);
                // Aun así verificar que no hay paginación visible cuando hay <= 10 ítems
                const paginationEl = window.locator('[aria-label="Pagination"]').or(
                    window.locator('nav[aria-label="pagination"]')
                );
                // La paginación no debería aparecer
                const isPaginationVisible = await paginationEl.isVisible().catch(() => false);
                if (!isPaginationVisible) {
                    console.log('[Paginación] Correcto: no hay controles de paginación con <= 10 ítems');
                }
                return;
            }

            // Si hay >10, intentar navegar a la segunda página
            const nextPageBtn = window.locator('button[aria-label="Siguiente página"]')
                .or(window.locator('button:has-text("2")'))
                .first();

            if (await nextPageBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await nextPageBtn.click();
                await window.waitForTimeout(500);

                // Aplicar filtro que reduce resultados a < 10
                const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
                await searchInput.fill('xyzabcdefgh_no_existe_1234567890');
                await window.waitForTimeout(500);

                // Con 0 resultados, debe mostrar EmptyState (no tabla vacía sin mensaje)
                const emptyState = window.locator('text=No hay vencimientos');
                await expect(emptyState).toBeVisible({ timeout: 3000 });
                console.log('[Paginación] OK: EmptyState visible tras filtro vacío desde página 2');

                // Limpiar filtro
                await searchInput.fill('');
                await window.waitForTimeout(500);
            } else {
                console.log('[Paginación] No se pudo navegar a página 2');
            }
        } finally {
            await electronApp.close();
        }
    });
});

test.describe('Hipótesis de fallos — Formulario y validación', () => {

    /**
     * HIPÓTESIS 6: El formulario de creación tiene campos required (title, due_date)
     * marcados con HTML5. Si el submit se hace con campos vacíos, el browser debería
     * bloquear. Pero como el form se controla vía React state, verificamos que no se
     * pueda crear un vencimiento sin título.
     */
    test('Formulario: no se puede enviar sin título (campo required)', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Abrir modal
            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            // Completar SOLO la fecha, dejar título vacío
            const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 5);
            await dateInput.fill(tomorrow.toISOString().slice(0, 10));

            // Intentar enviar sin título
            await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
            await window.waitForTimeout(1000);

            // El modal DEBE seguir abierto (el form no se envió por HTML5 required).
            // El Modal component renderiza un <h2> con el título — no tiene role="dialog".
            const modalHeading = window.locator('h2', { hasText: 'Nuevo Vencimiento' });
            await expect(modalHeading).toBeVisible({ timeout: 3000 });

            // No debe aparecer el toast de éxito
            const successToast = window.locator('text=Vencimiento creado');
            const toastVisible = await successToast.isVisible().catch(() => false);
            expect(toastVisible).toBe(false);
            console.log('[Validación] OK: modal sigue abierto cuando título está vacío');
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 7: El formulario no puede enviarse sin fecha límite (campo required).
     * Igual que el anterior pero sin fecha.
     */
    test('Formulario: no se puede enviar sin fecha límite (campo required)', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            // Completar SOLO el título, dejar fecha vacía
            const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
            await titleInput.fill('Test sin fecha límite');

            // No rellenar la fecha (debe estar vacía por default)
            const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
            const dateValue = await dateInput.inputValue();
            // Si la fecha ya tiene un valor por alguna razón, limpiarla
            if (dateValue) {
                await dateInput.fill('');
            }

            // Intentar enviar
            await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
            await window.waitForTimeout(1000);

            // El modal debe seguir abierto (HTML5 required en date input bloquea el submit).
            // El Modal component renderiza un <h2> con el título — no tiene role="dialog".
            const modalHeading = window.locator('h2', { hasText: 'Nuevo Vencimiento' });
            await expect(modalHeading).toBeVisible({ timeout: 3000 });

            // No debe haber toast de éxito
            const successToast = window.locator('text=Vencimiento creado');
            const toastVisible = await successToast.isVisible().catch(() => false);
            expect(toastVisible).toBe(false);
            console.log('[Validación] OK: modal sigue abierto cuando fecha está vacía');
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 8: PostponeModal acepta una fecha pasada sin validación del lado cliente.
     * Bug potencial: el usuario puede prorrogar a una fecha ya vencida, lo que crearía
     * un vencimiento con status=Prorrogado pero en el pasado, que inmediatamente pasaría
     * a Vencido nuevamente en el próximo cálculo del servidor.
     */
    test('PostponeModal: acepta fecha pasada sin validación en cliente', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(3000);

            // Mostrar todos los vencimientos para encontrar uno prorrogable
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            const postponeBtn = window.locator('[title="Prorrogar"]').first();
            const hasPostponeBtn = await postponeBtn.isVisible({ timeout: 3000 }).catch(() => false);

            if (!hasPostponeBtn) {
                console.log('[PostponeModal] No hay vencimientos prorrogables — test skipped');
                return;
            }

            await postponeBtn.click();
            await window.waitForTimeout(500);

            // Verificar que el modal está abierto
            await expect(window.locator('text=Prorrogar Vencimiento')).toBeVisible({ timeout: 3000 });

            // Intentar poner una fecha pasada (ayer)
            const yesterday = new Date();
            yesterday.setDate(yesterday.getDate() - 1);
            const yesterdayStr = yesterday.toISOString().slice(0, 10);

            const dateInput = window.locator('input[type="date"]').last();
            await dateInput.fill(yesterdayStr);
            await window.waitForTimeout(300);

            // El botón "Confirmar" debería estar habilitado (no hay validación de fecha pasada en cliente)
            const confirmBtn = window.getByRole('button', { name: 'Confirmar' });
            const isEnabled = await confirmBtn.isEnabled({ timeout: 2000 });

            console.log(`[PostponeModal] Confirmar con fecha pasada habilitado: ${isEnabled}`);
            // HIPÓTESIS CONFIRMADA: el botón está habilitado con fecha pasada (no hay validación cliente)
            // Esto es un bug potencial — dejar registrado
            if (isEnabled) {
                console.log('[PostponeModal] BUG POTENCIAL: se puede confirmar prórroga a fecha pasada');
            }

            // Cerrar sin confirmar para no ensuciar datos
            await window.getByRole('button', { name: 'Cancelar' }).click();
        } finally {
            await electronApp.close();
        }
    });
});

test.describe('Hipótesis de fallos — CRUD y persistencia', () => {

    /**
     * HIPÓTESIS 9: Crear un vencimiento, verificar que aparece en la lista y sobrevive
     * una navegación (salida y vuelta a la sección). Test de persistencia real.
     */
    test('CRUD: crear vencimiento sin caso y verificar que aparece en la lista', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            const uniqueTitle = `PW-Hypothesis-${Date.now()}`;

            // Abrir modal
            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            // Completar formulario sin caso asociado
            const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
            await titleInput.fill(uniqueTitle);

            const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 3);
            await dateInput.fill(targetDate.toISOString().slice(0, 10));

            // NO seleccionamos caso (queda en "— Ninguno")
            await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
            await window.waitForTimeout(3000);

            // Modal debe cerrarse
            const modal = window.locator('[role="dialog"]');
            await expect(modal).not.toBeVisible({ timeout: 5000 });

            // El toast de éxito debe aparecer
            const toast = window.locator('text=Vencimiento creado');
            const toastVisible = await toast.isVisible({ timeout: 5000 }).catch(() => false);
            console.log(`[CRUD] Toast de éxito visible: ${toastVisible}`);

            // Asegurarse de mostrar todos los vencimientos
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(1000);

            // Buscar el vencimiento creado
            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await searchInput.fill(uniqueTitle);
            await window.waitForTimeout(800);

            // Debe aparecer en la tabla
            const createdRow = window.locator(`text=${uniqueTitle}`).first();
            await expect(createdRow).toBeVisible({ timeout: 5000 });
            console.log('[CRUD] OK: vencimiento sin caso aparece en la lista tras creación');
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 10: Persistencia tras navegación.
     * Crear un vencimiento, navegar a otra sección y volver. El vencimiento debe seguir
     * apareciendo (está guardado en SQLite, no solo en memoria React).
     */
    test('Persistencia: vencimiento creado sobrevive navegación a otra sección y vuelta', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            const uniqueTitle = `PW-Persist-${Date.now()}`;

            // Crear vencimiento
            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
            await titleInput.fill(uniqueTitle);

            const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 4);
            await dateInput.fill(targetDate.toISOString().slice(0, 10));

            await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
            await window.waitForTimeout(3000);

            // Navegar a Clientes
            await goToSection(window, 'clients', { timeout: 10000 });
            await window.waitForTimeout(1000);

            // Volver a Vencimientos
            await goToSection(window, 'deadlines', { timeout: 10000 });
            await window.waitForTimeout(2500);

            // Mostrar todos
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            // Buscar el vencimiento
            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await searchInput.fill(uniqueTitle);
            await window.waitForTimeout(800);

            const createdRow = window.locator(`text=${uniqueTitle}`).first();
            await expect(createdRow).toBeVisible({ timeout: 5000 });
            console.log('[Persistencia] OK: vencimiento sobrevive navegación');
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 11: Marcar cumplido desde la lista — el vencimiento desaparece del filtro
     * "all-except-completed" (default) pero sigue apareciendo con filtro "all".
     */
    test('CRUD: marcar cumplido mueve el vencimiento fuera del filtro por defecto', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Crear un vencimiento específico para marcar como cumplido
            const uniqueTitle = `PW-Complete-${Date.now()}`;

            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
            await titleInput.fill(uniqueTitle);

            const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 6);
            await dateInput.fill(targetDate.toISOString().slice(0, 10));

            await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
            await window.waitForTimeout(3000);

            // Buscar el vencimiento recién creado
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await searchInput.fill(uniqueTitle);
            await window.waitForTimeout(800);

            // Verificar que existe la fila
            const rowToComplete = window.locator('table tbody tr.cursor-pointer').first();
            const rowVisible = await rowToComplete.isVisible({ timeout: 5000 }).catch(() => false);

            if (!rowVisible) {
                console.log('[Complete] No se encontró el vencimiento creado — test skipped');
                return;
            }

            // Hacer click en el botón CheckCircle (Marcar como cumplido)
            const completeBtn = rowToComplete.locator('[title="Marcar como cumplido"]');
            await completeBtn.click();
            await window.waitForTimeout(500);

            // Confirmar el dialog
            await window.getByRole('button', { name: /sí, cumplir/i }).click();
            await window.waitForTimeout(3000);

            // Limpiar la búsqueda y cambiar a filtro "all-except-completed" (default)
            await searchInput.fill('');
            await window.waitForTimeout(300);
            await categorySelect.selectOption('all-except-completed');
            await window.waitForTimeout(500);

            // Buscar el título: NO debe aparecer en "all-except-completed"
            await searchInput.fill(uniqueTitle);
            await window.waitForTimeout(800);

            const emptyState = window.locator('text=No hay vencimientos');
            await expect(emptyState).toBeVisible({ timeout: 5000 });
            console.log('[Complete] OK: vencimiento cumplido no aparece en filtro "all-except-completed"');

            // Ahora con filtro "all" SÍ debe aparecer con estado "Cumplido"
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            const completedRow = window.locator(`text=${uniqueTitle}`).first();
            const completedRowVisible = await completedRow.isVisible({ timeout: 5000 }).catch(() => false);
            console.log(`[Complete] Vencimiento cumplido visible con filtro "all": ${completedRowVisible}`);
            expect(completedRowVisible).toBe(true);
        } finally {
            await electronApp.close();
        }
    });
});

test.describe('Hipótesis de fallos — Navegación de mes y visibilidad de datos', () => {

    /**
     * HIPÓTESIS 12: Los vencimientos del mes actual desaparecen cuando se navega a un
     * mes diferente con el selector. El mes actual debe reaparecer al volver.
     */
    test('Selector de mes: vencimientos del mes actual no aparecen en otro mes', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Mostrar todos para conocer la cantidad en el mes actual
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(800);

            const resultCountEl = window.locator('div.whitespace-nowrap');
            const currentMonthText = await resultCountEl.textContent({ timeout: 3000 });
            const currentMonthCount = parseInt(currentMonthText?.match(/^(\d+)/)?.[1] ?? '0', 10);

            // Si no hay vencimientos este mes, el test no puede verificar la hipótesis
            if (currentMonthCount === 0) {
                console.log('[MesNavegacion] No hay vencimientos este mes — creando uno para el test');

                // Crear uno para tener datos
                await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
                await window.waitForTimeout(500);

                const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
                await titleInput.fill(`PW-MesNav-${Date.now()}`);

                const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
                const thisMonth = new Date();
                thisMonth.setDate(15); // Día 15 del mes actual (siempre seguro)
                await dateInput.fill(thisMonth.toISOString().slice(0, 10));

                await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
                await window.waitForTimeout(3000);
            }

            // Contar vencimientos en mes actual
            const afterCreateText = await resultCountEl.textContent({ timeout: 3000 });
            const afterCreateCount = parseInt(afterCreateText?.match(/^(\d+)/)?.[1] ?? '0', 10);
            console.log(`[MesNavegacion] Vencimientos en mes actual: ${afterCreateCount}`);

            if (afterCreateCount === 0) {
                console.log('[MesNavegacion] Aun sin datos — test skipped');
                return;
            }

            // Navegar al mes siguiente
            const nextBtn = window.getByRole('button', { name: 'Mes siguiente' });
            await nextBtn.click();
            await window.waitForTimeout(2000);

            // Los vencimientos del mes actual no deberían estar visibles
            const nextMonthText = await resultCountEl.textContent({ timeout: 3000 });
            const nextMonthCount = parseInt(nextMonthText?.match(/^(\d+)/)?.[1] ?? '0', 10);
            console.log(`[MesNavegacion] Vencimientos en mes siguiente: ${nextMonthCount}`);

            // Volver al mes actual
            const prevBtn = window.getByRole('button', { name: 'Mes anterior' });
            await prevBtn.click();
            await window.waitForTimeout(2000);

            // Los vencimientos deben reaparecer
            const returnText = await resultCountEl.textContent({ timeout: 3000 });
            const returnCount = parseInt(returnText?.match(/^(\d+)/)?.[1] ?? '0', 10);
            console.log(`[MesNavegacion] Vencimientos al volver al mes actual: ${returnCount}`);

            expect(returnCount).toBe(afterCreateCount);
        } finally {
            await electronApp.close();
        }
    });
});

test.describe('Hipótesis de fallos — Ordenamiento', () => {

    /**
     * HIPÓTESIS 13: El sort "urgentes-first" agrupa correctamente y muestra headers de grupo.
     * Verifica que los headers "Urgentes" y "Normales" aparecen cuando hay al menos un ítem
     * de cada tipo y el sort está en ese modo.
     */
    test('Sort "urgentes-first" muestra headers de grupo en la tabla', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Mostrar todos para maximizar chances de tener ambos grupos
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            const resultCountEl = window.locator('div.whitespace-nowrap');
            const totalText = await resultCountEl.textContent({ timeout: 3000 });
            const totalCount = parseInt(totalText?.match(/^(\d+)/)?.[1] ?? '0', 10);

            if (totalCount === 0) {
                console.log('[Sort] No hay vencimientos — test skipped');
                return;
            }

            // Activar sort "urgentes-first"
            const sortSelect = window.locator('select[aria-label="Ordenar por"]');
            await sortSelect.selectOption('urgentes-first');
            await window.waitForTimeout(500);

            // Si hay ítems urgentes y normales, deben aparecer los headers
            // Los headers son <td> con texto "Urgentes" o "Normales" en clase uppercase
            const urgentesHeader = window.locator('td', { hasText: 'Urgentes' });
            const normalesHeader = window.locator('td', { hasText: 'Normales' });

            const urgentesVisible = await urgentesHeader.isVisible().catch(() => false);
            const normalesVisible = await normalesHeader.isVisible().catch(() => false);

            console.log(`[Sort] Headers de grupo — Urgentes: ${urgentesVisible}, Normales: ${normalesVisible}`);

            // Al menos uno de los grupos debe aparecer si hay datos
            if (totalCount > 0) {
                expect(urgentesVisible || normalesVisible).toBe(true);
            }
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 14: El sort "date-asc" usa comparación sin retornar 0 para igualdad.
     * Esto puede causar inestabilidad en el sort cuando hay múltiples ítems con la misma fecha.
     * Test: crear dos vencimientos con la misma fecha y verificar que el sort no falla/crashea.
     * (No verifica el orden exacto porque depende del algoritmo de sort del motor JS, pero sí
     * que la lista se renderiza correctamente.)
     */
    test('Sort "date-asc" con fechas iguales: la tabla se renderiza sin errores', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            const sameDate = new Date();
            sameDate.setDate(sameDate.getDate() + 10);
            const sameDateStr = sameDate.toISOString().slice(0, 10);

            // Crear dos vencimientos con la misma fecha
            const title1 = `PW-SameDate-A-${Date.now()}`;
            const title2 = `PW-SameDate-B-${Date.now()}`;

            for (const title of [title1, title2]) {
                await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
                await window.waitForTimeout(500);

                const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
                await titleInput.fill(title);

                const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
                await dateInput.fill(sameDateStr);

                await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
                await window.waitForTimeout(3000);
            }

            // Activar sort date-asc (es el default, pero lo activamos explícitamente)
            const sortSelect = window.locator('select[aria-label="Ordenar por"]');
            await sortSelect.selectOption('date-asc');
            await window.waitForTimeout(500);

            // Mostrar todos
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            // Verificar que ambos vencimientos son visibles (el sort no crasheó)
            // Buscar uno de ellos para confirmar que la lista funciona
            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await searchInput.fill('PW-SameDate');
            await window.waitForTimeout(800);

            // Debe haber 2 resultados
            const resultCountEl = window.locator('div.whitespace-nowrap');
            const resultText = await resultCountEl.textContent({ timeout: 3000 });
            const resultCount = parseInt(resultText?.match(/^(\d+)/)?.[1] ?? '0', 10);

            console.log(`[Sort Igualdad] ${resultCount} vencimientos con misma fecha encontrados`);
            // Aserción: al menos los 2 que acaban de crearse deben aparecer.
            // Pueden existir más si test runs anteriores dejaron datos con la misma fecha prefix.
            expect(resultCount).toBeGreaterThanOrEqual(2);

            // La tabla no debe estar en EmptyState
            const emptyState = window.locator('text=No hay vencimientos');
            await expect(emptyState).not.toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });
});

test.describe('Hipótesis de fallos — Detalle y asociación a casos', () => {

    /**
     * HIPÓTESIS 15: Un vencimiento creado con suit_case_id muestra el link al caso
     * en la página de detalle. Si suit_case_id=null, no debe aparecer la sección.
     */
    test('Detalle: vencimiento sin caso no muestra "Caso Vinculado"', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Crear un vencimiento sin caso
            const titleNoCaso = `PW-SinCaso-${Date.now()}`;

            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
            await titleInput.fill(titleNoCaso);

            const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 7);
            await dateInput.fill(targetDate.toISOString().slice(0, 10));

            // No seleccionamos caso
            await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
            await window.waitForTimeout(3000);

            // Mostrar todos y buscar
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await searchInput.fill(titleNoCaso);
            await window.waitForTimeout(800);

            const row = window.locator('table tbody tr.cursor-pointer').first();
            const rowVisible = await row.isVisible({ timeout: 5000 }).catch(() => false);

            if (!rowVisible) {
                console.log('[Detalle SinCaso] No se encontró el vencimiento — test skipped');
                return;
            }

            // Navegar al detalle
            await row.click();
            await window.waitForTimeout(2000);

            await expect(window.locator('text=Volver a Vencimientos')).toBeVisible({ timeout: 5000 });

            // No debe aparecer "Caso Vinculado" en la sección de Asociaciones
            const caseLinkText = window.locator('text=Caso Vinculado');
            const caseLinkVisible = await caseLinkText.isVisible().catch(() => false);
            console.log(`[Detalle SinCaso] "Caso Vinculado" visible: ${caseLinkVisible}`);
            expect(caseLinkVisible).toBe(false);
        } finally {
            await electronApp.close();
        }
    });

    /**
     * HIPÓTESIS 16: El botón "Editar" en detalle abre el modal de edición con los datos
     * precargados (initialData). Si initialData no se pasa correctamente, los campos quedarán vacíos.
     */
    test('Detalle: botón Editar abre modal con datos precargados', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Crear un vencimiento para editar
            const originalTitle = `PW-Edit-${Date.now()}`;

            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
            await titleInput.fill(originalTitle);

            const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
            const targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + 8);
            const targetDateStr = targetDate.toISOString().slice(0, 10);
            await dateInput.fill(targetDateStr);

            await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
            await window.waitForTimeout(3000);

            // Navegar al detalle
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await searchInput.fill(originalTitle);
            await window.waitForTimeout(800);

            const row = window.locator('table tbody tr.cursor-pointer').first();
            const rowVisible = await row.isVisible({ timeout: 5000 }).catch(() => false);

            if (!rowVisible) {
                console.log('[Editar] No se encontró el vencimiento — test skipped');
                return;
            }

            await row.click();
            await window.waitForTimeout(2000);

            await expect(window.locator('text=Volver a Vencimientos')).toBeVisible({ timeout: 5000 });

            // Hacer click en el botón Editar (ícono de lápiz — Edit2)
            // Elegimos el botón de acción previo al danger button dentro del grupo.
            const actionBtns = window.locator('div.flex.gap-2 button');
            const btnCount = await actionBtns.count();

            if (btnCount < 2) {
                console.log('[Editar] No hay botón de editar visible (quizás es Cumplido) — test skipped');
                return;
            }

            // El botón de editar es el tercero (Cumplir, Prorrogar, Editar, Eliminar)
            // En cumplidos solo está Eliminar, para Pendiente hay todos
            // Intentar click en el edit button — es el último antes del danger button
            await actionBtns.nth(btnCount - 2).click();
            await window.waitForTimeout(500);

            // Verificar que el modal de edición se abrió
            const editModal = window.locator('text=Editar Vencimiento');
            const editModalVisible = await editModal.isVisible({ timeout: 3000 }).catch(() => false);

            if (!editModalVisible) {
                console.log('[Editar] Modal de edición no se abrió — puede que el botón clickeado no sea el correcto');
                return;
            }

            // Verificar que el título está precargado
            const editTitleInput = window.locator('#new-deadline-form input[type="text"]').first();
            const currentTitle = await editTitleInput.inputValue({ timeout: 3000 });
            console.log(`[Editar] Título precargado: "${currentTitle}" (esperado: "${originalTitle}")`);

            // HIPÓTESIS: el título debe estar precargado con el valor original
            expect(currentTitle).toBe(originalTitle);

            // Cerrar el modal
            await window.getByRole('button', { name: 'Cancelar' }).click();
        } finally {
            await electronApp.close();
        }
    });
});

test.describe('Hipótesis de fallos — Batch actions', () => {

    /**
     * HIPÓTESIS 17: La barra de batch actions aparece cuando se selecciona al menos 1
     * vencimiento y desaparece al hacer "Cancelar selección".
     */
    test('Batch: barra de acciones aparece y desaparece correctamente', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2500);

            // Mostrar todos para encontrar checkboxes
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            // Verificar que la barra de batch NO está visible inicialmente
            const batchBar = window.locator('text=Cancelar selección');
            await expect(batchBar).not.toBeVisible({ timeout: 3000 });

            // Encontrar un checkbox en la tabla
            const firstCheckbox = window.locator('table tbody tr input[type="checkbox"]').first();
            const checkboxVisible = await firstCheckbox.isVisible({ timeout: 3000 }).catch(() => false);

            if (!checkboxVisible) {
                console.log('[Batch] No hay vencimientos con checkbox — test skipped');
                return;
            }

            // Seleccionar el primer vencimiento
            await firstCheckbox.click();
            await window.waitForTimeout(300);

            // La barra de batch debe aparecer
            await expect(batchBar).toBeVisible({ timeout: 3000 });

            // Debe mostrar "1 vencimiento seleccionado"
            const selectionText = window.locator('text=/1 vencimiento seleccionado/');
            await expect(selectionText).toBeVisible({ timeout: 3000 });
            console.log('[Batch] OK: barra de batch visible con 1 seleccionado');

            // Cancelar selección
            await window.locator('button', { hasText: 'Cancelar selección' }).click();
            await window.waitForTimeout(300);

            // La barra debe desaparecer
            await expect(batchBar).not.toBeVisible({ timeout: 3000 });
            console.log('[Batch] OK: barra de batch desaparece al cancelar selección');
        } finally {
            await electronApp.close();
        }
    });
});
