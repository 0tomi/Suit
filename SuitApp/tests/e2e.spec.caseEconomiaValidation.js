import { test, expect } from '@playwright/test';
import {
    ensureSectionPinned,
    goToSection,
    launchAndLogin,
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
 * Reutiliza la sesión autenticada de Electron para sembrar fixtures reproducibles.
 * Así evitamos depender de datos accidentales del entorno de desarrollo.
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

function escapeRegex(value) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

async function seedCaseFormFixture(apiConfig) {
    const [rolesResponse, tipoExpedientesResponse] = await Promise.all([
        apiRequest(apiConfig, '/roles'),
        apiRequest(apiConfig, '/tipo-expedientes'),
    ]);

    const roles = unwrapCollection(rolesResponse.data);
    const tipoExpedientes = unwrapCollection(tipoExpedientesResponse.data);

    if (roles.length === 0) {
        throw new Error('No hay roles disponibles para sembrar el fixture de CAS-5.');
    }

    if (tipoExpedientes.length === 0) {
        throw new Error('No hay tipos de expediente disponibles para cubrir CAS-5.');
    }

    const uniqueKey = Date.now();
    const clientPayload = {
        first_name: 'PW',
        last_name: `Cliente ${uniqueKey}`,
        identification_number: `PW-CAS5-${uniqueKey}`,
        email: `pw-cas5-client-${uniqueKey}@example.test`,
        type: 'person',
        status: 'active',
    };
    const partePayload = {
        nombre: 'PW',
        apellido: `Parte ${uniqueKey}`,
        email: `pw-cas5-parte-${uniqueKey}@example.test`,
        rol_id: roles[0].id,
    };

    const [clientResponse, parteResponse] = await Promise.all([
        apiRequest(apiConfig, '/clients', { method: 'POST', body: clientPayload }),
        apiRequest(apiConfig, '/partes', { method: 'POST', body: partePayload }),
    ]);

    const createdClient = clientResponse.data?.data ?? clientResponse.data ?? null;
    const createdParte = parteResponse.data?.data ?? parteResponse.data ?? null;

    if (!clientResponse.ok || !createdClient?.id) {
        throw new Error(`No se pudo crear el cliente fixture de CAS-5. Status=${clientResponse.status}`);
    }

    if (!parteResponse.ok || !createdParte?.id) {
        throw new Error(`No se pudo crear la parte fixture de CAS-5. Status=${parteResponse.status}`);
    }

    return {
        clientId: createdClient.id,
        clientName: `${createdClient.first_name} ${createdClient.last_name}`.trim(),
        parteId: createdParte.id,
        parteName: `${createdParte.nombre} ${createdParte.apellido}`.trim(),
        tipoExpedienteTitle: tipoExpedientes[0].title || tipoExpedientes[0].titulo,
    };
}

async function cleanupCaseFormFixture(apiConfig, fixture) {
    if (!fixture) return;

    if (fixture.parteId) {
        await apiRequest(apiConfig, `/partes/${fixture.parteId}`, { method: 'DELETE' }).catch(() => null);
    }

    if (fixture.clientId) {
        await apiRequest(apiConfig, `/clients/${fixture.clientId}`, { method: 'DELETE' }).catch(() => null);
    }
}

async function reloadRenderer(page) {
    await page.reload();
    await waitForPageReady(page, 'agenda', { timeout: 20000 });
}

async function openNewCaseModal(page) {
    await goToSection(page, 'cases', { timeout: 20000 });
    await page.getByRole('button', { name: 'Nuevo Caso' }).click();
    await expect(page.getByText('Iniciar Nuevo Caso')).toBeVisible({ timeout: 10000 });
}

async function openEconomia(page) {
    await ensureSectionPinned(page, 'economia');
    await goToSection(page, 'economia', { timeout: 20000 });
}

async function selectEntityFromModal(page, {
    triggerTestId,
    searchPlaceholder,
    searchValue,
    optionPattern,
}) {
    const overlays = page.locator('div.fixed.inset-0.z-50');
    const baseOverlayCount = await overlays.count();

    await page.getByTestId(triggerTestId).click();
    await expect(overlays).toHaveCount(baseOverlayCount + 1, { timeout: 10000 });

    const searchInput = page.getByPlaceholder(searchPlaceholder);
    await searchInput.waitFor({ state: 'visible', timeout: 10000 });
    await searchInput.fill(searchValue);
    await page.locator('button').filter({ hasText: optionPattern }).first().click();
    await expect(overlays).toHaveCount(baseOverlayCount, { timeout: 10000 });
}

test.describe('CAS-5 y ECO-4', () => {
    test.describe.configure({ mode: 'serial' });

    let electronApp;
    let page;
    let apiConfig;
    let fixture;

    test.beforeAll(async () => {
        ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-case-economia-validation' }));
        apiConfig = await getApiConfig(page);
        fixture = await seedCaseFormFixture(apiConfig);
        await reloadRenderer(page);
    });

    test.afterAll(async () => {
        await cleanupCaseFormFixture(apiConfig, fixture);
        await electronApp?.close();
    });

    test('CAS-5: nuevo caso no duplica clientes, partes ni tipos de expediente al re-seleccionarlos', async () => {
        await openNewCaseModal(page);

        await selectEntityFromModal(page, {
            triggerTestId: 'new-case-link-client',
            searchPlaceholder: 'Buscar por nombre...',
            searchValue: fixture.clientName,
            optionPattern: new RegExp(escapeRegex(fixture.clientName), 'i'),
        });
        await expect(page.getByTestId('new-case-linked-client')).toHaveCount(1);

        await selectEntityFromModal(page, {
            triggerTestId: 'new-case-link-client',
            searchPlaceholder: 'Buscar por nombre...',
            searchValue: fixture.clientName,
            optionPattern: new RegExp(escapeRegex(fixture.clientName), 'i'),
        });
        await expect(page.getByTestId('new-case-linked-client')).toHaveCount(1);

        await selectEntityFromModal(page, {
            triggerTestId: 'new-case-link-party',
            searchPlaceholder: 'Buscar por nombre...',
            searchValue: fixture.parteName,
            optionPattern: new RegExp(escapeRegex(fixture.parteName), 'i'),
        });
        await expect(page.getByTestId('new-case-linked-party')).toHaveCount(1);

        await selectEntityFromModal(page, {
            triggerTestId: 'new-case-link-party',
            searchPlaceholder: 'Buscar por nombre...',
            searchValue: fixture.parteName,
            optionPattern: new RegExp(escapeRegex(fixture.parteName), 'i'),
        });
        await expect(page.getByTestId('new-case-linked-party')).toHaveCount(1);

        await selectEntityFromModal(page, {
            triggerTestId: 'new-case-link-tipo-expediente',
            searchPlaceholder: 'Buscar por título...',
            searchValue: fixture.tipoExpedienteTitle,
            optionPattern: new RegExp(escapeRegex(fixture.tipoExpedienteTitle), 'i'),
        });
        await expect(page.getByTestId('new-case-linked-tipo-expediente')).toHaveCount(1);

        await selectEntityFromModal(page, {
            triggerTestId: 'new-case-link-tipo-expediente',
            searchPlaceholder: 'Buscar por título...',
            searchValue: fixture.tipoExpedienteTitle,
            optionPattern: new RegExp(escapeRegex(fixture.tipoExpedienteTitle), 'i'),
        });
        await expect(page.getByTestId('new-case-linked-tipo-expediente')).toHaveCount(1);

        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 10000 });
    });

    test('ECO-4: Nuevo Honorario bloquea el submit si no se selecciona un caso', async () => {
        await openEconomia(page);
        await page.locator('#economia-tab-honorarios').click();

        await page.getByRole('button', { name: 'Nuevo Honorario' }).click();
        await expect(page.getByText('Crear Nuevo Honorario')).toBeVisible({ timeout: 10000 });

        await page.getByLabel('Monto').fill('1500');
        await page.getByRole('button', { name: 'Crear Honorario' }).click();

        await expect(page.getByText('Falta seleccionar un caso')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Elegí un caso antes de crear el honorario.')).toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: 'Cancelar' }).click();
    });

    test('ECO-4: Nuevo Gasto bloquea el submit si no se selecciona un caso', async () => {
        await openEconomia(page);
        await page.locator('#economia-tab-gastos').click();

        await page.getByRole('button', { name: 'Nuevo Gasto' }).click();
        await expect(page.getByText('Crear Nuevo Gasto')).toBeVisible({ timeout: 10000 });

        await page.getByLabel('Monto').fill('900');
        await page.getByRole('button', { name: 'Crear Gasto' }).click();

        await expect(page.getByText('Falta seleccionar un caso')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Elegí un caso antes de crear el gasto.')).toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: 'Cancelar' }).click();
    });
});
