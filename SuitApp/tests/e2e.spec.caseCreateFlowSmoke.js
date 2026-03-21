import { test, expect } from '@playwright/test';
import { goToSectionFromSectionsPage, launchAndLogin } from './helpers/electronTestUtils.js';

/**
 * Smoke E2E mínimo para el flujo de alta de casos.
 * Cubre el orden visible del bloque de clasificación, el filtro de tipos por fuero
 * y el reflejo del expediente creado en la tabla principal.
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
    const normalizedTipos = tipoExpedientes
        .map(normalizeTipoExpediente)
        .filter((item) => item.id && item.title && item.caseTypeId);
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

async function openNewCaseModal(page) {
    await goToSectionFromSectionsPage(page, 'cases', { timeout: 20000 });
    await page.getByRole('button', { name: 'Nuevo Caso' }).click();
    await expect(page.getByText('Iniciar Nuevo Caso')).toBeVisible({ timeout: 10000 });
}

async function selectFirstNonEmptyOption(page, fieldLabel) {
    const select = page.getByLabel(fieldLabel);

    await expect.poll(async () => {
        return await select.evaluate((element) =>
            Array.from(element.options).filter((option) => option.value !== '').length
        );
    }, {
        timeout: 10000,
        message: `Esperaba opciones cargadas para ${fieldLabel}.`,
    }).toBeGreaterThan(0);

    const optionValue = await select.evaluate((element) => {
        const option = Array.from(element.options).find((item) => item.value !== '');
        return option?.value ?? '';
    });

    await select.selectOption(optionValue);
}

async function fillSimpleCase(page, { caseTitle, expedienteNumber }) {
    await page.getByLabel('Carátula').fill(caseTitle);
    await page.getByLabel('Nro. Expediente').fill(expedienteNumber);
    await page.getByLabel('Fecha de Inicio').fill('2026-03-19');
    await selectFirstNonEmptyOption(page, 'Radicación');
    await selectFirstNonEmptyOption(page, 'Fuero');
}

test.describe('Smoke de alta de casos', () => {
    test.describe.configure({ mode: 'serial' });

    let electronApp;
    let page;
    let tipoFixture = null;

    test.beforeAll(async () => {
        ({ electronApp, window: page } = await launchAndLogin({
            prefix: 'suit-case-create-flow-smoke',
        }));

        const apiConfig = await getApiConfig(page);
        const [caseTypesResponse, tipoExpedientesResponse] = await Promise.all([
            apiRequest(apiConfig, '/case-types'),
            apiRequest(apiConfig, '/tipo-expedientes'),
        ]);

        const caseTypes = unwrapCollection(caseTypesResponse.data, ['case_types']);
        const tipoExpedientes = unwrapCollection(tipoExpedientesResponse.data, ['tipo_expedientes']);
        tipoFixture = pickTipoExpedienteFixture(caseTypes, tipoExpedientes);
    }, 60000);

    test.afterAll(async () => {
        await electronApp?.close();
    });

    test('ubica la clasificación después de los campos base y filtra tipos por fuero', async () => {
        if (!tipoFixture) {
            test.skip(true, 'La API no devolvió case types y tipo_expedientes suficientes para validar el filtro.');
            return;
        }

        await openNewCaseModal(page);

        const caratulaField = page.getByLabel('Carátula');
        const fechaField = page.getByLabel('Fecha de Inicio');
        const classificationHeading = page.getByText('Clasificación del expediente', { exact: true });
        const fueroField = page.getByLabel('Fuero');

        await expect(caratulaField).toBeVisible();
        await expect(fechaField).toBeVisible();
        await expect(classificationHeading).toBeVisible();
        await expect(fueroField).toBeVisible();

        const orderSnapshot = await page.evaluate(() => {
            const getLabelFor = (fieldId) => document.querySelector(`label[for="${fieldId}"]`);
            const caratula = getLabelFor('case-form-title');
            const fecha = getLabelFor('case-form-start-date');
            const clasificacion = Array.from(document.querySelectorAll('h3'))
                .find((node) => node.textContent?.includes('Clasificación del expediente'));
            const fuero = getLabelFor('case-form-type');

            return {
                caratulaBeforeClasificacion: Boolean(caratula && clasificacion && (caratula.compareDocumentPosition(clasificacion) & Node.DOCUMENT_POSITION_FOLLOWING)),
                fechaBeforeClasificacion: Boolean(fecha && clasificacion && (fecha.compareDocumentPosition(clasificacion) & Node.DOCUMENT_POSITION_FOLLOWING)),
                clasificacionBeforeFuero: Boolean(clasificacion && fuero && (clasificacion.compareDocumentPosition(fuero) & Node.DOCUMENT_POSITION_FOLLOWING)),
            };
        });

        expect(orderSnapshot.caratulaBeforeClasificacion).toBeTruthy();
        expect(orderSnapshot.fechaBeforeClasificacion).toBeTruthy();
        expect(orderSnapshot.clasificacionBeforeFuero).toBeTruthy();

        await page.getByLabel('Fuero').selectOption(tipoFixture.caseTypeId);
        await page.getByTestId('new-case-link-tipo-expediente').click();
        await expect(page.getByRole('heading', { name: 'Seleccionar Tipo de Expediente' })).toBeVisible({ timeout: 10000 });

        const searchInput = page.getByPlaceholder('Buscar por título...');
        await searchInput.fill(tipoFixture.hiddenTipoTitle);
        await expect(page.getByText('No hay tipos de expediente disponibles para el fuero seleccionado.')).toBeVisible({ timeout: 10000 });
        await expect(page.getByRole('button', { name: new RegExp(tipoFixture.hiddenTipoTitle, 'i') })).toHaveCount(0);

        await searchInput.fill(tipoFixture.visibleTipoTitle);
        await page.getByRole('button', { name: new RegExp(tipoFixture.visibleTipoTitle, 'i') }).first().click();

        await expect(page.getByRole('heading', { name: 'Seleccionar Tipo de Expediente' })).not.toBeVisible({ timeout: 10000 });
        await expect(page.getByTestId('new-case-linked-tipo-expediente')).toContainText(tipoFixture.visibleTipoTitle);

        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 10000 });
    });

    test('crea un caso simple y lo refleja en la tabla al cerrar el modal', async () => {
        const uniqueKey = Date.now();
        const caseTitle = `Caso smoke visible ${uniqueKey}`;

        await openNewCaseModal(page);
        await fillSimpleCase(page, {
            caseTitle,
            expedienteNumber: `PW-SMOKE-${uniqueKey}`,
        });

        await page.getByRole('button', { name: 'Crear Expediente' }).click();

        await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Error al crear caso')).toHaveCount(0);

        await page.getByTestId('cases-search-input').fill(caseTitle);
        await expect(page.getByRole('table').getByText(caseTitle)).toBeVisible({ timeout: 15000 });
    });

    test('el resumen del caso muestra radicación, fuero y tipo de expediente luego del alta', async () => {
        if (!tipoFixture) {
            test.skip(true, 'La API no devolvió tipos de expediente reutilizables para validar el resumen del caso.');
            return;
        }

        const uniqueKey = Date.now();
        const caseTitle = `Caso resumen ${uniqueKey}`;

        await openNewCaseModal(page);
        await page.getByLabel('Carátula').fill(caseTitle);
        await page.getByLabel('Nro. Expediente').fill(`PW-RESUMEN-${uniqueKey}`);
        await page.getByLabel('Fecha de Inicio').fill('2026-03-19');
        await selectFirstNonEmptyOption(page, 'Radicación');
        const selectedRadicacion = await page.getByLabel('Radicación').evaluate((element) => {
            const selectedOption = element.options[element.selectedIndex];
            return selectedOption?.textContent?.trim() || '';
        });
        await page.getByLabel('Fuero').selectOption(tipoFixture.caseTypeId);

        await page.getByTestId('new-case-link-tipo-expediente').click();
        await expect(page.getByRole('heading', { name: 'Seleccionar Tipo de Expediente' })).toBeVisible({ timeout: 10000 });
        await page.getByRole('button', { name: new RegExp(tipoFixture.visibleTipoTitle, 'i') }).first().click();
        await expect(page.getByRole('heading', { name: 'Seleccionar Tipo de Expediente' })).not.toBeVisible({ timeout: 10000 });

        await page.getByRole('button', { name: 'Crear Expediente' }).click();
        await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 15000 });

        await page.getByTestId('cases-search-input').fill(caseTitle);
        const caseRow = page.locator('tr', { hasText: caseTitle }).first();
        await expect(caseRow).toBeVisible({ timeout: 15000 });
        await caseRow.click();

        await expect(page.getByRole('heading', { name: caseTitle })).toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Radicación')).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(selectedRadicacion)).toBeVisible({ timeout: 10000 });
        await expect(page.getByText('Fuero')).toBeVisible({ timeout: 10000 });
        await expect(page.locator('p', { hasText: tipoFixture.caseTypeName }).first()).toBeVisible({ timeout: 10000 });
        await expect(page.getByText(tipoFixture.visibleTipoTitle)).toBeVisible({ timeout: 10000 });
    });
});
