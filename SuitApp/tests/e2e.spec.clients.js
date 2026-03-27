import fs from 'fs/promises';
import path from 'path';
import { expect, test } from '@playwright/test';
import {
  goToSectionFromSectionsPage,
  launchAndLogin,
  selectDropdownOption,
} from './helpers/electronTestUtils.js';

async function getLatestSessionLogPath(userDataDir) {
  const logsDir = path.join(userDataDir, 'logs');

  await expect
    .poll(async () => {
      const entries = await fs.readdir(logsDir).catch(() => []);
      return entries.filter((entry) => entry.startsWith('log-') && entry.endsWith('.log')).sort();
    }, {
      timeout: 10000,
      message: 'No se encontró el log de sesión de Electron.',
    })
    .not.toHaveLength(0);

  const entries = (await fs.readdir(logsDir))
    .filter((entry) => entry.startsWith('log-') && entry.endsWith('.log'))
    .sort();

  return path.join(logsDir, entries.at(-1));
}

async function readLogFile(logPath) {
  return await fs.readFile(logPath, 'utf8').catch(() => '');
}

async function waitForLogQuiet(logPath, { idleMs = 1200, timeout = 15000 } = {}) {
  const startedAt = Date.now();
  let previousText = await readLogFile(logPath);
  let stableSince = Date.now();

  while (Date.now() - startedAt < timeout) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const nextText = await readLogFile(logPath);

    if (nextText === previousText) {
      if (Date.now() - stableSince >= idleMs) {
        return nextText;
      }
      continue;
    }

    previousText = nextText;
    stableSince = Date.now();
  }

  return previousText;
}

function summarizeClientsSync(segment) {
  const relevantLines = segment
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.includes('[main:clients:sync]'));

  return {
    totalLines: relevantLines.length,
    lastModifiedChecks: relevantLines.filter((line) => line.includes('clients last-modified')).length,
    upToDate: relevantLines.filter((line) => line.includes('clients cache is already up to date')).length,
    fullSyncStarts: relevantLines.filter((line) => line.includes('starting full clients sync')).length,
    deltaSyncStarts: relevantLines.filter((line) => line.includes('starting delta clients sync')).length,
    nullCollection: relevantLines.filter((line) => line.includes('remote collection is empty')).length,
    rawLines: relevantLines,
  };
}

async function openPeopleTab(page, tabId, expectedTitleTestId) {
  await page.locator(`#people-tab-${tabId}`).click();
  await expect(page.getByTestId(expectedTitleTestId)).toBeVisible({ timeout: 10000 });
}

async function getGenderTrigger(page) {
  return page.getByRole('combobox', { name: /género/i }).first();
}

async function searchClientRow(page, searchText) {
  const searchInput = page.getByPlaceholder('Buscar por nombre, DNI o email...');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(searchText);
  const row = page.locator('tbody tr').filter({ hasText: searchText }).first();
  return { searchInput, row };
}

test.describe.configure({ mode: 'serial' });

test.describe('Clientes E2E', () => {
  let electronApp;
  let page;
  let userDataDir;
  let sessionLogPath;

  test.beforeAll(async () => {
    ({ electronApp, window: page, userDataDir } = await launchAndLogin({ prefix: 'clients-e2e' }));
    sessionLogPath = await getLatestSessionLogPath(userDataDir);
  }, 120000);

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('no debe disparar un segundo sync innecesario de clientes al reingresar inmediatamente', async () => {
    await goToSectionFromSectionsPage(page, 'people');
    await expect(page.getByTestId('page-people-title')).toBeVisible({ timeout: 15000 });

    await waitForLogQuiet(sessionLogPath);
    await openPeopleTab(page, 'partes', 'page-partes-title');
    await waitForLogQuiet(sessionLogPath, { idleMs: 700, timeout: 5000 });

    const beforeFirstEntry = await readLogFile(sessionLogPath);
    await openPeopleTab(page, 'clients', 'page-clients-title');
    await expect
      .poll(async () => summarizeClientsSync((await readLogFile(sessionLogPath)).slice(beforeFirstEntry.length)).totalLines, {
        timeout: 10000,
        message: 'No hubo evidencia en logs de que Clientes ejecutara el mecanismo de last-modified/sync al entrar.',
      })
      .toBeGreaterThan(0);
    const afterFirstEntry = await waitForLogQuiet(sessionLogPath);
    const firstSummary = summarizeClientsSync(afterFirstEntry.slice(beforeFirstEntry.length));

    expect(firstSummary.totalLines).toBeGreaterThan(0);
    expect(
      firstSummary.lastModifiedChecks + firstSummary.upToDate + firstSummary.fullSyncStarts + firstSummary.deltaSyncStarts + firstSummary.nullCollection,
      `No hubo trazas útiles de clients:sync en el primer ingreso. Logs: ${firstSummary.rawLines.join('\n')}`,
    ).toBeGreaterThan(0);

    await openPeopleTab(page, 'partes', 'page-partes-title');
    await waitForLogQuiet(sessionLogPath, { idleMs: 700, timeout: 5000 });

    const beforeSecondEntry = await readLogFile(sessionLogPath);
    await openPeopleTab(page, 'clients', 'page-clients-title');
    await expect
      .poll(async () => summarizeClientsSync((await readLogFile(sessionLogPath)).slice(beforeSecondEntry.length)).totalLines, {
        timeout: 10000,
        message: 'No hubo trazas de clients:sync al reingresar a Clientes la segunda vez.',
      })
      .toBeGreaterThan(0);
    const afterSecondEntry = await waitForLogQuiet(sessionLogPath);
    const secondSummary = summarizeClientsSync(afterSecondEntry.slice(beforeSecondEntry.length));

    expect(secondSummary.totalLines).toBeGreaterThan(0);
    expect(
      secondSummary.lastModifiedChecks + secondSummary.upToDate + secondSummary.nullCollection,
      `El reingreso a Clientes no dejó evidencia de last-modified/no-op. Logs: ${secondSummary.rawLines.join('\n')}`,
    ).toBeGreaterThan(0);
    expect(
      secondSummary.fullSyncStarts + secondSummary.deltaSyncStarts,
      [
        'Se detectó un segundo sync innecesario de clientes al reingresar inmediatamente.',
        'Esto indica un bug real según el criterio del flujo pedido.',
        ...secondSummary.rawLines,
      ].join('\n'),
    ).toBe(0);
  });

  test('debe crear un cliente con género, verlo en frontend y luego eliminarlo', async () => {
    const uniqueSuffix = Date.now();
    const firstName = `E2E${uniqueSuffix}`;
    const lastName = 'ClienteGenero';
    const fullName = `${firstName} ${lastName}`;
    const email = `e2e-cliente-${uniqueSuffix}@example.com`;

    await goToSectionFromSectionsPage(page, 'people');
    await expect(page.getByTestId('page-people-title')).toBeVisible({ timeout: 15000 });
    await openPeopleTab(page, 'partes', 'page-partes-title');
    await openPeopleTab(page, 'clients', 'page-clients-title');

    await page.getByRole('button', { name: /nuevo cliente/i }).click();

    const modalTitle = page.getByRole('heading', { name: 'Nuevo Cliente', level: 2 });
    await expect(modalTitle).toBeVisible({ timeout: 10000 });

    await page.locator('input[name="first_name"]').fill(firstName);
    await page.locator('input[name="last_name"]').fill(lastName);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="identification_number"]').fill(String(uniqueSuffix).slice(-8));

    const genderTrigger = await getGenderTrigger(page);
    await selectDropdownOption(page, genderTrigger, 'Masculino');

    await page.getByRole('button', { name: /crear cliente/i }).click();
    await expect(modalTitle).toBeHidden({ timeout: 15000 });

    const { searchInput, row } = await searchClientRow(page, firstName);
    await expect(row).toBeVisible({ timeout: 15000 });
    await expect(row).toContainText(fullName);
    await expect(row).toContainText(email);

    await row.locator('button').click();
    const confirmButton = page.getByRole('button', { name: /sí, eliminar/i });
    await expect(confirmButton).toBeVisible({ timeout: 5000 });
    await confirmButton.click();

    await expect(row).toBeHidden({ timeout: 15000 });
    await expect(page.locator('tbody tr').filter({ hasText: fullName })).toHaveCount(0, { timeout: 15000 });
    await searchInput.clear();
  });
});
