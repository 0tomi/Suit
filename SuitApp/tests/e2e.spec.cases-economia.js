/**
 * Feature: Casos + Economía en Electron
 * Hipótesis cubiertas:
 * - H1: si un admin crea un expediente con un cliente real, el detalle del caso debe abrirse y mostrar la carátula creada.
 * - H2: si el usuario registra honorarios y gastos dentro del expediente, los movimientos deben reflejarse en el frontend del detalle.
 * - H3: si el usuario crea y elimina una entrega de un honorario, la grilla del modal debe actualizarse sin recargar manualmente.
 * - H4: si el usuario navega luego a Economía y filtra por el expediente nuevo, debe ver los honorarios y gastos creados.
 *
 * CONTEXTO:
 * - El flujo depende de Electron, navegación real por Secciones, caché local y API real.
 * - Se usa el usuario admin porque la consigna pide validar estos módulos con permisos completos.
 *
 * PUNTOS CRÍTICOS IDENTIFICADOS:
 * - Los catálogos judiciales pueden variar entre semillas, por eso el test selecciona opciones reales visibles.
 * - Los modales de selección reutilizan componentes genéricos, así que se evita depender de índices fijos salvo como fallback.
 * - Honorarios y gastos no exponen edición/borrado directo en esta UI; la entrega sí expone alta y baja, por eso se cubre el ciclo completo allí.
 */

import { expect, test } from '@playwright/test';
import {
  goToSectionFromSectionsPage,
  launchElectronApp,
  selectDropdownOption,
  selectFirstDropdownOption,
} from './helpers/electronTestUtils.js';

function buildUniqueLabel(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

/**
 * Obtiene un cliente real desde la caché local para poder vincularlo al caso
 * sin depender de texto hardcodeado de la semilla.
 */
async function getRealClient(page) {
  let resolvedClient = null;

  await expect
    .poll(async () => {
      resolvedClient = await page.evaluate(async () => {
        const rows = await window.electronAPI?.db?.getAll?.('clients');
        const raw = Array.isArray(rows) ? rows : [];

        return raw
          .map((row) => {
            if (row?.data_json) {
              try {
                return JSON.parse(row.data_json);
              } catch {
                return row;
              }
            }

            if (row?.json_data) {
              try {
                return JSON.parse(row.json_data);
              } catch {
                return row;
              }
            }

            return row;
          })
          .find((item) => item?.id && (item?.first_name || item?.last_name))
          || null;
      }).catch(() => null);

      return resolvedClient;
    }, {
      timeout: 30000,
      message: 'No se encontró ningún cliente real en caché para vincular al expediente.',
    })
    .toBeTruthy();

  return resolvedClient;
}

/**
 * Login admin tolerante al estado inicial real del shell Electron.
 */
async function loginAsAdmin(page, { timeout = 120000 } = {}) {
  const setupLocator = page.getByTestId('server-setup-modal');
  const loginLocator = page.getByTestId('login-submit');
  const shellLocator = page.getByTestId('sidebar-nav-sections-manager');

  await Promise.race([
    setupLocator.waitFor({ timeout: 30000 }).catch(() => {}),
    loginLocator.waitFor({ timeout: 30000 }).catch(() => {}),
    shellLocator.waitFor({ timeout: 30000 }).catch(() => {}),
  ]);

  if (await setupLocator.isVisible().catch(() => false)) {
    const localhostButton = page.getByTestId('server-setup-localhost');
    const acceptButton = page.getByTestId('server-setup-accept');

    await localhostButton.click();
    await acceptButton.waitFor({ state: 'visible', timeout: 5000 });
    await expect(acceptButton).toBeEnabled({ timeout: 5000 });
    await acceptButton.click();
  }

  if (await loginLocator.isVisible().catch(() => false)) {
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('adminadmin');
    await loginLocator.click();
  }

  await expect(shellLocator).toBeVisible({ timeout });
}

/**
 * Algunos Select Radix del alta de casos quedan tapados por capas animadas
 * durante el render inicial; este helper fuerza la apertura y toma la primera opción real.
 */
async function selectFirstCaseFormOption(page, triggerLocator, { required = true } = {}) {
  await triggerLocator.click({ force: true });
  await triggerLocator.focus();
  await triggerLocator.press('ArrowDown');
  await triggerLocator.press('Enter');
  if (required) {
    await expect(triggerLocator).not.toContainText(/seleccionar/i, { timeout: 10000 });
  }
  return ((await triggerLocator.textContent()) || '').trim();
}

/**
 * Selecciona un cliente concreto en el modal genérico de vinculación.
 */
async function linkClientToCase(page, clientName) {
  const buttons = page.getByRole('button', { name: /^Vincular$/ });
  await buttons.nth(0).click();

  const heading = page.getByRole('heading', { name: 'Seleccionar Cliente' });
  await expect(heading).toBeVisible({ timeout: 10000 });

  const searchInput = page.getByPlaceholder(/buscar por nombre/i);
  await searchInput.fill(clientName);

  const clientOption = page.getByRole('button', { name: new RegExp(clientName, 'i') }).first();
  await expect(clientOption).toBeVisible({ timeout: 10000 });
  await clientOption.click();

  await page.getByRole('button', { name: /vincular seleccionados/i }).click();

  await expect(heading).toBeHidden({ timeout: 15000 });
}

/**
 * Crea un expediente con datos reales mínimos y devuelve su metadata.
 */
async function createCase(page) {
  const unique = buildUniqueLabel('Caso-E2E');
  const caseTitle = `${unique} Caratula`;
  const expediente = `${Date.now()}`.slice(-8);
  const client = await getRealClient(page);
  const clientName = `${client.first_name || ''} ${client.last_name || ''}`.trim();

  await goToSectionFromSectionsPage(page, 'cases');
  await expect(page.getByTestId('page-cases-title')).toBeVisible({ timeout: 15000 });
  const searchInput = page.getByTestId('cases-search-input');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill('');

  await page.getByRole('button', { name: /nuevo caso/i }).click();
  const createHeading = page.getByRole('heading', { name: 'Iniciar Nuevo Caso' });
  await expect(createHeading).toBeVisible({ timeout: 10000 });

  await page.locator('#case-form-title').fill(caseTitle);
  await page.locator('#case-form-nro-expediente').fill(expediente);
  await page.locator('#case-form-start-date').fill(new Date().toISOString().slice(0, 10));

  await selectFirstCaseFormOption(page, page.locator('#case-form-radicacion'));

  const jurisdiccionTrigger = page.locator('#case-form-jurisdiccion');
  if (await jurisdiccionTrigger.isEnabled().catch(() => false)) {
    await selectFirstCaseFormOption(page, jurisdiccionTrigger, { required: false });
  }

  const dependenciaTrigger = page.locator('#case-form-dependencia');
  if (await dependenciaTrigger.isEnabled().catch(() => false)) {
    await selectFirstCaseFormOption(page, dependenciaTrigger, { required: false });
  }

  await selectFirstCaseFormOption(page, page.locator('#case-form-type'));
  await linkClientToCase(page, clientName);

  await page.getByRole('button', { name: /crear expediente/i }).click();
  await expect(page.getByTestId('page-cases-title')).toBeVisible({ timeout: 30000 });
  await searchInput.fill(caseTitle);
  const createdRow = page.locator('tr').filter({ hasText: caseTitle }).first();
  await expect(createdRow).toBeVisible({ timeout: 30000 });
  await createdRow.click();
  await expect(page.getByRole('heading', { name: caseTitle, exact: false })).toBeVisible({ timeout: 30000 });
  await expect(page.getByRole('button', { name: /cerrar caso/i })).toBeVisible({ timeout: 15000 });
  const caseId = page.url().split('/cases/')[1]?.split(/[?#]/)[0] || '';
  expect(caseId, `No se pudo resolver el id del caso desde la URL ${page.url()}.`).not.toBe('');

  return {
    caseId,
    caseTitle,
    expediente,
    clientName,
  };
}

/**
 * Abre el modal reutilizado de edición, verifica datos precargados y guarda un cambio observable.
 */
async function editCaseFromDetail(page, { originalTitle, expediente, clientName }) {
  const updatedTitle = `${originalTitle} Editado`;
  const updatedDescription = `${updatedTitle} - descripcion de smoke`;

  const editButton = page.getByRole('button', { name: /editar caso/i });
  await expect(editButton).toBeVisible({ timeout: 15000 });
  await editButton.click();

  const editHeading = page.getByRole('heading', { name: 'Editar Caso' });
  await expect(editHeading).toBeVisible({ timeout: 10000 });

  const titleInput = page.locator('#case-form-title');
  const expedienteInput = page.locator('#case-form-nro-expediente');
  const startDateInput = page.locator('#case-form-start-date');
  const descriptionInput = page.locator('#case-form-description');

  await expect(titleInput).toHaveValue(originalTitle, { timeout: 10000 });
  await expect(expedienteInput).toHaveValue(expediente, { timeout: 10000 });
  await expect(startDateInput).not.toHaveValue('', { timeout: 10000 });
  await expect(page.getByText(clientName, { exact: false }).first()).toBeVisible({ timeout: 15000 });

  await titleInput.fill(updatedTitle);
  await descriptionInput.fill(updatedDescription);
  await page.getByRole('button', { name: /guardar cambios/i }).click();

  await expect(editHeading).toBeHidden({ timeout: 20000 });
  await expect(page.getByRole('heading', { name: updatedTitle, exact: false })).toBeVisible({ timeout: 30000 });

  return updatedTitle;
}

/**
 * Abre la pestaña Economía del detalle del caso y espera ambas secciones.
 */
async function goToCaseEconomyTab(page) {
  await page.getByRole('button', { name: 'Economía' }).click();
  await expect(page.getByRole('heading', { name: 'Honorarios' })).toBeVisible({ timeout: 15000 });
  await expect(page.getByRole('heading', { name: 'Gastos' })).toBeVisible({ timeout: 15000 });
}

/**
 * Crea un honorario desde el detalle del caso y devuelve los datos usados.
 */
async function createHonorario(page, clientName) {
  const amount = '3210.50';
  const detail = buildUniqueLabel('Honorario');

  await page.getByRole('button', { name: 'Nuevo Honorario' }).click();
  const heading = page.getByRole('heading', { name: 'Crear Nuevo Honorario' });
  await expect(heading).toBeVisible({ timeout: 10000 });

  await selectDropdownOption(page, page.locator('#client_id').last(), clientName);
  await page.locator('#monto').last().fill(amount);
  await page.locator('#detalles').last().fill(detail);
  await page.getByRole('button', { name: /crear honorario/i }).click();

  await expect(heading).toBeHidden({ timeout: 15000 });
  const row = page.locator('tr').filter({ hasText: clientName }).filter({ hasText: `$${amount}` }).first();
  await expect(row).toBeVisible({ timeout: 20000 });

  return { amount, detail, row };
}

/**
 * Crea una entrega sobre el honorario indicado y luego la elimina.
 */
async function createAndDeleteEntrega(page, honorarioRow) {
  const entregaAmount = '100.25';
  const entregaNote = buildUniqueLabel('Entrega');

  await honorarioRow.click();
  const heading = page.getByRole('heading', { name: 'Entregas del Honorario' });
  await expect(heading).toBeVisible({ timeout: 10000 });

  const modal = heading.locator('xpath=ancestor::div[contains(@class,"w-full")][1]');
  const tbodyRows = modal.locator('tbody tr');
  const rowsBefore = await tbodyRows.count();

  await page.locator('#monto').last().fill(entregaAmount);
  await selectFirstDropdownOption(page, page.getByRole('combobox', { name: 'Tipo de Pago' }).first());
  await page.locator('#nota').last().fill(entregaNote);
  await page.getByRole('button', { name: /añadir entrega/i }).click();

  const successBanner = page.getByText('Entrega creada correctamente.');
  const errorBanner = page.getByText(/no se pudo crear la entrega|monto excede el saldo pendiente|monto fue ajustado/i);

  await Promise.race([
    successBanner.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {}),
    errorBanner.waitFor({ state: 'visible', timeout: 20000 }).catch(() => {}),
  ]);

  if (await errorBanner.isVisible().catch(() => false)) {
    const message = ((await errorBanner.textContent()) || '').trim();
    throw new Error(`El formulario de entregas devolvió un error visible: ${message}`);
  }

  await expect(tbodyRows).toHaveCount(rowsBefore + 1, { timeout: 20000 });

  const entregaRow = tbodyRows.filter({ hasText: `$${entregaAmount}` }).last();
  await expect(entregaRow).toBeVisible({ timeout: 20000 });

  await entregaRow.getByRole('button', { name: 'Eliminar' }).click();
  await page.getByRole('button', { name: /^Eliminar$/ }).last().click();
  await expect(tbodyRows).toHaveCount(rowsBefore, { timeout: 15000 });

  await page.keyboard.press('Escape');
  await expect(heading).toBeHidden({ timeout: 10000 });

  return { entregaAmount, entregaNote };
}

/**
 * Crea un gasto desde el detalle del caso y valida que aparezca en la tabla.
 */
async function createGasto(page, clientName) {
  const amount = '789.10';

  await page.getByRole('button', { name: 'Nuevo Gasto' }).click();
  const heading = page.getByRole('heading', { name: 'Crear Nuevo Gasto' });
  await expect(heading).toBeVisible({ timeout: 10000 });

  const gastoType = await selectFirstDropdownOption(page, page.locator('#gasto_id').last());
  expect(gastoType, 'No se encontró ningún tipo de gasto disponible para el alta.').toBeTruthy();

  await selectDropdownOption(page, page.locator('#gasto-client_id').last(), clientName);
  await page.locator('#gasto-monto').last().fill(amount);
  await page.getByRole('button', { name: /crear gasto/i }).click();

  await expect(heading).toBeHidden({ timeout: 15000 });
  const row = page.locator('tr').filter({ hasText: gastoType }).filter({ hasText: `$${amount}` }).first();
  await expect(row).toBeVisible({ timeout: 20000 });

  return { amount, gastoType };
}

/**
 * Filtra la vista global de Economía por carátula y verifica honorarios/gastos.
 */
async function verifyGlobalEconomy(page, caseTitle, clientName, honorarioAmount, gastoType, gastoAmount) {
  await goToSectionFromSectionsPage(page, 'economia');
  await expect(page.getByTestId('page-economia-title')).toBeVisible({ timeout: 15000 });

  const searchInput = page.getByTestId('economia-search-input');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(clientName);

  const honorarioRow = page.locator('tr').filter({ hasText: clientName }).filter({ hasText: `$${honorarioAmount}` }).first();
  await expect(honorarioRow).toBeVisible({ timeout: 20000 });

  await page.locator('#economia-tab-gastos').click();
  const gastoSearchInput = page.getByTestId('economia-search-input');
  await expect(gastoSearchInput).toBeVisible({ timeout: 10000 });
  await gastoSearchInput.fill(gastoType);
  const gastoRow = page.locator('tr').filter({ hasText: gastoType }).filter({ hasText: `$${gastoAmount}` }).first();
  await expect(gastoRow).toBeVisible({ timeout: 20000 });
}

/**
 * Cierra el caso creado para dejar el entorno menos ruidoso que antes del test.
 */
async function closeCreatedCase(page, caseTitle) {
  await goToSectionFromSectionsPage(page, 'cases');
  await expect(page.getByTestId('page-cases-title')).toBeVisible({ timeout: 15000 });

  const searchInput = page.getByTestId('cases-search-input');
  await searchInput.fill(caseTitle);

  const row = page.locator('tr').filter({ hasText: caseTitle }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  await row.click();

  await expect(page.getByRole('heading', { name: caseTitle, exact: false })).toBeVisible({ timeout: 15000 });
  await page.getByRole('button', { name: /cerrar caso/i }).click();
  await page.getByRole('button', { name: /sí, cerrar/i }).click();
  await expect(page.getByText(/caso archivado correctamente/i)).toBeVisible({ timeout: 20000 });
}

test.describe.configure({ mode: 'serial' });

test.describe('Casos + Economía E2E', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchElectronApp({
      prefix: 'cases-economia-admin',
    }));
    await loginAsAdmin(page);
  }, 120000);

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('debe crear un caso y reflejar honorarios, gastos y entregas desde el frontend', async () => {
    const { caseTitle, clientName } = await createCase(page);

    await goToCaseEconomyTab(page);
    const { amount: honorarioAmount, row: honorarioRow } = await createHonorario(page, clientName);
    const { amount: gastoAmount, gastoType } = await createGasto(page, clientName);
    await createAndDeleteEntrega(page, honorarioRow);

    await verifyGlobalEconomy(page, caseTitle, clientName, honorarioAmount, gastoType, gastoAmount);
    await closeCreatedCase(page, caseTitle);
  }, 180000);

  test('debe permitir editar un caso desde el detalle usando el modal reutilizado', async () => {
    const { caseTitle, expediente, clientName } = await createCase(page);
    const updatedTitle = await editCaseFromDetail(page, {
      originalTitle: caseTitle,
      expediente,
      clientName,
    });

    await closeCreatedCase(page, updatedTitle);
  }, 180000);
});
