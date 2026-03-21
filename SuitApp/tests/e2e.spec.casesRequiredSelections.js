import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin } from './helpers/electronTestUtils.js';

/**
 * Feature: creación de casos
 * Hipótesis cubiertas:
 * - #1 Si el usuario intenta crear un expediente sin tipo de caso, la UI bloquea el submit
 *   y muestra un diálogo explícito, porque `case_type_id` no puede depender solo del `required` HTML.
 * - #2 Si el usuario intenta crear un expediente sin radicación, la UI bloquea el submit
 *   y muestra un diálogo explícito, porque `radicacion_id` vacío no debe convertirse en `0`.
 *
 * Puntos críticos:
 * - El flujo corre dentro de Electron y usa el modal real de Casos.
 * - Los catálogos de tipo/radicación se resuelven desde la UI; el test no asume IDs fijos.
 * - El diálogo de validación usa `ConfirmDialog`, así que se verifica comportamiento observable.
 */

async function openNewCaseModal(page) {
    await goToSection(page, 'cases', { timeout: 20000 });
    await page.getByRole('button', { name: 'Nuevo Caso' }).click();
    await expect(page.getByText('Iniciar Nuevo Caso')).toBeVisible({ timeout: 10000 });
}

async function fillRequiredBaseFields(page) {
    const uniqueKey = Date.now();
    await page.getByLabel('Carátula').fill(`Caso PW ${uniqueKey}`);
    await page.getByLabel('Nro. Expediente').fill(`PW-${uniqueKey}`);
    await page.getByLabel('Fecha de Inicio').fill('2026-03-18');
}

async function selectFirstNonEmptyOption(page, fieldLabel) {
    const select = page.getByLabel(fieldLabel);

    await expect
        .poll(async () => {
            return await select.evaluate((element) =>
                Array.from(element.options).filter((option) => option.value !== '').length
            );
        }, {
            timeout: 10000,
            message: `Esperaba opciones cargadas para ${fieldLabel}.`,
        })
        .toBeGreaterThan(0);

    const optionValue = await select.evaluate((element) => {
        const option = Array.from(element.options).find((item) => item.value !== '');
        return option?.value ?? '';
    });

    await select.selectOption(optionValue);
}

async function bypassNativeRequiredValidation(page, fieldLabel) {
    await page.getByLabel(fieldLabel).evaluate((element) => {
        element.removeAttribute('required');
    });
}

async function expectValidationDialog(page, { title, description }) {
    await expect(page.getByText(title)).toBeVisible({ timeout: 10000 });
    await expect(page.getByText(description)).toBeVisible({ timeout: 10000 });
    await page.getByRole('button', { name: 'Aceptar' }).click();
    await expect(page.getByText(title)).not.toBeVisible({ timeout: 10000 });
}

test.describe('CAS-6 y CAS-7', () => {
    test.describe.configure({ mode: 'serial' });

    let electronApp;
    let page;

    test.beforeAll(async () => {
        ({ electronApp, window: page } = await launchAndLogin({ prefix: 'suit-cases-required-selections' }));
    });

    test.afterAll(async () => {
        await electronApp?.close();
    });

    test('CAS-7: bloquea la creación cuando falta tipo de caso', async () => {
        await openNewCaseModal(page);
        await fillRequiredBaseFields(page);
        await selectFirstNonEmptyOption(page, 'Radicación');
        await bypassNativeRequiredValidation(page, 'Fuero');

        await page.getByRole('button', { name: 'Crear Expediente' }).click();

        await expectValidationDialog(page, {
            title: 'Falta seleccionar un fuero',
            description: 'Elegí un fuero antes de crear el expediente.',
        });

        await expect(page.getByText('Iniciar Nuevo Caso')).toBeVisible();
        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 10000 });
    });

    test('CAS-6: bloquea la creación cuando falta radicación', async () => {
        await openNewCaseModal(page);
        await fillRequiredBaseFields(page);
        await selectFirstNonEmptyOption(page, 'Fuero');
        await bypassNativeRequiredValidation(page, 'Radicación');

        await page.getByRole('button', { name: 'Crear Expediente' }).click();

        await expectValidationDialog(page, {
            title: 'Falta seleccionar una radicación',
            description: 'Elegí una radicación antes de crear el expediente.',
        });

        await expect(page.getByText('Iniciar Nuevo Caso')).toBeVisible();
        await page.getByRole('button', { name: 'Cancelar' }).click();
        await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 10000 });
    });

    test('CAS recent fix: crear un caso lo refleja en la lista sin mostrar falso error', async () => {
        const uniqueKey = Date.now();
        const caseTitle = `Caso PW visible ${uniqueKey}`;

        await openNewCaseModal(page);

        await expect(page.getByLabel('Carátula')).toBeVisible();
        await expect(page.getByLabel('Fuero')).toBeVisible();
        await fillRequiredBaseFields(page);
        await page.getByLabel('Carátula').fill(caseTitle);
        await page.getByLabel('Nro. Expediente').fill(`PW-VISIBLE-${uniqueKey}`);
        await selectFirstNonEmptyOption(page, 'Fuero');
        await selectFirstNonEmptyOption(page, 'Radicación');

        await page.getByRole('button', { name: 'Crear Expediente' }).click();

        await expect(page.getByText('Iniciar Nuevo Caso')).not.toBeVisible({ timeout: 15000 });
        await expect(page.getByText('Error al crear caso')).toHaveCount(0);

        await page.getByTestId('cases-search-input').fill(caseTitle);
        await expect(page.getByRole('table').getByText(caseTitle)).toBeVisible({ timeout: 15000 });
    });
});
