import { test, expect } from '@playwright/test';
import {
    ensureSectionPinned,
    goToSection,
    launchAndLogin,
    selectFirstDropdownOption,
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

/** Usa la misma sesión autenticada de Electron para preparar y limpiar fixtures reales. */
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

async function getApiConfig(page) {
    return page.evaluate(async () => ({
        host: await window.electronAPI.config.get('api_host'),
        port: await window.electronAPI.config.get('api_port'),
        token: await window.electronAPI.config.get('auth_token'),
    }));
}

async function findParteByEmail(apiConfig, email) {
    const partesResponse = await apiRequest(apiConfig, '/partes');
    const partes = unwrapCollection(partesResponse.data);
    return partes.find((parte) => parte.email === email) ?? null;
}

/** Selecciona una entidad desde los modales de vínculo del formulario de casos. */
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

/** Devuelve un value real de <select> o null si el catálogo todavía no está listo. */
async function getFirstSelectableValue(page, selector) {
    const options = page.locator(`${selector} option`);
    const optionCount = await options.count().catch(() => 0);

    for (let index = 0; index < optionCount; index += 1) {
        const value = await options.nth(index).getAttribute('value');
        if (value) return value;
    }

    return null;
}

async function getCurrentCaseIdFromHash(page) {
    return page.evaluate(() => {
        const match = window.location.hash.match(/#\/cases\/(\d+)/);
        return match ? Number(match[1]) : null;
    });
}

async function buildCas4Fixture(apiConfig) {
    const [caseTypesResponse, radicacionesResponse] = await Promise.all([
        apiRequest(apiConfig, '/case-types'),
        apiRequest(apiConfig, '/radicaciones'),
    ]);

    const caseTypes = unwrapCollection(caseTypesResponse.data);
    const radicaciones = unwrapCollection(radicacionesResponse.data);

    if (caseTypes.length === 0 || radicaciones.length === 0) {
        return {
            skipReason: [
                'CAS-4 bloqueado por datos reales del entorno.',
                'Faltan case-types o radicaciones para completar el formulario de nuevo caso.',
            ].join(' '),
        };
    }

    const uniqueKey = Date.now();
    const clientPayload = {
        first_name: 'PW',
        last_name: `CAS4 ${uniqueKey}`,
        identification_number: `PW-CAS4-${uniqueKey}`,
        email: `pw-cas4-${uniqueKey}@example.test`,
        type: 'person',
        status: 'active',
        notes: 'Fixture temporal de Playwright para CAS-4.',
    };

    const createClientResponse = await apiRequest(apiConfig, '/clients', {
        method: 'POST',
        body: clientPayload,
    });
    const createdClient = createClientResponse.data?.data ?? createClientResponse.data ?? null;

    if (!createClientResponse.ok || !createdClient?.id) {
        throw new Error(`No se pudo crear el cliente fixture de CAS-4. Status=${createClientResponse.status}`);
    }

    return {
        clientId: createdClient.id,
        clientName: `${createdClient.first_name} ${createdClient.last_name}`.trim(),
        caseTitle: `PW CAS4 ${uniqueKey}`,
        expediente: `PW-CAS4-EXP-${uniqueKey}`,
        startDate: new Date().toISOString().split('T')[0],
    };
}

async function cleanupCas4Fixture(apiConfig, fixture) {
    if (!fixture || fixture.skipReason) return;

    if (fixture.clientId) {
        await apiRequest(apiConfig, `/clients/${fixture.clientId}`, { method: 'DELETE' }).catch(() => null);
    }

    if (fixture.createdCaseId) {
        await apiRequest(apiConfig, `/cases/${fixture.createdCaseId}`, { method: 'DELETE' }).catch(() => null);
    }
}

async function reloadRenderer(page) {
    await page.reload();
    await waitForPageReady(page, 'agenda', { timeout: 30000 });
}

let electronApp;
let page;
let apiConfig;

test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-par3-cas4' }));
    apiConfig = await getApiConfig(page);
    await ensureSectionPinned(page, 'people', { timeout: 20000 });
    await ensureSectionPinned(page, 'cases', { timeout: 20000 });
}, 90000);

test.afterAll(async () => {
    await electronApp?.close();
});

test.describe('PAR-3 y CAS-4', () => {
    test.describe.configure({ mode: 'serial' });

    test('PAR-3: Personas > Partes crea una parte por UI y refresca la tabla con la fila nueva', async () => {
        await goToSection(page, 'people', { timeout: 20000 });
        await page.locator('#people-tab-partes').click();
        await expect(page.getByTestId('page-partes-title')).toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: 'Nueva Parte' }).click();
        const modalHeading = page.getByRole('heading', { name: 'Crear Nueva Parte' });
        await expect(modalHeading).toBeVisible({ timeout: 10000 });

        const uniqueKey = Date.now();
        const parteName = `PW PAR3 ${uniqueKey}`;
        const parteLastName = 'Smoke';
        const parteEmail = `pw-par3-${uniqueKey}@example.test`;
        const fullName = `${parteName} ${parteLastName}`;

        await page.locator('input#nombre').fill(parteName);
        await page.locator('input#apellido').fill(parteLastName);
        await page.locator('input#email').fill(parteEmail);

        const roleTrigger = page.locator('label[for="rol_id"]').locator('xpath=following::button[1]');
        const selectedRole = await selectFirstDropdownOption(page, roleTrigger);
        if (!selectedRole) {
            test.skip(true, [
                'PAR-3 bloqueado sólo para este entorno.',
                'El selector real de roles no expuso opciones visibles para crear una parte.',
            ].join(' '));
            return;
        }

        await expect(roleTrigger).toContainText(selectedRole, { timeout: 5000 });
        await page.getByRole('button', { name: 'Crear Parte' }).click();

        await expect(modalHeading).not.toBeVisible({ timeout: 15000 });
        const createdRow = page.locator('tr', { hasText: fullName }).first();
        await expect(createdRow).toBeVisible({ timeout: 15000 });
        await expect(createdRow).toContainText(selectedRole);

        const createdParte = await findParteByEmail(apiConfig, parteEmail);
        if (createdParte?.id) {
            await apiRequest(apiConfig, `/partes/${createdParte.id}`, { method: 'DELETE' }).catch(() => null);
        }
    });

    test('CAS-4: si falla el vínculo real de clientes, el caso se crea igual y la UI lo informa como parcial', async () => {
        const fixture = await buildCas4Fixture(apiConfig);
        if (fixture.skipReason) {
            test.skip(true, fixture.skipReason);
            return;
        }

        try {
            // El cliente fixture se crea por API; recargar hace que ClientsContext lo relea
            // desde cache/sync antes de abrir el modal de selección real.
            await reloadRenderer(page);
            await goToSection(page, 'cases', { timeout: 20000 });
            await page.getByRole('button', { name: 'Nuevo Caso' }).click();
            await expect(page.getByText('Iniciar Nuevo Caso')).toBeVisible({ timeout: 10000 });

            await selectEntityFromModal(page, {
                triggerTestId: 'new-case-link-client',
                searchPlaceholder: 'Buscar por nombre...',
                searchValue: fixture.clientName,
                optionPattern: new RegExp(fixture.clientName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'),
            });
            await expect(page.getByTestId('new-case-linked-client')).toContainText(fixture.clientName);

            await page.locator('#case-form-title').fill(fixture.caseTitle);
            await page.locator('#case-form-nro-expediente').fill(fixture.expediente);
            await page.locator('#case-form-start-date').fill(fixture.startDate);

            const caseTypeValue = await getFirstSelectableValue(page, '#case-form-type');
            const radicacionValue = await getFirstSelectableValue(page, '#case-form-radicacion');
            if (!caseTypeValue || !radicacionValue) {
                test.skip(true, [
                    'CAS-4 bloqueado sólo para este entorno.',
                    'El formulario real no mostró opciones seleccionables para tipo de caso o radicación.',
                ].join(' '));
                return;
            }

            await page.locator('#case-form-type').selectOption(caseTypeValue);
            await page.locator('#case-form-radicacion').selectOption(radicacionValue);

            const deletedClientResponse = await apiRequest(apiConfig, `/clients/${fixture.clientId}`, { method: 'DELETE' });
            if (!deletedClientResponse.ok) {
                test.skip(true, [
                    'CAS-4 bloqueado sólo para este entorno.',
                    `No se pudo provocar el fallo real borrando el cliente fixture. Status=${deletedClientResponse.status}.`,
                ].join(' '));
                return;
            }

            await page.getByRole('button', { name: 'Crear Expediente' }).click();

            await expect(page.getByText('Caso creado con vínculos pendientes')).toBeVisible({ timeout: 15000 });
            await expect(page.getByText(/falló la vinculación de clientes/i)).toBeVisible({ timeout: 15000 });
            await expect(page.getByRole('heading', { name: fixture.caseTitle })).toBeVisible({ timeout: 15000 });
            fixture.createdCaseId = await getCurrentCaseIdFromHash(page);
        } finally {
            await cleanupCas4Fixture(apiConfig, fixture);
        }
    });
});
