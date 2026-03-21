import path from 'path';
import { test, expect } from '@playwright/test';
import { launchAndLogin, goToSection } from './helpers/electronTestUtils.js';
import { createCaseTestDiagnostics } from './helpers/caseTestDiagnostics.js';

async function waitForCaseTableState(window, timeout = 15000) {
    const emptyMessage = 'No se encontraron casos que coincidan con la búsqueda.';

    await window.waitForFunction((message) => {
        const rows = document.querySelectorAll('table tbody tr').length;
        const bodyText = document.body?.innerText || '';
        return rows > 0 || bodyText.includes(message);
    }, emptyMessage, { timeout });

    const rowCount = await window.locator('table tbody tr').count();
    if (rowCount === 0) {
        await expect(window.getByText(emptyMessage)).toBeVisible({ timeout });
        return { isEmpty: true, rowCount };
    }

    return { isEmpty: false, rowCount };
}

async function openFirstCase(window) {
    const firstCaseRow = window.locator('table tbody tr').first();
    await firstCaseRow.click();
    await expect(window.locator('h3', { hasText: 'Estado del Caso' })).toBeVisible({ timeout: 15000 });
}

/**
 * Lee solo eventos visibles del calendario para detectar duplicados reales de render.
 */
async function getVisibleCalendarEventLabels(window) {
    return await window.locator('.rbc-event').evaluateAll((nodes) => (
        nodes
            .filter((node) => {
                const style = window.getComputedStyle(node);
                const rect = node.getBoundingClientRect();
                return style.display !== 'none'
                    && style.visibility !== 'hidden'
                    && rect.width > 0
                    && rect.height > 0;
            })
            .map((node) => node.textContent?.replace(/\s+/g, ' ').trim())
            .filter(Boolean)
    ));
}

/**
 * Verifica que volver desde el editor deje al usuario nuevamente en la pestaña Documentos del caso.
 */
async function expectReturnedToCaseDocuments(window, caseId) {
    await expect.poll(async () => await window.url(), {
        timeout: 15000,
        message: 'El editor no regresó al detalle del caso esperado.',
    }).toContain(`/cases/${caseId}`);

    await expect(window.getByText('Documentación Vinculada')).toBeVisible({ timeout: 10000 });
    await expect(window.getByRole('button', { name: 'Nuevo Doc' })).toBeVisible({ timeout: 10000 });
}

/**
 * Algunos flujos del editor pueden abrir el diálogo de cambios sin guardar al salir.
 * Si aparece, lo confirmamos para seguir validando el destino de retorno.
 */
async function confirmUnsavedExitIfNeeded(window) {
    const leaveWithoutSavingButton = window.getByRole('button', { name: 'Salir sin guardar' });
    if (await leaveWithoutSavingButton.isVisible().catch(() => false)) {
        await leaveWithoutSavingButton.click();
    }
}

async function openCaseDocumentsTab(window) {
    await window.getByRole('button', { name: 'Documentos' }).click();
    await expect(window.getByText('Documentación Vinculada')).toBeVisible({ timeout: 10000 });
}

async function ensureCaseMultimediaAvailable(window) {
    await window.getByRole('button', { name: 'Multimedia' }).click();

    const galleryHeading = window.getByRole('heading', { name: 'Galería de Evidencia' });
    const emptyGalleryHeading = window.getByRole('heading', { name: 'Galería Vacía' });

    if (await galleryHeading.isVisible().catch(() => false)) {
        return;
    }

    await expect(emptyGalleryHeading).toBeVisible({ timeout: 10000 });
    await window.locator('#case-media-upload').setInputFiles(path.resolve('tests/debug-1.png'));

    await expect(window.getByText('Archivo subido')).toBeVisible({ timeout: 15000 });
    await expect(galleryHeading).toBeVisible({ timeout: 15000 });
}

test.describe('CaseDetail — transparencia y smoke del módulo Casos', () => {
    test.setTimeout(45_000);

    let diagnostics = null;
    let electronApp = null;
    let window = null;

    test.afterEach(async ({ browserName }, testInfo) => {
        void browserName;
        if (diagnostics) {
            await diagnostics.finalize();
            diagnostics = null;
        }

        if (electronApp) {
            await electronApp.close().catch(() => null);
            electronApp = null;
            window = null;
        }

        await testInfo.attach('case-timeout-budget', {
            body: JSON.stringify({ timeoutMs: testInfo.timeout }, null, 2),
            contentType: 'application/json',
        });
    });

    test('CaseDetail muestra estado localizado, partes reacciona y agenda del caso abre sin duplicar eventos visibles', async ({ browserName }, testInfo) => {
        void browserName;
        ({ electronApp, window } = await launchAndLogin({ prefix: 'case-detail-smoke' }));
        diagnostics = await createCaseTestDiagnostics({ window, testInfo });
        await diagnostics.init();

        await diagnostics.runStep('go-to-cases', async () => {
            await goToSection(window, 'cases', { timeout: 15000 });
        });

        const casesState = await diagnostics.runStep('wait-for-cases-table', async () => {
            return await waitForCaseTableState(window);
        });

        if (casesState.isEmpty) return;

        await diagnostics.runStep('open-first-case', async () => {
            await openFirstCase(window);
        });

        await diagnostics.runStep('assert-localized-status', async () => {
            const statusBadge = window.locator('h3', { hasText: 'Estado del Caso' }).locator('..').getByText(/Activo|Finalizado/).first();
            await expect(statusBadge).toBeVisible({ timeout: 10000 });
            await expect(window.getByText('active', { exact: true })).toHaveCount(0);
        });

        await diagnostics.runStep('open-parties-modal', async () => {
            await window.getByRole('button', { name: 'Partes' }).click();
            await window.getByRole('button', { name: 'Agregar Usuario' }).click();
            await expect(window.getByText('Agregar Participante')).toBeVisible({ timeout: 10000 });
            await window.getByRole('button', { name: 'Cancelar' }).click();
            await expect(window.getByText('Agregar Participante')).toHaveCount(0);
        });

        await diagnostics.runStep('open-case-agenda', async () => {
            await window.getByRole('button', { name: 'Agenda' }).click();
            await expect(window.getByTestId('page-agenda-title')).toContainText('Agenda del Caso', { timeout: 15000 });
        });

        await diagnostics.runStep('assert-no-visible-duplicate-events', async () => {
            const labels = await getVisibleCalendarEventLabels(window);
            const duplicateLabels = labels.filter((label, index) => labels.indexOf(label) !== index);

            expect(duplicateLabels, `Eventos visibles duplicados: ${duplicateLabels.join(', ')}`).toEqual([]);
        });
    });

    test('CaseDetail bloquea vincular existente y vuelve al caso desde documentos nuevos o existentes', async ({ browserName }, testInfo) => {
        void browserName;
        ({ electronApp, window } = await launchAndLogin({ prefix: 'case-detail-documents' }));
        diagnostics = await createCaseTestDiagnostics({ window, testInfo });
        await diagnostics.init();

        await diagnostics.runStep('go-to-cases', async () => {
            await goToSection(window, 'cases', { timeout: 15000 });
        });

        const casesState = await diagnostics.runStep('wait-for-cases-table', async () => {
            return await waitForCaseTableState(window);
        });

        if (casesState.isEmpty) return;

        await diagnostics.runStep('open-first-case', async () => {
            await openFirstCase(window);
        });

        const caseUrl = await window.url();
        const caseId = caseUrl.match(/\/cases\/(\d+)/)?.[1] || '';

        await diagnostics.runStep('open-documents-tab', async () => {
            await window.getByRole('button', { name: 'Documentos' }).click();
            await expect(window.getByText('Documentación Vinculada')).toBeVisible({ timeout: 10000 });
        });

        await diagnostics.runStep('assert-link-existing-disabled', async () => {
            const linkExistingButton = window.getByRole('button', { name: 'Vincular Existente' });
            await expect(linkExistingButton).toBeDisabled();
            await linkExistingButton.locator('..').hover({ force: true });
            await expect(window.getByText('En desarrollo')).toBeVisible({ timeout: 5000 });
        });

        await diagnostics.runStep('navigate-new-document', async () => {
            await window.getByRole('button', { name: 'Nuevo Doc' }).click();
            await expect.poll(async () => await window.url(), {
                timeout: 15000,
                message: 'La navegación al editor de documentos no se completó.',
            }).toContain(`/documents/new?caseId=${caseId}`);
        });

        await diagnostics.runStep('return-from-new-document', async () => {
            await window.getByRole('button', { name: 'Volver' }).click();
            await confirmUnsavedExitIfNeeded(window);
            await expectReturnedToCaseDocuments(window, caseId);
        });

        await diagnostics.runStep('return-from-existing-document', async () => {
            const documentTitleButtons = window.locator('tbody tr td:first-child button');
            const count = await documentTitleButtons.count();

            if (count === 0) {
                testInfo.annotations.push({
                    type: 'coverage-gap',
                    description: 'El caso abierto no tenía documentos vinculados para validar el flujo de abrir existente.',
                });
                return;
            }

            await documentTitleButtons.first().click();
            await expect.poll(async () => await window.url(), {
                timeout: 15000,
                message: 'La navegación al documento existente no se completó.',
            }).toContain('/documents/edit/');

            await window.getByRole('button', { name: 'Volver' }).click();
            await confirmUnsavedExitIfNeeded(window);
            await expectReturnedToCaseDocuments(window, caseId);
        });
    });

    /**
     * HIPÓTESIS #3
     * Si el usuario abre multimedia desde el detalle del caso,
     * entonces el visor debe montarse y cerrarse sin errores de runtime,
     * porque `refreshOverviewMetrics` ya no debe quedar referenciado antes de inicializarse.
     * RIESGO: Alto
     */
    test('CaseDetail abre y cierra multimedia sin pageerror de inicialización', async ({ browserName }, testInfo) => {
        void browserName;
        ({ electronApp, window } = await launchAndLogin({ prefix: 'case-detail-media' }));
        diagnostics = await createCaseTestDiagnostics({ window, testInfo });
        await diagnostics.init();

        const pageErrors = [];
        window.on('pageerror', (error) => {
            pageErrors.push(error.message);
        });

        await diagnostics.runStep('go-to-cases', async () => {
            await goToSection(window, 'cases', { timeout: 15000 });
        });

        const casesState = await diagnostics.runStep('wait-for-cases-table', async () => {
            return await waitForCaseTableState(window);
        });

        if (casesState.isEmpty) return;

        await diagnostics.runStep('open-first-case', async () => {
            await openFirstCase(window);
        });

        await diagnostics.runStep('open-documents-tab', async () => {
            await openCaseDocumentsTab(window);
        });

        await diagnostics.runStep('ensure-media-available', async () => {
            await ensureCaseMultimediaAvailable(window);
        });

        await diagnostics.runStep('open-media-viewer', async () => {
            const gallery = window.getByRole('heading', { name: 'Galería de Evidencia' }).locator('..').locator('..');
            const videoPreview = gallery.locator('media-player').first();
            const imagePreview = gallery.locator('img[alt]').first();
            const previewTarget = await videoPreview.count() > 0 ? videoPreview : imagePreview;
            await expect(previewTarget).toBeVisible({ timeout: 15000 });
            await previewTarget.click({ force: true });
            const mediaViewer = window.getByRole('dialog', { name: 'Visor multimedia' });
            await expect(mediaViewer).toBeVisible({ timeout: 10000 });
            await expect(window.getByRole('button', { name: 'Cerrar visor multimedia' })).toBeVisible({ timeout: 10000 });
            await expect(window.getByText('Archivo cargando')).toHaveCount(0);
            await expect(mediaViewer.locator('img, media-player').first()).toBeVisible({ timeout: 10000 });
        });

        await diagnostics.runStep('close-media-viewer', async () => {
            await window.getByRole('button', { name: 'Cerrar visor multimedia' }).click();
            await expect(window.getByRole('dialog', { name: 'Visor multimedia' })).toHaveCount(0);
        });

        expect(
            pageErrors,
            `Se registraron errores de runtime al abrir multimedia: ${pageErrors.join(' | ')}`,
        ).not.toContain("Cannot access 'refreshOverviewMetrics' before initialization");
    });
});
