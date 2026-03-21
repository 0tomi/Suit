import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

/**
 * Feature: Nuevo Caso - modales anidados y filtro de tipo de expediente
 * Hipótesis cubiertas:
 * - H1: al abrir el selector de cliente, la UI ofrece una salida explícita (`Volver`)
 *   y no muestra el contador de resultados antes de buscar.
 * - H2: al abrir `Crear Nuevo Cliente` desde el selector, el modal anidado es visible,
 *   el stack de overlays sigue siendo detectable y el cliente creado queda vinculado
 *   en la pantalla del caso.
 * - H3: el selector de tipos de expediente queda filtrado por `case_type_id`, por lo que
 *   un tipo perteneciente a otro fuero no debe aparecer en el modal actual.
 *
 * Puntos críticos:
 * - El flujo corre en Electron real y depende de `ModalContext`.
 * - El alta de cliente actualiza caché local y estado React antes de reflejarse en pantalla.
 * - El filtrado de tipo de expediente depende de datos de catálogo de la API.
 */

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

function unwrapCollection(payload, keys = []) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.data)) return payload.data;

  for (const key of keys) {
    if (Array.isArray(payload?.[key])) {
      return payload[key];
    }
  }

  return [];
}

function normalizeTipoExpediente(item) {
  return {
    id: item.id,
    title: item.title || item.titulo || '',
    caseTypeId: String(item.case_type_id || ''),
  };
}

function pickTipoExpedienteFixture(caseTypes, tipoExpedientes) {
  const normalizedTipos = tipoExpedientes.map(normalizeTipoExpediente).filter((item) => item.id && item.title && item.caseTypeId);
  const tiposByCaseType = new Map();

  for (const tipo of normalizedTipos) {
    if (!tiposByCaseType.has(tipo.caseTypeId)) {
      tiposByCaseType.set(tipo.caseTypeId, []);
    }

    tiposByCaseType.get(tipo.caseTypeId).push(tipo);
  }

  for (const caseType of caseTypes) {
    const caseTypeId = String(caseType.id || '');
    const ownTipos = tiposByCaseType.get(caseTypeId) || [];

    if (ownTipos.length === 0) {
      continue;
    }

    const foreignTipo = normalizedTipos.find((tipo) => tipo.caseTypeId !== caseTypeId);
    if (!foreignTipo) {
      continue;
    }

    return {
      caseTypeId,
      caseTypeName: caseType.name,
      visibleTipoTitle: ownTipos[0].title,
      hiddenTipoTitle: foreignTipo.title,
    };
  }

  return null;
}

async function cleanupCreatedClients(apiConfig, createdClientEmails) {
  if (!apiConfig?.host || !apiConfig?.port || !apiConfig?.token || createdClientEmails.length === 0) {
    return;
  }

  const clientsResponse = await apiRequest(apiConfig, '/clients');
  const clients = unwrapCollection(clientsResponse.data, ['clients']);

  for (const email of createdClientEmails) {
    const matches = clients.filter((client) => client.email === email);
    for (const client of matches) {
      await apiRequest(apiConfig, `/clients/${client.id}`, { method: 'DELETE' }).catch(() => null);
    }
  }
}

async function openNewCaseModal(page) {
  await goToSection(page, 'cases', { timeout: 20000 });
  await page.getByRole('button', { name: 'Nuevo Caso' }).click();
  await expect(page.getByText('Iniciar Nuevo Caso')).toBeVisible({ timeout: 10000 });
}

function getVisibleBlurOverlays(page) {
  return page.locator('div.fixed.inset-0.backdrop-blur-sm:visible');
}

test.describe('Nuevo Caso - modales anidados y tipos filtrados', () => {
  test.describe.configure({ mode: 'serial' });

  let electronApp;
  let page;
  let apiConfig;
  let tipoFixture = null;
  const createdClientEmails = [];

  test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({
      prefix: 'suit-case-nested-client-tipo',
    }));

    apiConfig = await getApiConfig(page);

    const [caseTypesResponse, tipoExpedientesResponse] = await Promise.all([
      apiRequest(apiConfig, '/case-types'),
      apiRequest(apiConfig, '/tipo-expedientes'),
    ]);

    const caseTypes = unwrapCollection(caseTypesResponse.data, ['case_types']);
    const tipoExpedientes = unwrapCollection(tipoExpedientesResponse.data, ['tipo_expedientes']);
    tipoFixture = pickTipoExpedienteFixture(caseTypes, tipoExpedientes);
  }, 60000);

  test.afterAll(async () => {
    await cleanupCreatedClients(apiConfig, createdClientEmails);
    await electronApp?.close();
  });

  test('muestra el modal anidado de cliente, conserva el stack y vincula el cliente creado', async () => {
    const uniqueKey = Date.now();
    const clientFixture = {
      firstName: 'PW',
      lastName: `Cliente Modal ${uniqueKey}`,
      email: `pw-case-modal-${uniqueKey}@example.test`,
      identification: `PW-NC-${uniqueKey}`,
    };
    createdClientEmails.push(clientFixture.email);

    await openNewCaseModal(page);

    const visibleBlurOverlays = getVisibleBlurOverlays(page);
    const baseBlurOverlayCount = await visibleBlurOverlays.count();

    await page.getByTestId('new-case-link-client').click();
    await expect(visibleBlurOverlays).toHaveCount(baseBlurOverlayCount, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Seleccionar Cliente' })).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: 'Volver' })).toBeVisible();
    await expect(page.getByText(/resultado\(s\)/i)).toHaveCount(0);

    await page.getByRole('button', { name: 'Volver' }).click();
    await expect(page.getByRole('heading', { name: 'Seleccionar Cliente' })).not.toBeVisible({ timeout: 10000 });
    await expect(visibleBlurOverlays).toHaveCount(baseBlurOverlayCount, { timeout: 10000 });

    await page.getByTestId('new-case-link-client').click();
    await expect(page.getByRole('heading', { name: 'Seleccionar Cliente' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Crear Nuevo Cliente' }).click();

    await expect(visibleBlurOverlays).toHaveCount(baseBlurOverlayCount, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible({ timeout: 10000 });

    await page.getByLabel('Nombre (O Razón Social) *').fill(clientFixture.firstName);
    await page.getByLabel('Apellido *').fill(clientFixture.lastName);
    await page.getByLabel('DNI / CUIT').fill(clientFixture.identification);
    await page.getByLabel('Email').fill(clientFixture.email);
    await page.getByRole('button', { name: 'Crear Cliente' }).click();

    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).not.toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('heading', { name: 'Seleccionar Cliente' })).not.toBeVisible({ timeout: 15000 });
    await expect(visibleBlurOverlays).toHaveCount(baseBlurOverlayCount, { timeout: 15000 });

    const linkedClient = page.getByTestId('new-case-linked-client');
    await expect(linkedClient).toHaveCount(1, { timeout: 15000 });
    await expect(linkedClient).toContainText(`${clientFixture.firstName} ${clientFixture.lastName}`);

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 10000 });
  });

  test('filtra tipos de expediente por el fuero seleccionado', async () => {
    if (!tipoFixture) {
      test.skip(true, [
        'La API no devolvió un conjunto reutilizable de case_types y tipo_expedientes.',
        'Se necesita al menos un tipo visible para un fuero y otro perteneciente a un fuero distinto.',
      ].join(' '));
      return;
    }

    await openNewCaseModal(page);
    await page.getByLabel('Fuero').selectOption(tipoFixture.caseTypeId);

    const visibleBlurOverlays = getVisibleBlurOverlays(page);
    const baseBlurOverlayCount = await visibleBlurOverlays.count();

    await page.getByTestId('new-case-link-tipo-expediente').click();
    await expect(visibleBlurOverlays).toHaveCount(baseBlurOverlayCount, { timeout: 10000 });
    await expect(page.getByRole('heading', { name: 'Seleccionar Tipo de Expediente' })).toBeVisible({ timeout: 10000 });

    const searchInput = page.getByPlaceholder('Buscar por título...');
    await searchInput.fill(tipoFixture.hiddenTipoTitle);
    await expect(page.getByText('No hay tipos de expediente disponibles para el fuero seleccionado.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole('button', { name: new RegExp(tipoFixture.hiddenTipoTitle, 'i') })).toHaveCount(0);

    await searchInput.fill(tipoFixture.visibleTipoTitle);
    await page.getByRole('button', { name: new RegExp(tipoFixture.visibleTipoTitle, 'i') }).first().click();
    await expect(visibleBlurOverlays).toHaveCount(baseBlurOverlayCount, { timeout: 10000 });

    const linkedTipo = page.getByTestId('new-case-linked-tipo-expediente');
    await expect(linkedTipo).toHaveCount(1, { timeout: 10000 });
    await expect(linkedTipo).toContainText(tipoFixture.visibleTipoTitle);

    await page.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 10000 });
  });
});
