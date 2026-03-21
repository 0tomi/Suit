import { test, expect } from '@playwright/test';
import {
  goToSectionFromSectionsPage,
  launchAndLogin,
  selectDropdownOption,
} from './helpers/electronTestUtils.js';

function buildApiUrl({ host, port }, endpoint) {
  return `http://${host}:${port}/api${endpoint}`;
}

async function getApiConfig(page) {
  return page.evaluate(async () => ({
    host: await window.electronAPI.config.get('api_host'),
    port: await window.electronAPI.config.get('api_port'),
    token: await window.electronAPI.config.get('auth_token'),
  }));
}

async function apiRequest(apiConfig, endpoint, { method = 'GET', body } = {}) {
  const response = await fetch(buildApiUrl(apiConfig, endpoint), {
    method,
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiConfig.token}`,
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const rawText = await response.text();
  let data = null;

  try {
    data = rawText ? JSON.parse(rawText) : null;
  } catch {
    data = rawText || null;
  }

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

function unwrapCollection(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;
  if (Array.isArray(payload?.partes)) return payload.partes;
  return [];
}

async function cleanupCreatedPartes(apiConfig, createdParteEmails) {
  if (!apiConfig?.host || !apiConfig?.port || !apiConfig?.token || createdParteEmails.length === 0) {
    return;
  }

  const partesResponse = await apiRequest(apiConfig, '/partes');
  const partes = unwrapCollection(partesResponse.data);

  for (const email of createdParteEmails) {
    const matchingPartes = partes.filter((parte) => parte.email === email);
    for (const parte of matchingPartes) {
      await apiRequest(apiConfig, `/partes/${parte.id}`, { method: 'DELETE' }).catch(() => null);
    }
  }
}

async function openPartesTab(page) {
  // El acceso estable a Personas en E2E entra desde la pantalla Secciones.
  await goToSectionFromSectionsPage(page, 'people', { timeout: 20000 });
  const partesTab = page.locator('#people-tab-partes');
  await partesTab.waitFor({ state: 'visible', timeout: 10000 });
  await partesTab.click();
  await expect(page.getByTestId('page-partes-title')).toBeVisible({ timeout: 10000 });
}

async function getFirstRoleTitle(apiConfig) {
  const rolesResponse = await apiRequest(apiConfig, '/roles');
  const roles = unwrapCollection(rolesResponse.data);
  return roles[0]?.titulo || roles[0]?.title || null;
}

test.describe('Personas > Partes - smoke de nueva parte', () => {
  test.describe.configure({ mode: 'serial' });

  let electronApp;
  let page;
  let apiConfig;
  const createdParteEmails = [];

  test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-partes-new-parte-smoke' }));
    apiConfig = await getApiConfig(page);
    await openPartesTab(page);
  }, 60000);

  test.afterAll(async () => {
    await cleanupCreatedPartes(apiConfig, createdParteEmails);
    await electronApp?.close();
  });

  test('abre el modal y bloquea el alta si faltan campos obligatorios', async () => {
    const overlays = page.locator('div.fixed.inset-0.z-50');
    const baseOverlayCount = await overlays.count();

    await page.getByRole('button', { name: 'Nueva Parte' }).click();
    await expect(overlays).toHaveCount(baseOverlayCount + 1, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Crear Nueva Parte' })).toBeVisible({ timeout: 10000 });

    await page.getByRole('button', { name: 'Crear Parte' }).click();

    await expect(page.locator('p.text-red-600').filter({ hasText: 'El nombre es obligatorio.' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('p.text-red-600').filter({ hasText: 'Seleccioná un rol para la parte.' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.locator('div.rounded-lg.border.border-red-200').filter({ hasText: 'El nombre es obligatorio. Seleccioná un rol para la parte.' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Crear Nueva Parte' })).toBeVisible();

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('heading', { name: 'Crear Nueva Parte' })).not.toBeVisible({ timeout: 10000 });
    await expect(overlays).toHaveCount(baseOverlayCount, { timeout: 10000 });
  });

  test('crea una parte válida y la muestra en la lista sin navegar', async () => {
    const roleTitle = await getFirstRoleTitle(apiConfig);
    test.skip(!roleTitle, 'La API no devolvió roles para completar el alta de partes.');

    const uniqueSuffix = Date.now();
    const nombre = `Parte Smoke ${uniqueSuffix}`;
    const apellido = 'Electron';
    const email = `parte-smoke-${uniqueSuffix}@example.com`;
    createdParteEmails.push(email);

    await page.getByRole('button', { name: 'Nueva Parte' }).click();
    await expect(page.getByRole('heading', { name: 'Crear Nueva Parte' })).toBeVisible({ timeout: 10000 });

    await page.getByTestId('new-parte-nombre-input').fill(nombre);
    await page.getByTestId('new-parte-apellido-input').fill(apellido);
    await page.getByLabel('Email').fill(email);
    await selectDropdownOption(page, page.getByTestId('new-parte-rol-trigger'), roleTitle);

    await page.getByTestId('new-parte-submit').click();

    await expect(page.getByRole('heading', { name: 'Crear Nueva Parte' })).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByTestId('page-partes-title')).toBeVisible();
    await expect(page.getByRole('cell', { name: `${nombre} ${apellido}` })).toBeVisible({ timeout: 15000 });
  });
});
