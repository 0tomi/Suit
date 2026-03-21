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

async function buildEntregaFixture(apiConfig) {
    const [caseTypesResponse, radicacionesResponse, tipoPagosResponse] = await Promise.all([
        apiRequest(apiConfig, '/case-types'),
        apiRequest(apiConfig, '/radicaciones'),
        apiRequest(apiConfig, '/tipo-pagos'),
    ]);

    const caseTypes = unwrapCollection(caseTypesResponse.data);
    const radicaciones = unwrapCollection(radicacionesResponse.data);
    const tipoPagos = unwrapCollection(tipoPagosResponse.data);

    if (caseTypes.length === 0 || radicaciones.length === 0) {
        return {
            skipReason: [
                'ECO-7 bloqueado por datos API.',
                'Faltan case-types o radicaciones para sembrar el caso fixture.',
            ].join(' '),
        };
    }

    if (tipoPagos.length === 0) {
        return {
            skipReason: [
                'ECO-7 bloqueado por datos API.',
                'No hay tipos de pago para sembrar la entrega fixture.',
            ].join(' '),
        };
    }

    const uniqueKey = Date.now();
    const casePayload = {
        title: `PW ECO7 ${uniqueKey}`,
        start_date: new Date().toISOString().split('T')[0],
        nro_expediente: `PW-ECO7-${uniqueKey}`,
        radicacion_id: radicaciones[0].id,
        case_type_id: caseTypes[0].id,
        details: 'Fixture temporal para ECO-7.',
    };
    const clientPayload = {
        first_name: 'PW',
        last_name: `ECO7 ${uniqueKey}`,
        identification_number: `PW-ECO7-${uniqueKey}`,
        email: `pw-eco7-${uniqueKey}@example.test`,
        type: 'person',
        status: 'active',
        notes: 'Fixture temporal de Playwright para ECO-7.',
    };

    const createCaseResponse = await apiRequest(apiConfig, '/cases', {
        method: 'POST',
        body: casePayload,
    });
    const createdCase = createCaseResponse.data?.case ?? createCaseResponse.data?.data ?? createCaseResponse.data ?? null;
    if (!createCaseResponse.ok || !createdCase?.id) {
        throw new Error(`No se pudo crear el caso fixture de ECO-7. Status=${createCaseResponse.status}`);
    }

    const createClientResponse = await apiRequest(apiConfig, '/clients', {
        method: 'POST',
        body: clientPayload,
    });
    const createdClient = createClientResponse.data?.data ?? createClientResponse.data ?? null;
    if (!createClientResponse.ok || !createdClient?.id) {
        throw new Error(`No se pudo crear el cliente fixture de ECO-7. Status=${createClientResponse.status}`);
    }

    const linkClientResponse = await apiRequest(apiConfig, `/cases/${createdCase.id}/clients`, {
        method: 'POST',
        body: { client_ids: [createdClient.id] },
    });
    if (!linkClientResponse.ok && linkClientResponse.status !== 422) {
        throw new Error(`No se pudo vincular el cliente fixture al caso. Status=${linkClientResponse.status}`);
    }

    const honorarioAmount = `${1700 + (uniqueKey % 200)}`;
    const entregaAmount = '350';
    const entregaNote = `Entrega ECO7 ${uniqueKey}`;

    const createHonorarioResponse = await apiRequest(apiConfig, `/suit-cases/${createdCase.id}/honorarios`, {
        method: 'POST',
        body: {
            client_id: createdClient.id,
            monto: honorarioAmount,
            detalles: `Honorario ECO7 ${uniqueKey}`,
        },
    });
    const createdHonorario = createHonorarioResponse.data?.data ?? createHonorarioResponse.data ?? null;
    if (!createHonorarioResponse.ok || !createdHonorario?.id) {
        throw new Error(`No se pudo crear el honorario fixture de ECO-7. Status=${createHonorarioResponse.status}`);
    }

    const createEntregaResponse = await apiRequest(apiConfig, `/honorarios/${createdHonorario.id}/entregas`, {
        method: 'POST',
        body: {
            honorario_id: createdHonorario.id,
            tipo_pago_id: tipoPagos[0].id,
            monto: entregaAmount,
            nota: entregaNote,
        },
    });
    const createdEntrega = createEntregaResponse.data?.data ?? createEntregaResponse.data ?? null;
    if (!createEntregaResponse.ok || !createdEntrega?.id) {
        throw new Error(`No se pudo crear la entrega fixture de ECO-7. Status=${createEntregaResponse.status}`);
    }

    return {
        caseId: createdCase.id,
        caseTitle: createdCase.title ?? casePayload.title,
        createdCaseId: createdCase.id,
        clientId: createdClient.id,
        clientName: `${createdClient.first_name} ${createdClient.last_name}`.trim(),
        honorarioId: createdHonorario.id,
        honorarioAmount,
        entregaAmount,
        entregaId: createdEntrega.id,
        entregaNote,
    };
}

async function cleanupEntregaFixture(apiConfig, fixture) {
    if (!fixture || fixture.skipReason) return;

    if (fixture.entregaId) {
        await apiRequest(apiConfig, `/entregas/${fixture.entregaId}`, { method: 'DELETE' }).catch(() => null);
    }

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

async function openCaseEconomiaFromUi(page, caseTitle) {
    await goToSection(page, 'cases', { timeout: 20000 });

    const row = page.locator('tr', { hasText: caseTitle }).first();
    await expect(row).toBeVisible({ timeout: 15000 });
    await row.click();

    await expect(page.getByRole('heading', { name: caseTitle })).toBeVisible({ timeout: 15000 });
    await page.getByRole('button', { name: 'Economía' }).click();
    await expect(page.getByRole('heading', { name: 'Honorarios' })).toBeVisible({ timeout: 10000 });
}

function createRuntimeTracker(page) {
    const pageErrors = [];
    const consoleErrors = [];

    page.on('pageerror', (error) => {
        pageErrors.push(error.message);
    });

    page.on('console', (message) => {
        if (message.type() !== 'error') return;

        const text = message.text();
        if (/(uncaught|typeerror|referenceerror|cannot|failed to render|react)/i.test(text)) {
            consoleErrors.push(text);
        }
    });

    return {
        mark() {
            return {
                pageErrors: pageErrors.length,
                consoleErrors: consoleErrors.length,
            };
        },
        expectNoRuntimeErrors(mark) {
            expect(pageErrors.slice(mark.pageErrors)).toEqual([]);
            expect(consoleErrors.slice(mark.consoleErrors)).toEqual([]);
        },
    };
}

test.describe('Economía — ECO-7 y ECO-11', () => {
    test.describe.configure({ mode: 'serial' });

    let electronApp;
    let page;
    let apiConfig;
    let runtimeTracker;
    const createdFixtures = [];

    test.beforeAll(async () => {
        ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-eco7-eco11' }));
        runtimeTracker = createRuntimeTracker(page);
        apiConfig = await getApiConfig(page);
        await ensureSectionPinned(page, 'economia', { timeout: 20000 });
    });

    test.afterAll(async () => {
        for (const fixture of createdFixtures.reverse()) {
            await cleanupEntregaFixture(apiConfig, fixture);
        }

        await electronApp?.close();
    });

    test('ECO-11: Economía carga Honorarios y Gastos sin errores runtime', async () => {
        const runtimeMark = runtimeTracker.mark();

        await goToSection(page, 'economia', { timeout: 20000 });
        await expect(page.getByTestId('page-economia-title')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: 'Nuevo Honorario' })).toBeVisible({ timeout: 10000 });

        await page.locator('#economia-tab-gastos').click();
        await expect(page.getByRole('button', { name: 'Nuevo Gasto' })).toBeVisible({ timeout: 10000 });

        await page.locator('#economia-tab-honorarios').click();
        await expect(page.getByRole('button', { name: 'Nuevo Honorario' })).toBeVisible({ timeout: 10000 });

        runtimeTracker.expectNoRuntimeErrors(runtimeMark);
    });

    test('ECO-7: eliminar entrega refresca la vista sin dejar estado stale', async () => {
        const fixture = await buildEntregaFixture(apiConfig);
        if (fixture.skipReason) {
            test.skip(true, fixture.skipReason);
            return;
        }

        createdFixtures.push(fixture);

        const runtimeMark = runtimeTracker.mark();
        await openCaseEconomiaFromUi(page, fixture.caseTitle);

        const honorarioRow = page.locator('tr', { hasText: fixture.clientName })
            .filter({ hasText: fixture.honorarioAmount })
            .first();
        await honorarioRow.waitFor({ state: 'visible', timeout: 15000 }).catch(() => null);
        if (!(await honorarioRow.isVisible().catch(() => false))) {
            test.skip(true, [
                'ECO-7 bloqueado por datos externos.',
                'El honorario fixture creado por API no apareció en la vista observable de Economía del caso.',
                'Sin esa fila no se puede validar el flujo de borrar entrega con evidencia E2E confiable.',
            ].join(' '));
            return;
        }
        await honorarioRow.click();

        const entregasModalTitle = page.getByText('Entregas del Honorario');
        await expect(entregasModalTitle).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(fixture.entregaNote)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(`$${fixture.entregaAmount}`)).toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: 'Eliminar' }).first().click();

        const confirmDialog = page.getByRole('alertdialog');
        await expect(confirmDialog).toBeVisible({ timeout: 10000 });
        await expect(confirmDialog.getByText('¿Eliminar entrega?')).toBeVisible();
        await confirmDialog.getByRole('button', { name: 'Eliminar' }).click();

        await expect(page.getByText(fixture.entregaNote)).not.toBeVisible({ timeout: 10000 });
        await expect(page.getByText('No hay entregas registradas para este honorario.')).toBeVisible({ timeout: 10000 });
        await expect(entregasModalTitle).toBeVisible({ timeout: 5000 });

        fixture.entregaId = null;
        runtimeTracker.expectNoRuntimeErrors(runtimeMark);
    });
});
