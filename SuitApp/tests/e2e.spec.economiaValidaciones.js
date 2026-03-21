/**
 * e2e.spec.economiaValidaciones.js
 *
 * Regresión para:
 *   ECO-8: Renderizado condicional de tabs en Economia.jsx.
 *          La sección quedó reducida a Honorarios + Gastos y los catálogos
 *          migraron a la nueva página Categorías.
 *
 *   ECO-10: Validación min="0.01" y guard handleSubmit (monto <= 0) en
 *           NewHonorarioModal, NewGastoModal y NewEntregaForm.
 *
 * Reglas seguidas (ver /.agents/skills/e2e-electron-safe/SKILL.md):
 *   - Un único launchAndLogin para todo el archivo (Regla 1).
 *   - Tests proporcionales al cambio: DOM checks para atributos,
 *     no se navegan flujos completos de creación cuando no es necesario (Regla 0+7).
 *   - Sin page.reload() sin navegación explícita posterior (Regla 3).
 */

import { test, expect } from '@playwright/test';
import {
    launchAndLogin,
    goToSectionFromSectionsPage,
    selectDropdownOption,
    waitForPageReady,
} from './helpers/electronTestUtils.js';

function unwrapCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

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

/**
 * Reutiliza la sesión autenticada de Electron para sembrar fixtures reales
 * sin depender de datos accidentales del entorno.
 */
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

/**
 * Usa un caso existente cuando el usuario de test ya tiene alguno visible.
 * Solo crea uno nuevo si el entorno estuviera vacío para no bloquear ECO-10.
 */
async function ensureCase(apiConfig) {
    const casesResponse = await apiRequest(apiConfig, '/cases');
    const cases = unwrapCollection(casesResponse.data);

    if (cases.length > 0) {
        return {
            caseId: cases[0].id,
            caseTitle: cases[0].title,
            createdCaseId: null,
        };
    }

    const [caseTypesResponse, radicacionesResponse] = await Promise.all([
        apiRequest(apiConfig, '/case-types'),
        apiRequest(apiConfig, '/radicaciones'),
    ]);

    const caseTypes = unwrapCollection(caseTypesResponse.data);
    const radicaciones = unwrapCollection(radicacionesResponse.data);

    if (caseTypes.length === 0 || radicaciones.length === 0) {
        return {
            skipReason: [
                'ECO-10 bloqueado por datos API.',
                'No hay casos visibles ni catálogos base (case-types/radicaciones)',
                'para sembrar el fixture real del spec.',
            ].join(' '),
        };
    }

    const uniqueKey = Date.now();
    const casePayload = {
        title: `PW ECO10 ${uniqueKey}`,
        start_date: new Date().toISOString().split('T')[0],
        nro_expediente: `PW-ECO10-${uniqueKey}`,
        radicacion_id: radicaciones[0].id,
        case_type_id: caseTypes[0].id,
        details: 'Fixture temporal para validar honorarios y entregas en E2E.',
    };

    const createCaseResponse = await apiRequest(apiConfig, '/cases', {
        method: 'POST',
        body: casePayload,
    });
    const createdCase = createCaseResponse.data?.case ?? createCaseResponse.data?.data ?? createCaseResponse.data ?? null;

    if (!createCaseResponse.ok || !createdCase?.id) {
        throw new Error(`No se pudo crear el caso fixture de ECO-10. Status=${createCaseResponse.status}`);
    }

    return {
        caseId: createdCase.id,
        caseTitle: createdCase.title ?? casePayload.title,
        createdCaseId: createdCase.id,
    };
}

/**
 * Prepara un cliente único para que los tests puedan seleccionar datos reales
 * sin depender de registros accidentales del entorno.
 */
async function seedEconomiaValidationFixture(apiConfig) {
    const baseCase = await ensureCase(apiConfig);
    if (baseCase?.skipReason) {
        return baseCase;
    }

    const uniqueKey = Date.now();
    const clientPayload = {
        first_name: 'PW',
        last_name: `ECO10 ${uniqueKey}`,
        identification_number: `PW-ECO10-${uniqueKey}`,
        email: `pw-eco10-${uniqueKey}@example.test`,
        type: 'person',
        status: 'active',
        notes: 'Fixture temporal de Playwright para ECO-10.',
    };

    const createClientResponse = await apiRequest(apiConfig, '/clients', {
        method: 'POST',
        body: clientPayload,
    });
    const createdClient = createClientResponse.data?.data ?? createClientResponse.data ?? null;

    if (!createClientResponse.ok || !createdClient?.id) {
        throw new Error(`No se pudo crear el cliente fixture de ECO-10. Status=${createClientResponse.status}`);
    }

    const linkClientResponse = await apiRequest(apiConfig, `/cases/${baseCase.caseId}/clients`, {
        method: 'POST',
        body: { client_ids: [createdClient.id] },
    });
    if (!linkClientResponse.ok && linkClientResponse.status !== 422) {
        throw new Error(`No se pudo vincular el cliente fixture al caso. Status=${linkClientResponse.status}`);
    }

    return {
        ...baseCase,
        clientId: createdClient.id,
        clientName: `${createdClient.first_name} ${createdClient.last_name}`.trim(),
        honorarioId: null,
        honorarioAmount: `${1700 + (uniqueKey % 200)}`,
        honorarioDetails: `Honorario ECO10 ${uniqueKey}`,
    };
}

async function cleanupEconomiaValidationFixture(apiConfig, fixture) {
    if (!fixture) return;

    if (fixture.honorarioId) {
        await apiRequest(apiConfig, `/honorarios/${fixture.honorarioId}`, { method: 'DELETE' }).catch(() => null);
    }

    if (fixture.caseId && fixture.clientId) {
        await apiRequest(apiConfig, `/cases/${fixture.caseId}/clients/${fixture.clientId}`, { method: 'DELETE' }).catch(() => null);
    }

    if (fixture.clientId) {
        await apiRequest(apiConfig, `/clients/${fixture.clientId}`, { method: 'DELETE' }).catch(() => null);
    }

    if (fixture.createdCaseId) {
        await apiRequest(apiConfig, `/cases/${fixture.createdCaseId}`, { method: 'DELETE' }).catch(() => null);
    }
}

/**
 * Consulta el catálogo real de gastos y devuelve un label seleccionable.
 * Si el entorno no expone datos, el test que depende de esto debe skippearse.
 */
async function getAvailableGastoLabel(apiConfig) {
    const gastosResponse = await apiRequest(apiConfig, '/gastos');
    const gastos = unwrapCollection(gastosResponse.data);

    if (!gastosResponse.ok || gastos.length === 0) {
        return null;
    }

    return gastos[0].titulo ?? gastos[0].name ?? null;
}

/**
 * Recarga el renderer para que los contextos vuelvan a leer clientes/casos
 * después de sembrar el fixture por API.
 */
async function reloadRenderer(page) {
    await page.reload();
    await waitForPageReady(page, 'agenda', { timeout: 20000 });
}

/**
 * Abre la pestaña Economía del caso a través de la navegación visible de la UI.
 */
async function openCaseEconomia(page, fixture) {
    await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });

    const caseRow = page.locator('tr', { hasText: fixture.caseTitle }).first();
    await expect(caseRow).toBeVisible({ timeout: 15000 });
    await caseRow.click();
    await expect(page.getByRole('heading', { name: fixture.caseTitle })).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole('button', { name: 'Economía' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Economía' }).click();
    await expect(page.getByRole('heading', { name: 'Honorarios' })).toBeVisible({ timeout: 10000 });
}

async function findFixtureHonorarioId(apiConfig, fixture) {
    const honorariosResponse = await apiRequest(apiConfig, `/suit-cases/${fixture.caseId}/honorarios`);
    const honorarios = unwrapCollection(honorariosResponse.data);
    const match = honorarios.find((honorario) => (
        String(honorario.client_id) === String(fixture.clientId)
        && String(honorario.monto) === String(fixture.honorarioAmount)
        && String(honorario.detalles || '') === String(fixture.honorarioDetails)
    ));

    return match?.id ?? null;
}

/**
 * Garantiza un honorario visible en la UI del caso usando el flujo real del
 * modal. Si ya existe la fila, la reutiliza; si no, lo crea desde la app.
 */
async function ensureHonorarioVisible(page, apiConfig, fixture) {
    await openCaseEconomia(page, fixture);

    const honorarioRow = page.locator('tr')
        .filter({ hasText: `$${fixture.honorarioAmount}.00` })
        .first();

    if (await honorarioRow.isVisible().catch(() => false)) {
        fixture.honorarioId = fixture.honorarioId || await findFixtureHonorarioId(apiConfig, fixture);
        return honorarioRow;
    }

    await page.getByRole('button', { name: 'Nuevo Honorario' }).click();
    await expect(page.getByText('Crear Nuevo Honorario')).toBeVisible({ timeout: 8000 });

    const modal = page.locator('div.bg-white.rounded-lg').filter({
        has: page.getByText('Crear Nuevo Honorario'),
    }).last();
    const clientTrigger = modal.locator('label[for="client_id"]').locator('xpath=following::button[1]');

    await selectDropdownOption(page, clientTrigger, fixture.clientName);
    await expect(clientTrigger).toContainText(fixture.clientName, { timeout: 5000 });

    await modal.locator('input#monto').fill(fixture.honorarioAmount);
    await modal.locator('input#detalles').fill(fixture.honorarioDetails);
    await modal.getByRole('button', { name: 'Crear Honorario' }).click();

    await expect(page.getByText('Honorario creado correctamente.')).toBeVisible({ timeout: 10000 });
    await expect(page.getByText('Crear Nuevo Honorario')).not.toBeVisible({ timeout: 8000 });
    await honorarioRow.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
    if (!(await honorarioRow.isVisible().catch(() => false))) {
        return null;
    }

    fixture.honorarioId = await findFixtureHonorarioId(apiConfig, fixture);
    return honorarioRow;
}

// ---------------------------------------------------------------------------
// Estado compartido — un solo Electron para todo el spec (Regla 1)
// ---------------------------------------------------------------------------
let electronApp;
let page;
let apiConfig;
let fixture;

test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-eco-val' }));
    apiConfig = await getApiConfig(page);
    fixture = await seedEconomiaValidationFixture(apiConfig);
    if (!fixture?.skipReason) {
        await reloadRenderer(page);
    }
    await goToSectionFromSectionsPage(page, 'economia', { timeout: 20000 });
}, 120000);

test.afterAll(async () => {
    await cleanupEconomiaValidationFixture(apiConfig, fixture);
    await electronApp?.close();
});

// ===========================================================================
// ECO-8 — Renderizado condicional de tabs
// ===========================================================================

test.describe('ECO-8 — Renderizado condicional de tabs en Economía', () => {
    test.describe.configure({ mode: 'serial' });

    test('Tab Honorarios activo por defecto muestra su heading', async () => {
        // El tab activo inicial es "honorarios".
        await expect(page.getByRole('heading', { name: 'Honorarios' })).toBeVisible({
            timeout: 10000,
        });
    });

    test('Cambiar a Gastos: GastosTab aparece y HonorariosTab se desmonta del DOM', async () => {
        await page.locator('#economia-tab-gastos').click();
        await expect(page.getByRole('heading', { name: 'Gastos' })).toBeVisible({ timeout: 10000 });

        // Con conditional rendering el botón "Nuevo Honorario" debe estar FUERA del DOM,
        // no solo invisible. count() es más preciso que not.toBeVisible() aquí.
        const honorariosButtonCount = await page
            .getByRole('button', { name: 'Nuevo Honorario' })
            .count();
        expect(honorariosButtonCount).toBe(0);
    });

    test('Economía ya no renderiza tabs de catálogos movidos a Categorías', async () => {
        await expect(page.locator('#economia-tab-tiposDeGasto')).toHaveCount(0);
        await expect(page.locator('#economia-tab-tiposDePago')).toHaveCount(0);
    });

    test('Volver a Honorarios re-monta HonorariosTab correctamente', async () => {
        await page.locator('#economia-tab-honorarios').click();

        await expect(page.getByRole('heading', { name: 'Honorarios' })).toBeVisible({
            timeout: 10000,
        });
        // El botón "Nuevo Honorario" debe volver al DOM.
        await expect(page.getByRole('button', { name: 'Nuevo Honorario' })).toBeVisible({
            timeout: 8000,
        });
    });

    test('Recorrer todos los tabs en secuencia no produce pantalla en blanco', async () => {
        const tabs = ['honorarios', 'gastos', 'honorarios'];
        for (const tabId of tabs) {
            await page.locator(`#economia-tab-${tabId}`).click();
            // Si hay crash de runtime React desmontaría todo y Economía desaparecería.
            await expect(page.locator('h1').filter({ hasText: 'Economía' })).toBeVisible({
                timeout: 8000,
            });
        }
    });
});

// ===========================================================================
// ECO-10 — Atributo min="0.01" en inputs de monto (DOM check — Regla 7)
// ===========================================================================

test.describe('ECO-10 — Atributo min="0.01" en inputs de monto', () => {
    test.describe.configure({ mode: 'serial' });

    test('NewHonorarioModal: input#monto tiene min="0.01"', async () => {
        await goToSectionFromSectionsPage(page, 'economia', { timeout: 15000 });
        await page.locator('#economia-tab-honorarios').click();
        await expect(page.getByRole('button', { name: 'Nuevo Honorario' })).toBeVisible({
            timeout: 10000,
        });

        await page.getByRole('button', { name: 'Nuevo Honorario' }).click();
        await expect(page.getByText('Crear Nuevo Honorario')).toBeVisible({ timeout: 8000 });

        const min = await page.locator('input#monto').getAttribute('min');
        expect(min).toBe('0.01');

        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByText('Crear Nuevo Honorario')).not.toBeVisible({ timeout: 5000 });
    });

    test('NewGastoModal: input#monto tiene min="0.01"', async () => {
        await page.locator('#economia-tab-gastos').click();
        await expect(page.getByRole('button', { name: 'Nuevo Gasto' })).toBeVisible({
            timeout: 10000,
        });

        await page.getByRole('button', { name: 'Nuevo Gasto' }).click();
        await expect(page.getByText('Crear Nuevo Gasto')).toBeVisible({ timeout: 8000 });

        const min = await page.locator('input#monto').getAttribute('min');
        expect(min).toBe('0.01');

        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByText('Crear Nuevo Gasto')).not.toBeVisible({ timeout: 5000 });
    });

    test('NewEntregaForm: input#monto tiene min="0.01" (verifica desde HonorariosTab)', async () => {
        if (fixture?.skipReason) {
            test.skip(true, fixture.skipReason);
            return;
        }

        const honorarioRow = await ensureHonorarioVisible(page, apiConfig, fixture);
        if (!honorarioRow) {
            test.skip(true, [
                'ECO-10/NewEntregaForm bloqueado sólo en este entorno.',
                'El honorario fixture real no quedó visible en la tabla del detalle tras el flujo de UI.',
                'Sin esa fila no se puede abrir EntregasModal para validar el atributo min de forma honesta.',
            ].join(' '));
            return;
        }

        await honorarioRow.click();
        await expect(page.getByText('Entregas del Honorario')).toBeVisible({ timeout: 10000 });

        const min = await page.locator('input#monto').getAttribute('min');
        expect(min).toBe('0.01');

        await page.keyboard.press('Escape');
        await expect(page.getByText('Entregas del Honorario')).not.toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// ECO-10 — Validación handleSubmit: monto <= 0 dispara toast
//
// Para llegar a la validación de monto se usa un caso fixture real abierto en
// la pestaña Economía del detalle. Así el caso ya viene preseleccionado y
// solo queda elegir un cliente real antes de verificar el toast.
// ===========================================================================

test.describe('ECO-10 — Validación handleSubmit monto <= 0', () => {
    test.describe.configure({ mode: 'serial' });

    test('NewHonorarioModal: monto 0 con caso+cliente seleccionados muestra banner inline de error', async () => {
        if (fixture?.skipReason) {
            test.skip(true, fixture.skipReason);
            return;
        }

        await openCaseEconomia(page, fixture);
        await expect(page.getByRole('button', { name: 'Nuevo Honorario' })).toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: 'Nuevo Honorario' }).click();
        await expect(page.getByText('Crear Nuevo Honorario')).toBeVisible({ timeout: 8000 });

        const modal = page.locator('div.bg-white.rounded-lg').filter({
            has: page.getByText('Crear Nuevo Honorario'),
        }).last();
        const clientTrigger = modal.locator('label[for="client_id"]').locator('xpath=following::button[1]');

        await selectDropdownOption(page, clientTrigger, fixture.clientName);
        await expect(clientTrigger).toContainText(fixture.clientName, { timeout: 5000 });

        // El atributo min ya tiene su propio smoke E2E arriba; desactivar la
        // constraint nativa permite comprobar el guard JS del submit.
        const form = modal.locator('form');
        await form.evaluate((node) => {
            node.noValidate = true;
        });

        await modal.locator('input#monto').fill('0');
        await modal.getByRole('button', { name: 'Crear Honorario' }).click();

        await expect(modal.getByTestId('new-honorario-error-banner')).toContainText('El monto debe ser mayor a cero.', { timeout: 8000 });
        await expect(page.getByText('Crear Nuevo Honorario')).toBeVisible({ timeout: 5000 });

        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByText('Crear Nuevo Honorario')).not.toBeVisible({ timeout: 5000 });
    });

    test('NewGastoModal: monto 0 con cliente+tipo seleccionados muestra banner inline de error', async () => {
        const gastoLabel = await getAvailableGastoLabel(apiConfig);
        if (!gastoLabel) {
            test.skip(true, [
                'ECO-10/NewGastoModal bloqueado sólo para este entorno.',
                'GET /gastos no devolvió datos seleccionables para el usuario de test.',
                'Sin tipo de gasto real no se puede llegar honestamente al guard de monto.',
            ].join(' '));
            return;
        }

        await openCaseEconomia(page, fixture);
        await expect(page.getByRole('button', { name: 'Nuevo Gasto' })).toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: 'Nuevo Gasto' }).click();
        await expect(page.getByText('Crear Nuevo Gasto')).toBeVisible({ timeout: 8000 });

        const modal = page.locator('div.bg-white.rounded-lg').filter({
            has: page.getByText('Crear Nuevo Gasto'),
        }).last();
        const gastoTrigger = modal.locator('label[for="gasto_id"]').locator('xpath=following::button[1]');
        const clientTrigger = modal.locator('label[for="client_id"]').locator('xpath=following::button[1]');

        await selectDropdownOption(page, gastoTrigger, gastoLabel);
        await expect(gastoTrigger).toContainText(gastoLabel, { timeout: 5000 });

        await selectDropdownOption(page, clientTrigger, fixture.clientName);
        await expect(clientTrigger).toContainText(fixture.clientName, { timeout: 5000 });

        const form = modal.locator('form');
        await form.evaluate((node) => {
            node.noValidate = true;
        });

        await modal.locator('input#monto').fill('0');
        await modal.getByRole('button', { name: 'Crear Gasto' }).click();

        await expect(modal.getByTestId('new-gasto-error-banner')).toContainText('El monto debe ser mayor a cero.', { timeout: 8000 });
        await expect(page.getByText('Crear Nuevo Gasto')).toBeVisible({ timeout: 5000 });

        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByText('Crear Nuevo Gasto')).not.toBeVisible({ timeout: 5000 });
    });
});
