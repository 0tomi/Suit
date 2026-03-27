/**
 * Feature: Agenda + Vencimientos + Estadísticas
 * Hipótesis cubiertas:
 * - H1: si un admin crea, edita y elimina un evento desde Agenda, el cambio se refleja en la UI y en Reports.
 * - H2: si un admin crea, prorroga y elimina un vencimiento, el cambio se refleja en la UI y en Reports.
 *
 * CONTEXTO:
 * - Se valida sobre Electron real con login admin y datos remotos reales.
 * - La navegación a módulos se hace mediante la sección "Secciones", no por hash directo.
 *
 * PUNTOS CRÍTICOS IDENTIFICADOS:
 * - Los contadores de Reports dependen de contextos compartidos y pueden quedar desfasados si la UI no refresca.
 * - Agenda usa `react-big-calendar`, así que para ubicar eventos recién creados se fuerza la vista "Agenda".
 * - Vencimientos tiene acciones repartidas entre tabla, modales y detalle; el test recorre esas superficies.
 */

import { expect, test } from '@playwright/test';
import {
  goToSectionFromSectionsPage,
  launchAndLogin,
  selectDropdownOption,
} from './helpers/electronTestUtils.js';

function addDaysIso(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function buildFutureEventSlot(hoursAhead = 1) {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + hoursAhead);
  return {
    date: date.toISOString().slice(0, 10),
    time: `${String(date.getHours()).padStart(2, '0')}:00`,
  };
}

function buildUniqueLabel(prefix) {
  return `${prefix} ${Date.now()} ${Math.random().toString(36).slice(2, 6)}`;
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Lee el valor numérico de una stat card del dashboard de reportes según su label.
 */
async function readReportsStatValue(page, label) {
  const card = page.locator('article').filter({
    has: page.locator('p', { hasText: label }),
  }).first();

  await expect(card, `No apareció la card de reportes "${label}".`).toBeVisible({ timeout: 20000 });

  const paragraphs = card.locator('p');
  const text = ((await paragraphs.nth(1).textContent()) || '').trim();
  const numericValue = Number(text.replace(/[^\d-]/g, ''));

  expect(Number.isFinite(numericValue), `No se pudo parsear el valor numérico de "${label}" desde "${text}".`).toBeTruthy();
  return numericValue;
}

/**
 * Abre Reports en la pestaña resumen y espera que las cards principales estén visibles.
 */
async function openReportsSummary(page) {
  await goToSectionFromSectionsPage(page, 'reports');
  await expect(page.getByTestId('page-reports-title-main')).toBeVisible({ timeout: 20000 });
  await page.getByTestId('reports-tab-summary').click();
  await expect(page.getByText('Casos activos')).toBeVisible({ timeout: 20000 });
}

/**
 * Cambia Agenda a la vista de lista para localizar filas por texto de forma estable.
 */
async function openAgendaListView(page) {
  await goToSectionFromSectionsPage(page, 'agenda');
  await expect(page.getByTestId('page-agenda-title')).toBeVisible({ timeout: 20000 });
  await page.getByRole('button', { name: 'Agenda', exact: true }).click();
  await expect(page.getByText(/No hay eventos en este rango|hoy|mañana/i).first()).toBeVisible({ timeout: 20000 }).catch(() => {});
}

/**
 * Busca y abre un evento desde la vista Agenda del calendario.
 */
async function openAgendaEventByTitle(page, title) {
  const eventRow = page.getByRole('row', { name: new RegExp(title) }).first();
  await expect(eventRow, `No se encontró la fila del evento "${title}" en la vista Agenda.`).toBeVisible({ timeout: 20000 });
  await eventRow.click();
  await expect(page.getByRole('heading', { name: 'Editar Evento' })).toBeVisible({ timeout: 10000 });
}

/**
 * Busca una fila de vencimiento por título usando la barra de búsqueda de la tabla.
 */
async function searchDeadlineRow(page, title) {
  const searchInput = page.getByPlaceholder('Buscar por título o descripción...');
  await expect(searchInput).toBeVisible({ timeout: 15000 });
  await searchInput.fill(title);
  const row = page.locator('table').getByRole('button', { name: new RegExp(escapeRegExp(title)) }).first();

  await expect
    .poll(async () => {
      await searchInput.fill(title);
      return await row.count();
    }, {
      timeout: 30000,
      message: `No apareció la fila visible del vencimiento "${title}".`,
    })
    .toBeGreaterThan(0);

  await expect(row, `No se encontró la fila visible del vencimiento "${title}".`).toBeVisible({ timeout: 20000 });
  return { searchInput, row };
}

/**
 * Lleva el selector mes/año al mes del vencimiento para no depender del estado previo guardado.
 */
async function alignDeadlinesMonth(page, isoDate) {
  const targetDate = new Date(`${isoDate}T00:00:00`);
  const months = [
    'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
  ];
  const targetLabel = `${months[targetDate.getMonth()]} ${targetDate.getFullYear()}`;
  const monthLabel = page.locator('span').filter({ hasText: /^\w+\s+\d{4}$/ }).first();

  await expect(monthLabel).toBeVisible({ timeout: 10000 });

  for (let step = 0; step < 24; step += 1) {
    const currentLabel = ((await monthLabel.textContent()) || '').trim();
    if (currentLabel === targetLabel) {
      return;
    }

    const [currentMonthName, currentYearText] = currentLabel.split(' ');
    const currentMonth = months.indexOf(currentMonthName);
    const currentYear = Number(currentYearText);
    const targetMonth = targetDate.getMonth();
    const targetYear = targetDate.getFullYear();
    const shouldGoNext = currentYear < targetYear || (currentYear === targetYear && currentMonth < targetMonth);

    await page.getByRole('button', { name: shouldGoNext ? 'Mes siguiente' : 'Mes anterior' }).click();
  }

  throw new Error(`No se pudo alinear el selector de vencimientos al mes ${targetLabel}.`);
}

/**
 * Restablece los filtros visibles de Vencimientos al estado más amplio antes de buscar.
 */
async function resetDeadlineFilters(page) {
  const searchInput = page.getByPlaceholder('Buscar por título o descripción...');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill('');

  const categoryTrigger = page.getByRole('combobox', { name: 'Filtrar por categoría' });
  const priorityTrigger = page.getByRole('combobox', { name: 'Filtrar por prioridad' });
  const agendaTrigger = page.getByRole('combobox', { name: 'Filtrar por agenda' });

  if (!await categoryTrigger.getByText('Todos menos cumplidos').isVisible().catch(() => false)) {
    await selectDropdownOption(page, categoryTrigger, 'Todos menos cumplidos');
  }

  if (!await priorityTrigger.getByText('Todas').isVisible().catch(() => false)) {
    await selectDropdownOption(page, priorityTrigger, 'Todas');
  }

  if (!await agendaTrigger.getByText('Todas').isVisible().catch(() => false)) {
    await selectDropdownOption(page, agendaTrigger, 'Todas');
  }
}

test.describe.configure({ mode: 'serial' });

test.describe('Agenda + Vencimientos + Reports', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({
      prefix: 'agenda-deadlines-reports-admin',
      credentials: {
        username: 'admin',
        password: 'adminadmin',
      },
    }));
  }, 120000);

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('agenda > crear, editar y eliminar evento > debe reflejarse también en reports', async () => {
    const baseTitle = buildUniqueLabel('E2E Agenda');
    const updatedTitle = `${baseTitle} editado`;
    const description = `Descripcion ${baseTitle}`;
    const updatedDescription = `${description} actualizada`;
    const futureSlot = buildFutureEventSlot(1);

    await openAgendaListView(page);
    await page.getByTestId('agenda-new-event-button').click();
    await expect(page.getByRole('heading', { name: 'Nuevo Evento' })).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Título').fill(baseTitle);
    await page.getByLabel('Fecha').fill(futureSlot.date);
    await page.getByTestId('agenda-event-time-input').fill(futureSlot.time);
    await page.getByLabel('Descripción').fill(description);
    await page.getByLabel('Agenda', { exact: true }).selectOption({ index: 0 });
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText('Evento creado')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Nuevo Evento' })).toBeHidden({ timeout: 15000 });

    await openAgendaEventByTitle(page, baseTitle);
    await page.getByLabel('Título').fill(updatedTitle);
    await page.getByLabel('Descripción').fill(updatedDescription);
    await page.getByRole('button', { name: 'Guardar' }).click();

    await expect(page.getByText(/Evento actualizado|Evento pendiente actualizado/)).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Editar Evento' })).toBeHidden({ timeout: 15000 });

    await expect(page.getByText(updatedTitle, { exact: false }).first()).toBeVisible({ timeout: 20000 });

    await openReportsSummary(page);
    await expect(page.getByTestId('reports-upcoming-event')).toContainText(updatedTitle, { timeout: 20000 });

    await openAgendaListView(page);
    await openAgendaEventByTitle(page, updatedTitle);
    await page.getByRole('button', { name: /Eliminar/i }).click();
    await page.getByRole('button', { name: 'Sí, eliminar' }).click();

    await expect(page.getByText('Evento eliminado correctamente')).toBeVisible({ timeout: 20000 });
    await expect(page.getByText(updatedTitle, { exact: false })).toHaveCount(0, { timeout: 20000 });

    await openReportsSummary(page);
    await expect(page.getByTestId('reports-upcoming-event')).not.toContainText(updatedTitle, { timeout: 20000 });
  });

  test('vencimientos > crear, prorrogar y eliminar > debe reflejarse también en reports', async () => {
    const deadlineTitle = buildUniqueLabel('E2E Vencimiento');
    const createDate = addDaysIso(4);
    const postponeDate = addDaysIso(5);
    const deadlineDescription = `Descripcion ${deadlineTitle}`;

    await openReportsSummary(page);
    const deadlinesBefore = await readReportsStatValue(page, 'Vencimientos');

    await goToSectionFromSectionsPage(page, 'deadlines');
    await expect(page.getByTestId('page-deadlines-title')).toBeVisible({ timeout: 20000 });
    await page.getByRole('button', { name: 'Nuevo Vencimiento' }).click();

    await expect(page.getByRole('heading', { name: 'Nuevo Vencimiento' })).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Título *').fill(deadlineTitle);
    await page.getByLabel('Fecha Límite *').fill(createDate);
    await page.getByLabel('Hora').fill('11:15');
    await page.getByLabel('Descripción').fill(deadlineDescription);
    await page.getByLabel('Prioridad', { exact: true }).selectOption('Urgente');
    await page.getByRole('button', { name: 'Crear Vencimiento' }).click();

    await expect(page.getByText('Vencimiento creado')).toBeVisible({ timeout: 20000 });
    await expect(page.getByRole('heading', { name: 'Nuevo Vencimiento' })).toBeHidden({ timeout: 15000 });

    await openReportsSummary(page);
    await expect(page.getByTestId('reports-upcoming-deadline')).toBeVisible({ timeout: 20000 });

    await goToSectionFromSectionsPage(page, 'deadlines');
    await expect(page.getByTestId('page-deadlines-title')).toBeVisible({ timeout: 20000 });
    await alignDeadlinesMonth(page, createDate);
    await resetDeadlineFilters(page);

    const { searchInput } = await searchDeadlineRow(page, deadlineTitle);

    await goToSectionFromSectionsPage(page, 'deadlines');
    await alignDeadlinesMonth(page, createDate);
    await resetDeadlineFilters(page);
    searchInput.clear().catch(() => {});
    await searchDeadlineRow(page, deadlineTitle);
    await page.locator('[title="Prorrogar"]').first().click({ force: true });

    await expect(page.getByRole('heading', { name: 'Prorrogar Vencimiento' })).toBeVisible({ timeout: 10000 });
    await page.getByLabel('Nueva Fecha Límite *').fill(postponeDate);
    await page.getByLabel('Hora').fill('13:45');
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await expect(page.getByRole('heading', { name: 'Prorrogar Vencimiento' })).toBeHidden({ timeout: 20000 });

    await alignDeadlinesMonth(page, postponeDate);
    await resetDeadlineFilters(page);
    const postponedRow = (await searchDeadlineRow(page, deadlineTitle)).row;

    await postponedRow.click();
    await expect(page.getByRole('button', { name: /^Prorrogar$/ })).toBeVisible({ timeout: 10000 });
    await expect(page.locator('dd').filter({ hasText: '2026' }).first()).toBeVisible({ timeout: 20000 });

    await page.getByRole('button', { name: /^Volver a Vencimientos$/ }).click();
    await alignDeadlinesMonth(page, postponeDate);
    await resetDeadlineFilters(page);
    const rowBackInList = (await searchDeadlineRow(page, deadlineTitle)).row;
    await rowBackInList.click();
    await page.getByRole('button', { name: /^Delete|^Eliminar$/ }).click().catch(async () => {
      await page.getByRole('button').filter({ has: page.locator('svg') }).last().click();
    });
    await page.getByRole('button', { name: 'Sí, eliminar' }).click();

    await expect(page.getByTestId('page-deadlines-title')).toBeVisible({ timeout: 20000 });
    await searchInput.fill(deadlineTitle);
    await expect(page.locator('table').getByRole('button', { name: new RegExp(escapeRegExp(deadlineTitle)) })).toHaveCount(0, { timeout: 20000 });

    await openReportsSummary(page);
    await expect
      .poll(async () => readReportsStatValue(page, 'Vencimientos'), {
        timeout: 30000,
        message: 'El contador de vencimientos en Reports no volvió a su valor original tras eliminar el registro.',
      })
      .toBe(deadlinesBefore);
  });
});
