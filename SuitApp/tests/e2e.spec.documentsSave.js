/**
 * Feature: Guardado manual de contenido en el editor de documentos
 * Hipótesis cubiertas:
 * - H1: si un admin abre el primer documento visible, entra en edición y guarda, el backend persiste el nuevo contenido.
 * - H2: si se elimina la copia local en SQLite y se reabre el documento, el contenido vuelve desde la API con el cambio aplicado.
 *
 * CONTEXTO:
 * - El flujo depende de Electron, login real, navegación por secciones, lock del documento y persistencia remota.
 * - Se usa un único Electron por spec para evitar timeouts de arranque.
 *
 * PUNTOS CRÍTICOS IDENTIFICADOS:
 * - El primer documento visible puede quedar bloqueado y el flujo debe fallar con evidencia útil.
 * - El editor TipTap debouncea cambios, por lo que el test fuerza la selección al final antes de insertar el marcador.
 * - La caché SQLite podría enmascarar un falso positivo; por eso se borra la fila local antes de reabrir.
 */

import { expect, test } from '@playwright/test';
import { createE2ETestDiagnostics } from './helpers/e2eDiagnostics.js';
import { goToSectionFromSectionsPage, launchElectronApp } from './helpers/electronTestUtils.js';

function buildUniqueMarker() {
  return `E2E-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

async function getFirstDocumentRow(page) {
  await expect
    .poll(async () => page.locator('tbody tr').filter({ has: page.locator('button[title="Editar Contenido"]') }).count(), {
      timeout: 20000,
      message: 'No apareció ninguna fila de documento editable en la tabla de documentos.',
    })
    .toBeGreaterThan(0);

  return page.locator('tbody tr').filter({ has: page.locator('button[title="Editar Contenido"]') }).first();
}

async function openDocumentEditorFromRow(page, row) {
  await row.locator('button[title="Editar Contenido"]').click();
  await expect(page.getByRole('button', { name: 'Guardar' })).toBeVisible({ timeout: 15000 });
}

async function appendMarkerToEditor(page, marker) {
  const editor = page.locator('.ProseMirror').first();
  await expect(editor).toBeVisible({ timeout: 15000 });

  await editor.evaluate((node) => {
    const selection = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(node);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
    /** @type {HTMLElement} */ (node).focus();
  });

  await page.keyboard.insertText(` ${marker}`);
}

async function loginAsAdmin(page, { timeout = 120000 } = {}) {
  const setupLocator = page.getByTestId('server-setup-modal');
  const loginLocator = page.getByTestId('login-submit');
  const shellLocator = page.getByTestId('sidebar-nav-sections-manager');

  await Promise.race([
    setupLocator.waitFor({ timeout: 30000 }).catch(() => {}),
    loginLocator.waitFor({ timeout: 30000 }).catch(() => {}),
    shellLocator.waitFor({ timeout: 30000 }).catch(() => {}),
  ]);

  if (await setupLocator.isVisible().catch(() => false)) {
    const localhostButton = page.getByTestId('server-setup-localhost');
    const acceptButton = page.getByTestId('server-setup-accept');

    await localhostButton.click();
    await acceptButton.waitFor({ state: 'visible', timeout: 5000 });
    await expect(acceptButton).toBeEnabled({ timeout: 5000 });
    await acceptButton.click();
  }

  if (await loginLocator.isVisible().catch(() => false)) {
    await page.getByTestId('login-username').fill('admin');
    await page.getByTestId('login-password').fill('adminadmin');
    await loginLocator.click();
  }

  await expect(shellLocator).toBeVisible({ timeout });
}

test.describe.configure({ mode: 'serial' });

test.describe('Documentos E2E — Guardado de contenido', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchElectronApp({
      prefix: 'documents-save-admin',
    }));
    await loginAsAdmin(page);
  }, 120000);

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('debe guardar cambios de contenido y recuperarlos al reabrir desde la API', async (_fixtures, testInfo) => {
    const diagnostics = createE2ETestDiagnostics({
      window: page,
      testInfo,
      featureTag: 'documents-save',
      dbTables: ['documents'],
    });
    const marker = buildUniqueMarker();
    let documentTitle = '';
    let documentId = '';

    await diagnostics.init();

    try {
      await diagnostics.runStep('go-to-documents', async () => {
        await goToSectionFromSectionsPage(page, 'documents');
        await expect(page.getByTestId('page-documents-title')).toBeVisible({ timeout: 15000 });
      });

      await diagnostics.runStep('open-first-document', async () => {
        const firstRow = await getFirstDocumentRow(page);
        documentTitle = ((await firstRow.locator('td').first().locator('button').textContent()) || '').trim();
        expect(documentTitle, 'La primera fila de documentos no tiene título visible.').not.toBe('');

        await openDocumentEditorFromRow(page, firstRow);
        await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 15000 });
        documentId = page.url().split('/documents/edit/')[1]?.split('?')[0] || '';
        expect(documentId, `No se pudo resolver el id del documento desde la URL ${page.url()}.`).not.toBe('');
      });

      await diagnostics.runStep('edit-and-save', async () => {
        const editButton = page.getByRole('button', { name: 'Editar' });
        await editButton.click();
        await expect(page.getByRole('button', { name: 'Editando' })).toBeVisible({ timeout: 10000 });

        await appendMarkerToEditor(page, marker);
        await page.getByRole('button', { name: 'Guardar' }).click();

        await expect(page.getByText('Documento guardado correctamente.')).toBeVisible({ timeout: 20000 });
        await expect(page.getByRole('button', { name: 'Editar' })).toBeVisible({ timeout: 15000 });
      });

      await diagnostics.runStep('return-and-drop-local-cache', async () => {
        await page.getByRole('button', { name: 'Volver' }).click();
        await expect(page.getByTestId('page-documents-title')).toBeVisible({ timeout: 15000 });

        await page.evaluate(async (docId) => {
          await window.electronAPI?.db?.deleteById?.('documents', Number(docId));
        }, documentId);
      });

      await diagnostics.runStep('reopen-and-verify', async () => {
        const matchingRow = page.locator('tbody tr').filter({ hasText: documentTitle }).first();
        await expect(matchingRow).toBeVisible({ timeout: 15000 });
        await openDocumentEditorFromRow(page, matchingRow);

        const editor = page.locator('.ProseMirror').first();
        await expect(editor).toContainText(marker, { timeout: 20000 });
      });
    } finally {
      await diagnostics.finalize();
    }
  });
});
