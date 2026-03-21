import { test, expect } from '@playwright/test';
import path from 'path';
import { fileURLToPath } from 'url';
import { goToSection, launchAndLogin, ensureSectionPinned } from './helpers/electronTestUtils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

test.describe('Clients and Documents Features', () => {

    test('Client Creation and Document Filter', async () => {
        const { electronApp, window } = await launchAndLogin();
        const testClientName = `TestClient_${Date.now()}`;
        const uniqueIdentification = String(Date.now()).slice(-8);
        const uniqueEmail = `test_${Date.now()}@example.com`;

        try {
            window.on('console', msg => console.log('PAGE LOG:', msg.text()));
            // 1. Ir a la vista Personas y crear un cliente
            await ensureSectionPinned(window, 'people');
            await goToSection(window, 'people');

            await window.click('button:has-text("Nuevo Cliente")');

            // Llenar el formulario de cliente
            await window.fill('input[name="first_name"]', testClientName);
            await window.fill('input[name="last_name"]', 'User');
            await window.fill('input[name="identification_number"]', uniqueIdentification);
            await window.fill('input[name="email"]', uniqueEmail);

            await window.click('button:has-text("Crear Cliente")');

            // Validar que se creó exitosamente (el modal se cerró)
            await window.waitForSelector('h2:text("Nuevo Cliente")', { state: 'hidden', timeout: 10000 });

            // 2. Verificar que aparezca en la tabla de clientes
            await window.fill('input[placeholder="Buscar por nombre, DNI o email..."]', testClientName);
            await expect(window.locator('table tbody').getByText(testClientName).first()).toBeVisible({ timeout: 10000 });

            // 3. Ir a Documentos y probar el filtro de clientes
            await ensureSectionPinned(window, 'documents');
            await goToSection(window, 'documents');

            // Verificar la nueva UI de filtros: botón de casos + autosuggest de clientes.
            const caseFilterTrigger = window.getByRole('button', { name: 'Filtro por caso' });
            await expect(caseFilterTrigger).toBeVisible();

            const clientFilterInput = window.getByRole('textbox', { name: 'Clientes' });
            await expect(clientFilterInput).toBeVisible();
            await clientFilterInput.fill(testClientName);

            await window.screenshot({ path: path.join(__dirname, 'clientCreationResult.png') });

        } catch (e) {
            await window.screenshot({ path: path.join(__dirname, 'clients_documents_error.png') });
            throw e;
        } finally {
            await electronApp.close();
        }
    });

});
