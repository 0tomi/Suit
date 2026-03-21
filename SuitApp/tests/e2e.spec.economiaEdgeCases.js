import { test, expect } from '@playwright/test';
import {
    ensureSectionPinned,
    goToSection,
    launchAndLogin,
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
 * Ejecuta requests autenticados contra SuitAPI usando la sesión ya iniciada en Electron.
 * Se usa para sembrar el fixture E2E sin depender de datos accidentales.
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
        throw new Error('No hay case types o radicaciones disponibles para sembrar el fixture de Economía.');
    }

    const casePayload = {
        title: `PW ECO2 ${Date.now()}`,
        start_date: new Date().toISOString().split('T')[0],
        nro_expediente: `PW-${Date.now()}`,
        radicacion_id: radicaciones[0].id,
        case_type_id: caseTypes[0].id,
        details: 'Fixture temporal para regresión E2E de Economía',
    };

    const createCaseResponse = await apiRequest(apiConfig, '/cases', {
        method: 'POST',
        body: casePayload,
    });

    const createdCaseId = createCaseResponse.data?.data?.id ?? createCaseResponse.data?.id ?? null;
    if (!createCaseResponse.ok || !createdCaseId) {
        throw new Error(`No se pudo crear el caso fixture. Status=${createCaseResponse.status}`);
    }

    return {
        caseId: createdCaseId,
        caseTitle: casePayload.title,
        createdCaseId,
    };
}

/**
 * Prepara un caso visible y un cliente exclusivo del spec para que la fila
 * del honorario sea única y no dependa de datos accidentales del entorno.
 */
async function seedEconomiaFixture(apiConfig) {
    const { caseId, caseTitle, createdCaseId } = await ensureCase(apiConfig);
    const uniqueKey = Date.now();
    const clientPayload = {
        first_name: 'PW',
        last_name: `Economia ${uniqueKey}`,
        identification_number: `PW-ECO-${uniqueKey}`,
        email: `pw-economia-${uniqueKey}@example.test`,
        type: 'person',
        status: 'active',
        notes: 'Fixture temporal de Playwright para Economía.',
    };
    const createClientResponse = await apiRequest(apiConfig, '/clients', {
        method: 'POST',
        body: clientPayload,
    });
    const createdClient = createClientResponse.data?.data ?? createClientResponse.data ?? null;

    if (!createClientResponse.ok || !createdClient?.id) {
        throw new Error(`No se pudo crear el cliente fixture. Status=${createClientResponse.status}`);
    }

    const linkClientResponse = await apiRequest(apiConfig, `/cases/${caseId}/clients`, {
        method: 'POST',
        body: { client_ids: [createdClient.id] },
    });
    if (!linkClientResponse.ok && linkClientResponse.status !== 422) {
        throw new Error(`No se pudo vincular el cliente fixture al caso. Status=${linkClientResponse.status}`);
    }

    return {
        caseId,
        caseTitle,
        createdCaseId,
        clientId: createdClient.id,
        clientName: `${createdClient.first_name} ${createdClient.last_name}`.trim(),
    };
}

async function cleanupEconomiaFixture(apiConfig, fixture) {
    if (!fixture) return;

    for (const honorarioId of fixture.createdHonorarioIds || []) {
        await apiRequest(apiConfig, `/honorarios/${honorarioId}`, { method: 'DELETE' }).catch(() => null);
    }

    await apiRequest(apiConfig, `/cases/${fixture.caseId}/clients/${fixture.clientId}`, { method: 'DELETE' }).catch(() => null);
    await apiRequest(apiConfig, `/clients/${fixture.clientId}`, { method: 'DELETE' }).catch(() => null);

    if (fixture.createdCaseId) {
        await apiRequest(apiConfig, `/cases/${fixture.createdCaseId}`, { method: 'DELETE' }).catch(() => null);
    }
}

async function openEconomia(page) {
    await ensureSectionPinned(page, 'economia');
    await goToSection(page, 'economia', { timeout: 20000 });
}

async function openCaseEconomia(page, caseId) {
    const origin = await page.evaluate(() => window.location.origin);
    await page.goto(`${origin}/cases/${caseId}`);

    await expect(page.getByRole('button', { name: 'Economía' })).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Economía' }).click();
}

async function createHonorarioFixture(apiConfig, fixture, { monto, detalles }) {
    const response = await apiRequest(apiConfig, `/suit-cases/${fixture.caseId}/honorarios`, {
        method: 'POST',
        body: {
            client_id: fixture.clientId,
            monto,
            detalles,
        },
    });
    const honorario = response.data?.data ?? response.data ?? null;

    if (!response.ok || !honorario?.id) {
        throw new Error(`No se pudo crear el honorario fixture. Status=${response.status}`);
    }

    fixture.createdHonorarioIds.push(honorario.id);
    return honorario;
}

async function createEntregaFixture(apiConfig, honorarioId, { monto, nota }) {
    const tipoPagosResponse = await apiRequest(apiConfig, '/tipo-pagos');
    const tipoPagos = unwrapCollection(tipoPagosResponse.data);
    const tipoPagoId = tipoPagos[0]?.id;

    if (!tipoPagoId) {
        throw new Error('No hay tipos de pago disponibles para sembrar la entrega E2E.');
    }

    const response = await apiRequest(apiConfig, `/honorarios/${honorarioId}/entregas`, {
        method: 'POST',
        body: {
            honorario_id: honorarioId,
            tipo_pago_id: tipoPagoId,
            monto,
            nota,
        },
    });
    const entrega = response.data?.data ?? response.data ?? null;

    if (!response.ok || !entrega?.id) {
        throw new Error(`No se pudo crear la entrega fixture. Status=${response.status}`);
    }

    return entrega;
}

test.describe('Economía — ECO-2 y ECO-3', () => {
    test.describe.configure({ mode: 'serial' });

    let electronApp;
    let page;
    let apiConfig;
    let fixture;

    test.beforeAll(async () => {
        ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-economia-edge' }));
        apiConfig = await getApiConfig(page);
        fixture = await seedEconomiaFixture(apiConfig);
        fixture.createdHonorarioIds = [];
        await openEconomia(page);
    });

    test.afterAll(async () => {
        await cleanupEconomiaFixture(apiConfig, fixture);
        await electronApp?.close();
    });

    test('ECO-3: Honorarios vacía la lista al dejar el rango incompleto sin colgar la vista', async () => {
        await openEconomia(page);
        await page.locator('#economia-tab-honorarios').click();

        const fromInput = page.getByLabel('Fecha desde');
        await expect(fromInput).toBeVisible({ timeout: 10000 });
        await fromInput.fill('');

        await expect(page.getByText('No se encontraron honorarios en el rango seleccionado.')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('h1').filter({ hasText: 'Economía' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Nuevo Honorario' })).toBeVisible();
    });

    test('ECO-3: Gastos vacía la lista al dejar el rango incompleto sin colgar la vista', async () => {
        await openEconomia(page);
        await page.locator('#economia-tab-gastos').click();

        const toInput = page.getByLabel('Fecha hasta');
        await expect(toInput).toBeVisible({ timeout: 10000 });
        await toInput.fill('');

        await expect(page.getByText('No se encontraron gastos en el rango seleccionado.')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('h1').filter({ hasText: 'Economía' })).toBeVisible();
        await expect(page.getByRole('button', { name: 'Nuevo Gasto' })).toBeVisible();
    });

    test('ECO-2: eliminar una entrega usa ConfirmDialog y completa el borrado', async () => {
        const uniqueKey = Date.now();
        const honorarioAmount = `${1200 + (uniqueKey % 100)}`;
        const entregaAmount = '300';
        const entregaNote = `Entrega E2E ${uniqueKey}`;
        const honorario = await createHonorarioFixture(apiConfig, fixture, {
            monto: honorarioAmount,
            detalles: `Honorario E2E ${uniqueKey}`,
        });
        await createEntregaFixture(apiConfig, honorario.id, {
            monto: entregaAmount,
            nota: entregaNote,
        });

        await openCaseEconomia(page, fixture.caseId);

        const row = page.locator('tr', { hasText: fixture.clientName }).filter({ hasText: honorarioAmount }).first();
        await expect(row).toBeVisible({ timeout: 15000 });
        await row.click();

        await expect(page.getByText(entregaNote)).toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: 'Eliminar' }).first().click();

        const confirmDialog = page.getByRole('alertdialog');
        await expect(confirmDialog).toBeVisible({ timeout: 10000 });
        await expect(confirmDialog.getByText('¿Eliminar entrega?')).toBeVisible();

        await confirmDialog.getByRole('button', { name: 'Eliminar' }).click();

        await expect(page.getByText(entregaNote)).not.toBeVisible({ timeout: 10000 });
        await expect(page.getByText('No hay entregas registradas para este honorario.')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'Economía' })).toBeVisible();
    });
});
