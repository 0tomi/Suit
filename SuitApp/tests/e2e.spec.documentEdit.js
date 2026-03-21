import { test, expect } from '@playwright/test';
import { launchAndLogin, goToSection, ensureSectionPinned } from './helpers/electronTestUtils.js';

/**
 * Evita falsos negativos cuando el entorno no tiene documentos sembrados.
 * El flujo de edición/propiedades solo es válido si la tabla ya contiene al menos un documento.
 */
async function skipIfNoDocuments(window) {
    const rows = window.locator('table tbody tr');
    const emptyState = window.getByText('No se encontraron documentos.');

    await Promise.race([
        rows.first().waitFor({ state: 'visible', timeout: 15000 }).catch(() => { }),
        emptyState.waitFor({ state: 'visible', timeout: 15000 }).catch(() => { }),
    ]);

    if (await emptyState.isVisible().catch(() => false)) {
        test.skip(true, [
            'Sin documentos en la API o en la caché local.',
            'Este spec valida edición y propiedades sobre un documento existente.',
            'Fix: sembrar al menos un documento antes de correrlo.',
        ].join(' '));
        return true;
    }

    return false;
}

test.describe('Edición de documentos', () => {

    test('Guardar documento existente no muestra error de validación', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            // Navegar a la sección de Documentos
            await ensureSectionPinned(window, 'documents');
            await goToSection(window, 'documents');

            if (await skipIfNoDocuments(window)) {
                return;
            }

            // Click en el primer documento (click en el nombre/link)
            const firstDocName = window.locator('table tbody tr:first-child button').first();
            await firstDocName.click();

            // Esperar que cargue el editor (al principio es readonly)
            await window.waitForSelector('.ProseMirror', { timeout: 15000 });

            // Hacer click en Editar para habilitar la edición
            await window.click('button:has-text("Editar")');

            // Esperar a que el editor se vuelva editable tras obtener el lock
            await window.waitForSelector('.ProseMirror[contenteditable="true"]', { timeout: 15000 });

            // Hacer una edición mínima en el editor para que el contenido cambie
            const editor = window.locator('.ProseMirror, [contenteditable="true"]').first();
            await editor.click();
            await editor.press('End');
            await editor.type(' '); // Agrega un espacio — cambio mínimo

            // Guardar
            await window.click('text=Guardar');

            // Verificar que NO aparece el error "file field is required"
            await expect(window.locator('text=The file field is required')).not.toBeVisible({ timeout: 5000 });

            // Verificar que aparece el mensaje de éxito
            await expect(window.locator('text=Documento guardado correctamente')).toBeVisible({ timeout: 15000 });

        } finally {
            await electronApp.close();
        }
    });

    test('Modal de propiedades muestra datos del documento', async () => {
        const { electronApp, window } = await launchAndLogin();

        try {
            // Navegar a Documentos
            await ensureSectionPinned(window, 'documents');
            await goToSection(window, 'documents');

            if (await skipIfNoDocuments(window)) {
                return;
            }

            // Click en el ícono de configuración (Settings) del primer documento
            const settingsBtn = window.locator('table tbody tr:first-child button[title="Configuración y Permisos"]');
            await settingsBtn.click();

            // Verificar que el modal abre
            await expect(window.locator('text=Propiedades del Documento')).toBeVisible({ timeout: 5000 });

            // Verificar que se muestra el nombre del documento (no vacío)
            const nombreRow = window.locator('text=Nombre').locator('..').locator('span').last();
            await expect(nombreRow).not.toHaveText('—');

            // Verificar que la versión actual no es vacía (puede ser v1, v2, etc.)
            await expect(window.locator('text=/^v\\d+$/')).toBeVisible({ timeout: 5000 });

        } finally {
            await electronApp.close();
        }
    });
});
