import { expect, test } from '@playwright/test';
import { launchElectronApp } from './helpers/electronTestUtils.js';

const SEEDED_DOCUMENT_ID = 910001;

async function launchOfflineEditorApp(prefix) {
    const launched = await launchElectronApp({ prefix });
    const { window } = launched;
    window.on('dialog', async (dialog) => {
        try {
            await dialog.dismiss();
        } catch {
            // Algunos flujos del shell pueden emitir un dialog fantasma durante
            // la navegación del test; si ya no existe, no bloqueamos la suite.
        }
    });

    await window.evaluate(async ({ seededDocumentId }) => {
        const electronAPI = window.electronAPI;
        if (!electronAPI?.config?.set || !electronAPI?.db?.upsertMany) {
            throw new Error('Electron API no disponible para preparar el entorno del test.');
        }

        const now = new Date().toISOString();
        const offlineUser = {
            id: 1,
            name: 'Usuario Test',
            tag: 'test',
            role: 'user',
        };

        await electronAPI.profiles?.activateRemoteUser?.(offlineUser);
        await electronAPI.config.set('auth_user', JSON.stringify(offlineUser));
        await electronAPI.config.delete?.('auth_token');

        await electronAPI.db.upsertMany('documents', [{
            id: seededDocumentId,
            name: 'Documento E2E Toolbar',
            user_id: offlineUser.id,
            content: '<p>Documento base para el toolbar</p>',
            is_locked: 0,
            locked_by: null,
            locker_name: null,
            created_at: now,
            updated_at: now,
            latest_version_number: 1,
            latest_version_created_by: offlineUser.id,
            latest_version_creator_name: offlineUser.name,
            latest_version_creator_tag: offlineUser.tag,
            data_json: JSON.stringify({
                id: seededDocumentId,
                name: 'Documento E2E Toolbar',
                user_id: offlineUser.id,
                updated_at: now,
                latest_version_number: 1,
            }),
            synced_at: now,
        }]);
    }, { seededDocumentId: SEEDED_DOCUMENT_ID });
    await window.reload();
    await window.waitForLoadState('domcontentloaded');

    await resolveServerSetupModal(window);

    return launched;
}

async function resolveServerSetupModal(window) {
    const setupModal = window.getByTestId('server-setup-modal');
    if (!await setupModal.isVisible().catch(() => false)) {
        return;
    }

    const localhostButton = window.getByTestId('server-setup-localhost');
    const acceptButton = window.getByTestId('server-setup-accept');

    await localhostButton.click();
    await expect(acceptButton).toBeEnabled({ timeout: 10000 });
    await acceptButton.click();
    await setupModal.waitFor({ state: 'hidden', timeout: 10000 }).catch(() => { });
}

async function navigateToEditorRoute(window, path) {
    await window.evaluate((nextPath) => {
        window.history.pushState({}, '', nextPath);
        window.dispatchEvent(new PopStateEvent('popstate'));
    }, path);
    await resolveServerSetupModal(window);
}

async function openFirstDocumentReadOnly(window) {
    await navigateToEditorRoute(window, `/documents/edit/${SEEDED_DOCUMENT_ID}`);
    await window.waitForSelector('.ProseMirror', { timeout: 15000 });
    await expect(window.locator('.ProseMirror')).toHaveAttribute('contenteditable', 'false');
}

async function openNewDocumentForEditing(window) {
    await navigateToEditorRoute(window, '/documents/new');
    await window.waitForSelector('.ProseMirror[contenteditable="true"]', { timeout: 15000 });
}

async function replaceEditorContent(window, text) {
    const editor = window.locator('.ProseMirror').first();
    await editor.click();
    await editor.press('Control+a');
    await editor.type(text);
    return editor;
}

async function getFirstParagraphIndent(window) {
    return await window.evaluate(() => {
        const paragraph = document.querySelector('.ProseMirror p');
        if (!paragraph) return { indent: null, style: '' };

        return {
            indent: paragraph.getAttribute('data-indent'),
            style: paragraph.getAttribute('style') || '',
        };
    });
}

test.describe('Editor toolbar', () => {
    test('renderiza dos filas y deshabilita controles mutantes en read-only', async () => {
        test.setTimeout(90_000);
        const { electronApp, window } = await launchOfflineEditorApp('editor-toolbar-readonly');

        try {
            await openFirstDocumentReadOnly(window);

            await expect(window.getByTestId('editor-toolbar-row-primary')).toBeVisible();
            await expect(window.getByTestId('editor-toolbar-row-secondary')).toBeVisible();

            await expect(window.locator('[aria-label="Negrita"]')).toBeDisabled();
            await expect(window.locator('[aria-label="Aumentar sangría"]')).toBeDisabled();
            await expect(window.locator('[aria-label="Insertar Tabla"]')).toBeDisabled();
            await expect(window.locator('[aria-label="Buscar y reemplazar"]')).toBeEnabled();
            await expect(window.locator('[aria-label="Atajos de teclado"]')).toBeEnabled();

            await window.locator('[aria-label="Buscar y reemplazar"]').click();
            await expect(window.getByTestId('editor-find-replace-panel')).toBeVisible({ timeout: 5000 });
        } finally {
            await electronApp.close();
        }
    });

    test('abre el modal de atajos con el contenido esperado', async () => {
        test.setTimeout(90_000);
        const { electronApp, window } = await launchOfflineEditorApp('editor-toolbar-shortcuts');

        try {
            await openFirstDocumentReadOnly(window);

            await window.locator('[aria-label="Atajos de teclado"]').click();

            const shortcutsModal = window.getByTestId('editor-shortcuts-modal');
            await expect(shortcutsModal).toBeVisible({ timeout: 5000 });
            await expect(shortcutsModal.getByText('Buscar en el documento')).toBeVisible();
            await expect(shortcutsModal.getByText('Aumentar sangria del bloque actual')).toBeVisible();
            await expect(shortcutsModal.getByText('Solo edicion').first()).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    test('aplica y revierte sangría desde los botones del toolbar', async () => {
        test.setTimeout(90_000);
        const { electronApp, window } = await launchOfflineEditorApp('editor-toolbar-indent-buttons');

        try {
            await openNewDocumentForEditing(window);
            await replaceEditorContent(window, 'Bloque con sangria');

            await window.locator('[aria-label="Aumentar sangría"]').click();
            await expect.poll(async () => getFirstParagraphIndent(window)).toEqual({
                indent: '1',
                style: 'margin-left: 2rem',
            });

            await window.locator('[aria-label="Reducir sangría"]').click();
            await expect.poll(async () => getFirstParagraphIndent(window)).toEqual({
                indent: null,
                style: '',
            });
        } finally {
            await electronApp.close();
        }
    });

    test('aplica y revierte sangría con Tab y Shift+Tab', async () => {
        test.setTimeout(90_000);
        const { electronApp, window } = await launchOfflineEditorApp('editor-toolbar-indent-keyboard');

        try {
            await openNewDocumentForEditing(window);

            const editor = await replaceEditorContent(window, 'Indentacion por teclado');
            await editor.click();

            await editor.press('Tab');
            await expect.poll(async () => getFirstParagraphIndent(window)).toEqual({
                indent: '1',
                style: 'margin-left: 2rem',
            });

            await editor.press('Shift+Tab');
            await expect.poll(async () => getFirstParagraphIndent(window)).toEqual({
                indent: null,
                style: '',
            });
        } finally {
            await electronApp.close();
        }
    });
});
