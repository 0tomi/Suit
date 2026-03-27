import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { expect, test } from '@playwright/test';
import { goToSectionFromSectionsPage, launchAndLogin } from './helpers/electronTestUtils.js';

/**
 * Genera un sufijo único para no chocar con datos reales existentes en la API.
 */
function buildUniqueSuffix() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Filtra filas de la tabla de documentos por el texto visible del nombre.
 */
function getDocumentRow(page, name) {
  return page.locator('tbody tr').filter({ hasText: name }).first();
}

/**
 * Espera el toast de éxito, tolerando que desaparezca rápido en máquinas lentas o rápidas.
 */
async function expectSuccessToast(page, pattern) {
  await expect(page.getByText(pattern)).toBeVisible({ timeout: 20000 });
}

/**
 * Escapa texto arbitrario para reutilizarlo dentro de una RegExp.
 */
function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Crea un archivo temporal real para ejercitar la carga en Biblioteca sin mocks.
 */
async function createTempTextFile(filename, contents) {
  const filePath = path.join(os.tmpdir(), filename);
  await fs.writeFile(filePath, contents, 'utf8');
  return filePath;
}

test.describe('Documentos, Modelos y Biblioteca E2E', () => {
  test('debe completar ABM funcional de documentos desde el frontend', async () => {
    const { electronApp, window: page } = await launchAndLogin({
      prefix: 'docs-admin',
      credentials: {
        username: 'admin',
        password: 'adminadmin',
      },
    });
    const suffix = buildUniqueSuffix();
    const initialTitle = `E2E Documento ${suffix}`;
    const updatedTitle = `${initialTitle} Editado`;
    const marker = `Contenido E2E ${suffix}`;

    try {
      await goToSectionFromSectionsPage(page, 'documents');
      await expect(page.getByTestId('page-documents-title')).toBeVisible({ timeout: 15000 });

      await page.getByTestId('action-button-nuevo-documento').click();
      await expect(page.getByRole('button', { name: 'Propiedades' })).toBeVisible({ timeout: 15000 });

      await page.locator('input[placeholder="Sin Título"]').fill(initialTitle);
      await page.locator('.ProseMirror').first().click();
      await page.keyboard.insertText(marker);

      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByRole('heading', { name: 'Guardar Documento' })).toBeVisible({ timeout: 15000 });
      await page.getByTestId('modal-status-select').selectOption('Firmado');
      await page.getByRole('button', { name: 'Guardar documento' }).click();

      await expect(page.getByTestId('page-documents-title')).toBeVisible({ timeout: 20000 });
      const searchInput = page.getByPlaceholder('Buscar documentos...');
      await searchInput.fill(initialTitle);

      const createdRow = getDocumentRow(page, initialTitle);
      await expect(createdRow).toBeVisible({ timeout: 20000 });
      await expect(createdRow).toContainText('Firmado');

      await createdRow.locator('button[title="Configuración y Permisos"]').click();
      await expect(page.getByRole('heading', { name: 'Propiedades del Documento' })).toBeVisible({ timeout: 10000 });
      await page.locator('#document-settings-title').fill(updatedTitle);
      await page.locator('#document-settings-title').blur();
      await expectSuccessToast(page, 'Título actualizado');
      await page.getByTestId('modal-status-select').selectOption('Presentado');
      await expectSuccessToast(page, 'Estado actualizado');
      await page.getByRole('button', { name: 'Cerrar' }).click();

      await searchInput.fill(updatedTitle);
      const updatedRow = getDocumentRow(page, updatedTitle);
      await expect(updatedRow).toBeVisible({ timeout: 20000 });
      await expect(updatedRow).toContainText('Presentado');

      await updatedRow.locator('button[title="Editar Contenido"]').click();
      await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Editar' }).click();
      await expect(page.getByRole('button', { name: 'Editando' })).toBeVisible({ timeout: 10000 });
      await expect(page.locator('.ProseMirror').first()).toContainText(marker, { timeout: 15000 });

      await goToSectionFromSectionsPage(page, 'documents');
      await expect(page.getByTestId('page-documents-title')).toBeVisible({ timeout: 20000 });
      await searchInput.fill(updatedTitle);
      const rowToDelete = getDocumentRow(page, updatedTitle);
      await expect(rowToDelete).toBeVisible({ timeout: 20000 });
      await rowToDelete.locator('button[title="Configuración y Permisos"]').click();
      await expect(page.getByRole('heading', { name: 'Propiedades del Documento' })).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: /Eliminar documento/i }).click();
      await page.getByRole('button', { name: /sí, eliminar/i }).click();

      await expect(page.getByTestId('page-documents-title')).toBeVisible({ timeout: 20000 });
      await searchInput.fill(updatedTitle);
      await expect(page.locator('tbody tr').filter({ hasText: updatedTitle })).toHaveCount(0, { timeout: 20000 });
    } finally {
      await electronApp.close();
    }
  });

  test('debe usar una plantilla preexistente de la API para crear un documento', async () => {
    const { electronApp, window: page } = await launchAndLogin({
      prefix: 'templates-admin',
      credentials: {
        username: 'admin',
        password: 'adminadmin',
      },
    });
    const suffix = buildUniqueSuffix();
    const createdDocumentTitle = `E2E Plantilla API ${suffix}`;

    try {
      await goToSectionFromSectionsPage(page, 'templates');
      await expect(page.getByTestId('page-templates-title')).toBeVisible({ timeout: 15000 });

      const firstTemplateCard = page.locator('article').filter({
        has: page.locator('button[data-testid^="template-card-use-"]'),
      }).first();
      await expect(firstTemplateCard).toBeVisible({ timeout: 20000 });

      const templateTitle = ((await firstTemplateCard.locator('h3').textContent()) || '').trim();
      expect(templateTitle).not.toBe('');

      await firstTemplateCard.locator('button[data-testid^="template-card-use-"]').click();

      const useTemplateHeading = page.getByRole('heading', { name: new RegExp(`Usar: ${escapeRegExp(templateTitle)}`) });
      await expect(useTemplateHeading).toBeVisible({ timeout: 20000 });
      await page.getByRole('button', { name: /Cargar sin rellenar|Usar plantilla/i }).click();

      await page.waitForURL(/#?\/documents\/new/, { timeout: 20000 }).catch(() => {});
      await expect(page.locator('input[placeholder="Sin Título"]')).toBeVisible({ timeout: 15000 });
      await page.locator('input[placeholder="Sin Título"]').fill(createdDocumentTitle);
      await page.getByRole('button', { name: 'Guardar' }).click();
      await expect(page.getByRole('heading', { name: 'Guardar Documento' })).toBeVisible({ timeout: 15000 });
      await page.getByRole('button', { name: 'Guardar documento' }).click();

      await goToSectionFromSectionsPage(page, 'documents');
      const searchInput = page.getByPlaceholder('Buscar documentos...');
      await searchInput.fill(createdDocumentTitle);
      const createdRow = getDocumentRow(page, createdDocumentTitle);
      await expect(createdRow).toBeVisible({ timeout: 20000 });

      await createdRow.locator('button[title="Editar Contenido"]').click();
      await expect(page.locator('input[placeholder="Sin Título"]')).toHaveValue(createdDocumentTitle, { timeout: 15000 });
      await expect(page.locator('.ProseMirror').first()).not.toBeEmpty({ timeout: 15000 });

      await page.getByRole('button', { name: 'Propiedades' }).click();
      await page.getByRole('button', { name: /Eliminar documento/i }).click();
      await page.getByRole('button', { name: /sí, eliminar/i }).click();

      await expect(page.getByTestId('page-documents-title')).toBeVisible({ timeout: 20000 });
      await searchInput.fill(createdDocumentTitle);
      await expect(page.locator('tbody tr').filter({ hasText: createdDocumentTitle })).toHaveCount(0, { timeout: 20000 });
    } finally {
      await electronApp.close();
    }
  });

  test('debe completar ABM de biblioteca sin usar QR', async () => {
    const { electronApp, window: page } = await launchAndLogin({
      prefix: 'biblioteca-admin',
      credentials: {
        username: 'admin',
        password: 'adminadmin',
      },
    });
    const suffix = buildUniqueSuffix();
    const catalogName = `E2E Catalogo ${suffix}`;
    const fileName = `biblioteca-e2e-${suffix}.txt`;
    const renamedFileName = `biblioteca-e2e-renombrado-${suffix}.txt`;
    const filePath = await createTempTextFile(fileName, `archivo biblioteca ${suffix}`);

    try {
      await goToSectionFromSectionsPage(page, 'biblioteca');
      await expect(page.getByTestId('page-biblioteca-title')).toBeVisible({ timeout: 15000 });

      await page.getByRole('button', { name: 'Nuevo Catálogo' }).click();
      await expect(page.getByRole('heading', { name: 'Crear Catálogo' })).toBeVisible({ timeout: 10000 });
      await page.locator('#catalog-name').fill(catalogName);
      await page.locator('#catalog-desc').fill(`Catálogo E2E ${suffix}`);
      await page.getByRole('button', { name: 'Crear' }).click();
      await expectSuccessToast(page, 'Catálogo creado');

      await page.getByRole('button', { name: 'Subir Archivo' }).click();
      await expect(page.getByRole('heading', { name: 'Subir Archivo' })).toBeVisible({ timeout: 10000 });
      await page.locator('input[type="file"]').setInputFiles(filePath);
      await expect(page.getByText(fileName)).toBeVisible({ timeout: 10000 });
      await page.getByRole('button', { name: 'Subir', exact: true }).click();
      await expectSuccessToast(page, 'Archivo subido correctamente');

      const fileSearchInput = page.getByPlaceholder('Buscar archivos por nombre...');
      await fileSearchInput.fill(fileName);
      const fileCard = page.locator('article').filter({ hasText: fileName }).first();
      await expect(fileCard).toBeVisible({ timeout: 20000 });

      await fileCard.locator('button[title="Información / Editar"]').click();
      await expect(page.getByRole('heading', { name: 'Información del Archivo' })).toBeVisible({ timeout: 10000 });
      await page.locator('#info-name').fill(renamedFileName);
      const targetCatalogValue = await page.locator('#info-catalog option').evaluateAll((options) => {
        const selectable = options.find((option) => option.value);
        return selectable?.value || '';
      });
      if (targetCatalogValue) {
        await page.locator('#info-catalog').selectOption(targetCatalogValue);
      }
      await page.getByRole('button', { name: 'Guardar Cambios' }).click();
      await expectSuccessToast(page, 'Archivo actualizado');

      await fileSearchInput.fill(renamedFileName);
      const renamedCard = page.locator('article').filter({ hasText: renamedFileName }).first();
      await expect(renamedCard).toBeVisible({ timeout: 20000 });

      await renamedCard.locator('button[title="Información / Editar"]').click();
      await page.getByRole('button', { name: 'Eliminar' }).click();
      await page.getByRole('button', { name: /sí, eliminar/i }).click();
      await expectSuccessToast(page, 'Archivo eliminado');

      await fileSearchInput.fill(renamedFileName);
      await expect(page.locator('article').filter({ hasText: renamedFileName })).toHaveCount(0, { timeout: 20000 });
    } finally {
      await electronApp.close();
    }
  });
});
