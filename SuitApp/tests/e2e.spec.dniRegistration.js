import { test, expect } from '@playwright/test';
import { launchAndLogin, goToSectionFromSectionsPage } from './helpers/electronTestUtils.js';

test.describe('Restricción Numérica DNI/CUIT', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({ prefix: 'dni-test' }));
  }, 60000);

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('El campo DNI en Nuevo Cliente solo acepta números', async () => {
    await goToSectionFromSectionsPage(page, 'people');
    
    // Abrir modal de Nuevo Cliente
    await page.getByRole('button', { name: 'Nuevo Cliente' }).first().click();
    await expect(page.getByText('Nuevo Cliente', { exact: true })).toBeVisible();

    const dniInput = page.locator('input[name="identification_number"]');
    
    // Usar pressSequentially con un pequeño delay para asegurar que React procese cada tecla
    await dniInput.click();
    await dniInput.pressSequentially('123abc456', { delay: 50 });
    
    // Esperar a que el valor se estabilice
    await expect(dniInput).toHaveValue('123456');

    // Probar pegado (clipboard) - Usamos fill para simular pegado masivo
    await dniInput.clear();
    await dniInput.fill('99x88y77');
    await expect(dniInput).toHaveValue('998877');

    // Cerrar modal
    await page.getByRole('button', { name: 'X' }).or(page.getByRole('button', { name: 'Cerrar' })).first().click();
    await expect(page.getByText('Nuevo Cliente', { exact: true })).not.toBeVisible();
  });

  test('El campo DNI en Editar Cliente solo acepta números', async () => {
    await goToSectionFromSectionsPage(page, 'people');
    
    // Localizar una fila de cliente
    const clientRow = page.locator('tr').filter({ hasText: /@|—/ }).first();
    const rowCount = await clientRow.count();
    
    if (rowCount === 0) {
        test.skip(true, 'No hay clientes para probar la edición.');
        return;
    }

    await clientRow.click();
    
    // Esperar a que cargue el detalle y abrir Editar
    await page.getByRole('button', { name: 'Editar' }).first().click();
    await expect(page.getByText('Editar Cliente', { exact: true })).toBeVisible();

    const dniInput = page.locator('input[name="identification_number"]');
    
    await dniInput.clear();
    await dniInput.pressSequentially('987XYZ654', { delay: 50 });
    await expect(dniInput).toHaveValue('987654');

    await dniInput.clear();
    await dniInput.fill('78e90');
    await expect(dniInput).toHaveValue('7890');

    // Cancelar/Cerrar
    await page.getByRole('button', { name: 'X' }).or(page.getByText('Cerrar')).first().click();
  });
});
