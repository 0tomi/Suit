import { test, expect } from '@playwright/test';
import { launchAndLogin } from './helpers/electronTestUtils.js';

test.describe('Drafting Tools Toolbar', () => {
    let electronApp;
    let window;

    test.beforeAll(async () => {
        const launched = await launchAndLogin({ prefix: 'drafting-tools-test' });
        electronApp = launched.electronApp;
        window = launched.window;
    });

    test.afterAll(async () => {
        await electronApp.close();
    });

    test('should show case tools when document is linked to a case', async () => {
        const caseId = 999;
        const docId = 888;

        // Seed case and document
        await window.evaluate(async ({ caseId, docId }) => {
            await window.electronAPI.db.upsertMany('cases', [{
                id: caseId,
                title: 'Caso de Prueba para Toolbar',
                details: 'Detalles del caso de prueba',
                status: 'Abierto'
            }]);
            
            await window.electronAPI.db.upsertMany('documents', [{
                id: docId,
                name: 'Documento con Caso',
                content: '<p>Contenido del documento</p>',
                suit_case_id: caseId,
                status: 'Borrador',
                updated_at: new Date().toISOString()
            }]);
        }, { caseId, docId });

        // Navigate to document editor
        await window.goto(`http://localhost:5173/#/documents/edit/${docId}`);
        
        // Check sidebar is visible and showing case context
        const sidebar = window.locator('h3:has-text("Herramientas para redacción")');
        await expect(sidebar).toBeVisible();
        
        const contextLabel = window.locator('span:has-text("Contexto del Caso #999")');
        await expect(contextLabel).toBeVisible();

        // Check if CaseTools categories are visible
        await expect(window.locator('span:has-text("Documentos")')).toBeVisible();
        await expect(window.locator('span:has-text("Personas")')).toBeVisible();
    });

    test('should show general tools when document has no case linked', async () => {
        const docId = 777;

        // Seed document without case
        await window.evaluate(async ({ docId }) => {
            await window.electronAPI.db.upsertMany('documents', [{
                id: docId,
                name: 'Documento General',
                content: '<p>Contenido general</p>',
                suit_case_id: null,
                status: 'Borrador',
                updated_at: new Date().toISOString()
            }]);
        }, { docId });

        // Navigate to document editor
        await window.goto(`http://localhost:5173/#/documents/edit/${docId}`);
        
        // Check sidebar is showing general context
        const contextLabel = window.locator('span:has-text("Sin caso vinculado")');
        await expect(contextLabel).toBeVisible();

        // Check if Search input is visible (GeneralTools)
        const searchInput = window.locator('input[placeholder="Buscar datos..."]');
        await expect(searchInput).toBeVisible();
    });

    test('should allow collapsing and expanding the sidebar', async () => {
        // Assume we are already in an editor from previous test
        const collapseBtn = window.locator('button >> svg.lucide-chevron-right').first();
        await collapseBtn.click();

        // Expanded sidebar should be gone (or header should be gone)
        await expect(window.locator('h3:has-text("Herramientas para redacción")')).not.toBeVisible();

        // Expand button should be visible
        const expandBtn = window.locator('button[title="Herramientas para redacción"]');
        await expect(expandBtn).toBeVisible();

        await expandBtn.click();
        await expect(window.locator('h3:has-text("Herramientas para redacción")')).toBeVisible();
    });
});
