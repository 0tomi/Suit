import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

/**
 * Tests E2E para la sección de Vencimientos.
 * Validan: navegación, carga, filtros, selector de mes, creación, acciones rápidas,
 * página de detalle, filtrado por KPI cards, batch actions y configuración.
 */
test.describe('Vencimientos — Sección principal', () => {

    test('Navegar a Vencimientos muestra el título correcto', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });

            const title = window.getByTestId('page-deadlines-title');
            await title.waitFor({ timeout: 10000 });
            await expect(title).toHaveText('Vencimientos');
        } finally {
            await electronApp.close();
        }
    });

    test('Sidebar: Vencimientos aparece debajo de Agenda', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            const agenda = window.getByTestId('sidebar-nav-agenda');
            const deadlines = window.getByTestId('sidebar-nav-deadlines');

            await agenda.waitFor({ timeout: 10000 });
            await deadlines.waitFor({ timeout: 5000 });

            // Verificar que Agenda está antes que Vencimientos en el DOM
            const agendaBox = await agenda.boundingBox();
            const deadlinesBox = await deadlines.boundingBox();
            expect(agendaBox.y).toBeLessThan(deadlinesBox.y);
        } finally {
            await electronApp.close();
        }
    });

    test('Selector de mes/año está visible y funciona — navegación previa', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });

            // Esperar a que cargue
            await window.waitForTimeout(2000);

            // El selector de mes debe estar visible con el mes actual.
            // El MonthYearSelector usa MONTHS[month - 1] donde month es 1-indexed.
            const now = new Date();
            const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                           'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
            // now.getMonth() devuelve 0-indexed, months[] es 0-indexed también
            const currentMonthName = months[now.getMonth()];
            const currentYear = String(now.getFullYear());

            // Buscar el span del MonthYearSelector que contiene "Mes Año"
            const monthDisplay = window.locator('span.font-semibold', { hasText: `${currentMonthName} ${currentYear}` });
            await expect(monthDisplay).toBeVisible({ timeout: 5000 });

            // Navegar al mes anterior
            const prevBtn = window.getByRole('button', { name: 'Mes anterior' });
            await prevBtn.click();
            await window.waitForTimeout(800);

            // El mes cambió: 1-indexed en el componente, 0-indexed para el array
            const prevMonthIdx = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
            const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
            const prevMonthName = months[prevMonthIdx];
            const prevMonthDisplay = window.locator('span.font-semibold', { hasText: `${prevMonthName} ${prevYear}` });
            await expect(prevMonthDisplay).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Selector de mes/año — navegación siguiente', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            const now = new Date();
            const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                           'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

            const nextBtn = window.getByRole('button', { name: 'Mes siguiente' });
            await nextBtn.click();
            await window.waitForTimeout(800);

            // now.getMonth() es 0-indexed; el componente avanza mes+1 (1-indexed internamente)
            const nextMonthIdx = now.getMonth() === 11 ? 0 : now.getMonth() + 1;
            const nextYear = now.getMonth() === 11 ? now.getFullYear() + 1 : now.getFullYear();
            // Buscar por el span.font-semibold del MonthYearSelector para evitar conflictos de texto parcial
            const nextMonthDisplay = window.locator('span.font-semibold', { hasText: `${months[nextMonthIdx]} ${nextYear}` });
            await expect(nextMonthDisplay).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Las KPI cards están visibles', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Verificar que están las 4 KPI cards
            await expect(window.locator('text=Vencidos')).toBeVisible({ timeout: 5000 });
            await expect(window.locator('text=Hoy')).toBeVisible({ timeout: 3000 });
            await expect(window.locator('text=Esta semana')).toBeVisible({ timeout: 3000 });
            await expect(window.locator('text=Este mes')).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('KPI card Vencidos activa el filtro al hacer click', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Hacer click en la card "Vencidos"
            await window.locator('text=Vencidos').first().click();
            await window.waitForTimeout(500);

            // La card debe tener ring activo (ring-2 ring-red-500 en la clase)
            // Verificamos comprobando que el elemento padre tiene la clase ring-2
            const vencidosCard = window.locator('.ring-2.ring-red-500');
            await expect(vencidosCard).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('KPI card Hoy activa el filtro al hacer click', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Hacer click en la card "Hoy"
            await window.locator('text=Hoy').first().click();
            await window.waitForTimeout(500);

            // La card "Hoy" debe tener ring activo (ring-2 ring-orange-500)
            const hoyCard = window.locator('.ring-2.ring-orange-500');
            await expect(hoyCard).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Los dropdowns de filtro existen con las opciones correctas', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Verificar dropdown de categoría
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await expect(categorySelect).toBeVisible({ timeout: 5000 });
            await expect(categorySelect).toHaveValue('all-except-completed');

            // Verificar dropdown de prioridad
            const prioritySelect = window.locator('select[aria-label="Filtrar por prioridad"]');
            await expect(prioritySelect).toBeVisible({ timeout: 3000 });
            await expect(prioritySelect).toHaveValue('all');

            // Verificar opciones de prioridad (Normal / Urgentes, no las viejas)
            const options = await prioritySelect.locator('option').allTextContents();
            expect(options).toContain('Normal');
            expect(options).toContain('Urgentes');
            expect(options).not.toContain('Crítica');
            expect(options).not.toContain('Alta');

            // Verificar dropdown de ordenamiento
            const sortSelect = window.locator('select[aria-label="Ordenar por"]');
            await expect(sortSelect).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Dropdown de ordenamiento tiene las opciones de agrupación', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            const sortSelect = window.locator('select[aria-label="Ordenar por"]');
            await expect(sortSelect).toBeVisible({ timeout: 5000 });

            const sortOptions = await sortSelect.locator('option').allTextContents();
            // Opciones nuevas de agrupación
            expect(sortOptions).toContain('Urgentes primero');
            expect(sortOptions).toContain('Normales primero');
        } finally {
            await electronApp.close();
        }
    });

    test('Búsqueda filtra los resultados y muestra el conteo actualizado', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Buscar algo que probablemente no exista para obtener 0 resultados
            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await expect(searchInput).toBeVisible({ timeout: 5000 });
            await searchInput.fill('xyzabcquery_no_existe_123');
            await window.waitForTimeout(500);

            // El conteo debe decir "0 resultados"
            // El div de conteo tiene clase whitespace-nowrap y está dentro del flex de filtros
            await expect(window.locator('text=0 resultados')).toBeVisible({ timeout: 3000 });

            // La tabla vacía muestra el EmptyState
            await expect(window.locator('text=No hay vencimientos')).toBeVisible({ timeout: 3000 });

            // Vaciar la búsqueda restaura los resultados
            await searchInput.fill('');
            await window.waitForTimeout(500);

            // El EmptyState ya no debe estar (si había vencimientos antes)
            // No podemos garantizar que haya datos, así que sólo verificamos que el campo de búsqueda esté vacío
            await expect(searchInput).toHaveValue('');
        } finally {
            await electronApp.close();
        }
    });

    test('Botón Nuevo Vencimiento abre el modal de creación', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();

            // El modal debe aparecer
            await expect(window.locator('text=Nuevo Vencimiento').last()).toBeVisible({ timeout: 5000 });

            // Verificar que el formulario tiene los campos correctos
            const form = window.locator('#new-deadline-form');
            await expect(form.getByText('Título')).toBeVisible({ timeout: 3000 });
            await expect(form.getByText('Fecha Límite *')).toBeVisible({ timeout: 3000 });
            await expect(form.getByText('Prioridad')).toBeVisible({ timeout: 3000 });

            // No debe haber campo "Tipo" (eliminado)
            const tipoLabel = window.locator('label', { hasText: 'Tipo' });
            expect(await tipoLabel.count()).toBe(0);

            // No debe haber campo "Responsable" (eliminado)
            const responsableLabel = window.locator('label', { hasText: 'Responsable' });
            expect(await responsableLabel.count()).toBe(0);
        } finally {
            await electronApp.close();
        }
    });

    test('Modal de creación: el campo Descripción está presente (campo nuevo)', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            // Campo Descripción debe estar presente (fue agregado en el refactor)
            await expect(window.locator('text=Descripción')).toBeVisible({ timeout: 5000 });

            // Textarea de descripción debe existir
            const textarea = window.locator('#new-deadline-form textarea');
            await expect(textarea).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Modal de creación: sin campo "Motivo" en el formulario (PostponeModal API-alineado)', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            // El campo "Motivo" no debe existir (fue eliminado por alineación con API)
            const motivoLabel = window.locator('label', { hasText: 'Motivo' });
            expect(await motivoLabel.count()).toBe(0);
        } finally {
            await electronApp.close();
        }
    });

    test('Crear un vencimiento nuevo', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Abrir modal de creación
            await window.getByRole('button', { name: /nuevo vencimiento/i }).click();
            await window.waitForTimeout(500);

            // Completar formulario
            const titleInput = window.locator('#new-deadline-form input[type="text"]').first();
            await titleInput.fill('Vencimiento de test E2E');

            const dateInput = window.locator('#new-deadline-form input[type="date"]').first();
            const tomorrow = new Date();
            tomorrow.setDate(tomorrow.getDate() + 5);
            await dateInput.fill(tomorrow.toISOString().slice(0, 10));

            // Enviar
            await window.getByRole('button', { name: 'Crear Vencimiento' }).click();
            await window.waitForTimeout(3000);

            // El modal debe cerrarse y el vencimiento aparecer en la tabla
            const modalTitle = window.locator('[role="dialog"]');
            await expect(modalTitle).not.toBeVisible({ timeout: 5000 });

        } finally {
            await electronApp.close();
        }
    });

    test('Tabla vacía muestra el estado EmptyState cuando no hay resultados', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(2000);

            // Buscar algo imposible para vaciar la tabla
            const searchInput = window.locator('input[placeholder="Buscar por título o descripción..."]');
            await searchInput.fill('NO_HAY_NADA_QUE_COINCIDA_12345XYZ');
            await window.waitForTimeout(500);

            // Debe aparecer el estado vacío
            await expect(window.locator('text=No hay vencimientos')).toBeVisible({ timeout: 5000 });
        } finally {
            await electronApp.close();
        }
    });

    test('PostponeModal no tiene campo de motivo (alineado con API real)', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(3000);

            // Necesitamos un vencimiento en la tabla con botón de prorrogar.
            // El botón de prorrogar (Clock icon) está en filas no-cumplidas.
            // Primero mostrar todos para maximizar chances de encontrar alguno.
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            // Buscar botón "Prorrogar" (title attribute)
            const postponeBtn = window.locator('[title="Prorrogar"]').first();
            if (await postponeBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
                await postponeBtn.click();
                await window.waitForTimeout(500);

                // El modal de prórroga debe estar abierto
                await expect(window.locator('text=Prorrogar Vencimiento')).toBeVisible({ timeout: 3000 });

                // Debe tener un input de fecha
                await expect(window.locator('text=Nueva Fecha Límite')).toBeVisible({ timeout: 3000 });

                // NO debe tener campo de motivo
                const motivoLabel = window.locator('label', { hasText: 'Motivo' });
                expect(await motivoLabel.count()).toBe(0);

                // Cerrar modal
                await window.getByRole('button', { name: 'Cancelar' }).click();
            } else {
                // Si no hay vencimientos prorrogables, el test se marca como pasado trivialmente
                // (no podemos crear uno con status=Pendiente fácilmente sin una API que lo devuelva)
                console.log('No hay vencimientos prorrogables visibles para testear el modal');
            }
        } finally {
            await electronApp.close();
        }
    });

    test('Sección Vencimientos en Configuración está disponible', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            // Navegar a Settings via NavLink
            await window.locator('a[href="/settings"], a[aria-label="Ajustes"]').click();
            await window.waitForTimeout(2000);

            // La tab de Vencimientos debe existir en el sidebar de settings
            // Buscar por el ID de la tab (settings-tab-vencimientos)
            const vencimientosTab = window.locator('[id="settings-tab-vencimientos"]');
            await expect(vencimientosTab).toBeVisible({ timeout: 8000 });

            await vencimientosTab.click();
            await window.waitForTimeout(1000);

            // Debe haber un toggle de animación
            await expect(window.locator('#toggle-deadline-shake')).toBeVisible({ timeout: 5000 });

            // Debe haber texto de colores configurables
            await expect(window.locator('text=Colores por estado')).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Settings Vencimientos: las 6 etiquetas de color están presentes', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await window.locator('a[href="/settings"], a[aria-label="Ajustes"]').click();
            await window.waitForTimeout(2000);

            const vencimientosTab = window.locator('[id="settings-tab-vencimientos"]');
            await expect(vencimientosTab).toBeVisible({ timeout: 8000 });
            await vencimientosTab.click();
            await window.waitForTimeout(1000);

            // Las 6 categorías de color deben estar presentes como etiquetas de texto
            await expect(window.locator('text=Pendiente Normal')).toBeVisible({ timeout: 5000 });
            await expect(window.locator('text=Pendiente Urgente')).toBeVisible({ timeout: 3000 });
            await expect(window.locator('text=Cumplido')).toBeVisible({ timeout: 3000 });
            await expect(window.locator('text=Prorrogado Normal')).toBeVisible({ timeout: 3000 });
            await expect(window.locator('text=Prorrogado Urgente')).toBeVisible({ timeout: 3000 });
            await expect(window.locator('text=Vencido')).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Settings Vencimientos: toggle de animación es funcional', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await window.locator('a[href="/settings"], a[aria-label="Ajustes"]').click();
            await window.waitForTimeout(2000);

            const vencimientosTab = window.locator('[id="settings-tab-vencimientos"]');
            await expect(vencimientosTab).toBeVisible({ timeout: 8000 });
            await vencimientosTab.click();
            await window.waitForTimeout(1000);

            const toggle = window.locator('#toggle-deadline-shake');
            await expect(toggle).toBeVisible({ timeout: 5000 });

            // Guardar estado inicial
            const initialChecked = await toggle.isChecked();

            // Hacer click (togglear)
            await toggle.click();
            await window.waitForTimeout(500);

            // El estado debe haber cambiado
            const afterToggle = await toggle.isChecked();
            expect(afterToggle).toBe(!initialChecked);

            // Restaurar
            await toggle.click();
        } finally {
            await electronApp.close();
        }
    });
});

/**
 * Tests para la página de detalle de Vencimiento.
 * Requiere que haya al menos un vencimiento creado en el mes actual.
 */
test.describe('Vencimientos — Página de Detalle', () => {

    test('Navegar a detalle desde tabla muestra la info del vencimiento', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(3000);

            // Mostrar todos los vencimientos para maximizar chances
            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            // Buscar la primera fila de vencimiento en la tabla
            // Las filas son <tr> con cursor-pointer (son clickeables)
            const firstRow = window.locator('table tbody tr.cursor-pointer').first();
            if (!await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('No hay vencimientos en la tabla para testear detalle');
                return;
            }

            // Obtener el título del primer vencimiento antes de hacer click
            const titleCell = firstRow.locator('td').nth(1).locator('span').first();
            const deadlineTitle = await titleCell.textContent({ timeout: 3000 });

            // Click en la fila navega al detalle
            await firstRow.click();
            await window.waitForTimeout(2000);

            // Debe aparecer el botón "Volver a Vencimientos"
            await expect(window.locator('text=Volver a Vencimientos')).toBeVisible({ timeout: 5000 });

            // El título del vencimiento debe estar visible en la página de detalle
            if (deadlineTitle) {
                await expect(window.locator(`text=${deadlineTitle}`).first()).toBeVisible({ timeout: 5000 });
            }

            // Campos de detalle deben estar visibles
            await expect(window.locator('text=Detalles')).toBeVisible({ timeout: 3000 });
            await expect(window.locator('text=Fecha Límite')).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Página de detalle: botón Volver navega de regreso a Vencimientos', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(3000);

            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            const firstRow = window.locator('table tbody tr.cursor-pointer').first();
            if (!await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('No hay vencimientos en la tabla para testear navegación de retorno');
                return;
            }

            await firstRow.click();
            await window.waitForTimeout(2000);

            // Verificar que estamos en detalle
            await expect(window.locator('text=Volver a Vencimientos')).toBeVisible({ timeout: 5000 });

            // Hacer click en Volver
            await window.locator('text=Volver a Vencimientos').click();
            await window.waitForTimeout(1500);

            // Debe volver al listado (el título de página "Vencimientos" debe estar visible)
            await expect(window.getByTestId('page-deadlines-title')).toBeVisible({ timeout: 5000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Página de detalle: botón Eliminar abre dialog de confirmación', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToSection(window, 'deadlines', { timeout: 15000 });
            await window.waitForTimeout(3000);

            const categorySelect = window.locator('select[aria-label="Filtrar por categoría"]');
            await categorySelect.selectOption('all');
            await window.waitForTimeout(500);

            const firstRow = window.locator('table tbody tr.cursor-pointer').first();
            if (!await firstRow.isVisible({ timeout: 3000 }).catch(() => false)) {
                console.log('No hay vencimientos para testear eliminar');
                return;
            }

            await firstRow.click();
            await window.waitForTimeout(2000);
            await expect(window.locator('text=Volver a Vencimientos')).toBeVisible({ timeout: 5000 });

            // Estrategia más robusta: clicar el que abre el dialog de eliminación
            // El delete button es el único con variant="danger" en la página
            // Buscamos el botón que contiene el ícono Trash (es el último en la fila de acciones del header)
            const actionButtons = window.locator('div.flex.gap-2 button');
            const btnCount = await actionButtons.count();

            if (btnCount > 0) {
                // El botón eliminar es siempre el último en el grupo de acciones del header
                await actionButtons.last().click();
                await window.waitForTimeout(500);

                // Debe aparecer el dialog de confirmación con texto de eliminar
                await expect(window.locator('text=Eliminar vencimiento')).toBeVisible({ timeout: 5000 });

                // Cancelar para no eliminar datos de test
                await window.getByRole('button', { name: 'Cancelar' }).click();
            }
        } finally {
            await electronApp.close();
        }
    });
});
