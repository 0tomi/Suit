/**
 * Feature: Personas, Categorías y Panel de administración
 * Hipótesis cubiertas:
 * - H1: si un admin crea, edita y elimina un cliente, la UI refleja cada cambio sin mocks.
 * - H2: si un admin modifica catálogos inline y modales en Categorías, la grilla refleja ABM real.
 * - H3: si un admin consulta la bitácora y edita un usuario existente, el panel mantiene consistencia y el usuario puede restaurarse.
 *
 * CONTEXTO:
 * - Los flujos dependen de Electron, navegación por Secciones, sync real y formularios con datos remotos.
 * - Se reutiliza una sola sesión de Electron para amortizar el costo de arranque y dejar trazas reales en bitácora.
 *
 * PUNTOS CRÍTICOS IDENTIFICADOS:
 * - Personas mezcla tablas navegables y modales; un falso positivo de caché local puede ocultar una regresión.
 * - Categorías combina CRUD inline y CRUD modal, con confirmaciones distintas según catálogo.
 * - Administración no debe dejar usuarios alterados después del test.
 */

import { expect, test } from '@playwright/test';
import {
  goToSectionFromSectionsPage,
  launchAndLogin,
  selectDropdownOption,
} from './helpers/electronTestUtils.js';

function buildUniqueLabel(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

async function openPeopleClients(page) {
  await goToSectionFromSectionsPage(page, 'people');
  await waitForPeoplePageReady(page);
  await page.locator('#people-tab-clients').click();
  await expect(page.getByTestId('page-clients-title')).toBeVisible({ timeout: 10000 });
}

async function searchPeopleRow(page, searchText) {
  const searchInput = page.getByPlaceholder('Buscar por nombre, DNI o email...');
  await expect(searchInput).toBeVisible({ timeout: 10000 });
  await searchInput.fill(searchText);
  const row = page.locator('tbody tr').filter({ hasText: searchText }).first();
  await expect(row).toBeVisible({ timeout: 15000 });
  return { searchInput, row };
}

async function clearPeopleSearch(page) {
  const searchInput = page.getByPlaceholder('Buscar por nombre, DNI o email...');
  await searchInput.fill('');
}

async function createJurisdiccion(page, name) {
  await page.getByRole('button', { name: 'Nueva Jurisdicción' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva Jurisdicción' })).toBeVisible({ timeout: 10000 });
  await page.getByPlaceholder('Ej: Paraná, Concordia, Federal...').fill(name);
  await page.getByRole('button', { name: 'Crear Jurisdicción' }).click();
  await expect(page.getByRole('heading', { name: 'Nueva Jurisdicción' })).toBeHidden({ timeout: 10000 });
  await expect(page.getByText('Jurisdicción creada')).toBeVisible({ timeout: 10000 });
}

async function closeModalWithEscape(page, title) {
  await expect(page.getByRole('heading', { name: title })).toBeVisible({ timeout: 10000 });
  await page.keyboard.press('Escape');
  await expect(page.getByRole('heading', { name: title })).toBeHidden({ timeout: 10000 });
}

async function findAdminUserRow(page, preferredTags = ['user', 'test']) {
  const rows = getAdminUsersTable(page).locator('tbody tr');
  const rowCount = await rows.count();

  for (const tag of preferredTags) {
    for (let index = 0; index < rowCount; index += 1) {
      const row = rows.nth(index);
      const rowText = ((await row.textContent().catch(() => '')) || '').trim().toLowerCase();
      if (rowText.includes(tag) && await row.isVisible().catch(() => false)) {
        return { tag, row };
      }
    }
  }

  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index);
    const tagCell = ((await row.locator('td').nth(0).textContent().catch(() => '')) || '').trim();
    if (tagCell && tagCell !== 'admin' && await row.isVisible().catch(() => false)) {
      return { tag: tagCell, row };
    }
  }

  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index);
    const tagCell = ((await row.locator('td').nth(0).textContent().catch(() => '')) || '').trim();
    if (tagCell && await row.isVisible().catch(() => false)) {
      return { tag: tagCell, row };
    }
  }

  const fallbackRow = rows.first();
  await expect(fallbackRow).toBeVisible({ timeout: 10000 });
  const fallbackTag = ((await fallbackRow.locator('td').nth(0).textContent()) || '').trim();
  return { tag: fallbackTag, row: fallbackRow };
}

async function waitForPeoplePageReady(page) {
  await expect(page.getByTestId('page-people-title')).toBeVisible({ timeout: 15000 });
}

async function waitForCategoriesPageReady(page) {
  await expect(page.getByTestId('page-categorias-title')).toBeVisible({ timeout: 15000 });
}

async function waitForAdminPageReady(page) {
  await expect(page.getByTestId('page-admin-title')).toBeVisible({ timeout: 15000 });
}

async function returnToListingFromClientDetail(page) {
  await page.goBack();
  await waitForPeoplePageReady(page);
  await expect(page.getByTestId('page-clients-title')).toBeVisible({ timeout: 10000 });
}

async function openJurisdiccionesCatalog(page) {
  await goToSectionFromSectionsPage(page, 'categorias');
  await waitForCategoriesPageReady(page);
  await page.getByTestId('categories-group-casos').click();
  await page.getByTestId('categories-catalog-jurisdicciones').click();
  await expect(page.getByRole('heading', { name: 'Jurisdicciones' }).last()).toBeVisible({ timeout: 10000 });
  await expect(page.getByRole('button', { name: 'Nueva Jurisdicción' })).toBeVisible({ timeout: 10000 });
}

async function waitForJurisdiccionInCatalog(page, jurisdiccionName) {
  await expect
    .poll(async () => {
      await openJurisdiccionesCatalog(page);
      const searchInput = page.getByPlaceholder('Buscar jurisdicción...');
      await searchInput.fill(jurisdiccionName);
      return await page.locator('div').filter({ hasText: jurisdiccionName }).count();
    }, {
      timeout: 30000,
      message: `La jurisdicción "${jurisdiccionName}" no apareció en el catálogo luego de reabrir la sección.`,
    })
    .toBeGreaterThan(0);

  const searchInput = page.getByPlaceholder('Buscar jurisdicción...');
  await searchInput.fill(jurisdiccionName);
  return page.locator('div').filter({ hasText: jurisdiccionName }).first();
}

async function openRolesCatalog(page) {
  await goToSectionFromSectionsPage(page, 'categorias');
  await waitForCategoriesPageReady(page);
  await page.getByTestId('categories-group-casos').click();
  await page.getByTestId('categories-catalog-roles').click();
  await expect(page.getByTestId('categories-section-roles')).toBeVisible({ timeout: 10000 });
}

function getRolesSection(page) {
  return page.getByTestId('categories-section-roles');
}

async function waitForRoleInCatalog(page, roleName) {
  await expect
    .poll(async () => {
      await openRolesCatalog(page);
      const roleSearch = page.getByTestId('categories-search-roles');
      await roleSearch.fill(roleName);
      return await getRolesSection(page).locator('tbody tr').filter({ hasText: roleName }).count();
    }, {
      timeout: 30000,
      message: `El rol "${roleName}" no apareció en el catálogo luego de reabrir la sección.`,
    })
    .toBe(1);

  return getRolesSection(page).locator('tbody tr').filter({ hasText: roleName }).first();
}

async function openAdminUsersTab(page) {
  await goToSectionFromSectionsPage(page, 'admin');
  await waitForAdminPageReady(page);
  await page.locator('#admin-tab-users').click();
  await expect(page.getByText('Gestión de Usuarios')).toBeVisible({ timeout: 10000 });
}

async function openAdminBitacoraTab(page) {
  await goToSectionFromSectionsPage(page, 'admin');
  await waitForAdminPageReady(page);
  await page.locator('#admin-tab-bitacora').click();
  await expect(page.getByRole('heading', { name: 'Bitácora administrativa' })).toBeVisible({ timeout: 15000 });
}

function getAdminUsersTable(page) {
  return page.locator('table').filter({ has: page.getByRole('columnheader', { name: 'Tag' }) }).first();
}

async function getAdminUserRowByTag(page, tag) {
  const rows = getAdminUsersTable(page).locator('tbody tr');
  const rowCount = await rows.count();

  for (let index = 0; index < rowCount; index += 1) {
    const row = rows.nth(index);
    const tagCell = ((await row.locator('td').nth(0).textContent().catch(() => '')) || '').trim();
    if (tagCell === tag && await row.isVisible().catch(() => false)) {
      return row;
    }
  }

  throw new Error(`No se encontró una fila visible para el usuario "${tag}" en la tabla de usuarios.`);
}

test.describe('Personas, Categorías y Admin E2E', () => {
  let electronApp;
  let page;

  test.beforeAll(async () => {
    ({ electronApp, window: page } = await launchAndLogin({
      prefix: 'people-categories-admin',
      credentials: {
        username: 'admin',
        password: 'adminadmin',
      },
    }));
  }, 120000);

  test.afterAll(async () => {
    await electronApp?.close();
  });

  test('personas > cliente nuevo > puede editarse y eliminarse reflejando cambios', async () => {
    const unique = Date.now();
    const originalFirstName = `E2E${unique}`;
    const editedFirstName = `${originalFirstName}Editado`;
    const lastName = 'ClienteAdmin';
    const email = `e2e.people.${unique}@example.com`;
    const updatedPhone = `351${String(unique).slice(-7)}`;

    await openPeopleClients(page);

    await page.getByRole('button', { name: /nuevo cliente/i }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeVisible({ timeout: 10000 });

    await page.locator('input[name="first_name"]').fill(originalFirstName);
    await page.locator('input[name="last_name"]').fill(lastName);
    await page.locator('input[name="email"]').fill(email);
    await page.locator('input[name="identification_number"]').fill(String(unique).slice(-8));
    await selectDropdownOption(page, page.getByRole('combobox', { name: /género/i }).last(), 'Masculino');
    await page.getByRole('button', { name: /crear cliente/i }).click();
    await expect(page.getByRole('heading', { name: 'Nuevo Cliente' })).toBeHidden({ timeout: 15000 });

    const { searchInput, row } = await searchPeopleRow(page, originalFirstName);
    await expect(row).toContainText(`${originalFirstName} ${lastName}`);
    await expect(row).toContainText(email);

    await row.click();
    await expect(page.getByRole('heading', { name: `${originalFirstName} ${lastName}` })).toBeVisible({ timeout: 15000 });

    await page.getByRole('button', { name: 'Editar Perfil' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Cliente' })).toBeVisible({ timeout: 10000 });
    await page.locator('input[name="first_name"]').fill(editedFirstName);
    await page.locator('input[name="phone"]').fill(updatedPhone);
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await expect(page.getByRole('heading', { name: 'Editar Cliente' })).toBeHidden({ timeout: 15000 });

    await expect(page.getByRole('heading', { name: `${editedFirstName} ${lastName}` })).toBeVisible({ timeout: 15000 });
    await expect(page.getByText(updatedPhone)).toBeVisible({ timeout: 10000 });

    await returnToListingFromClientDetail(page);

    await searchInput.fill(editedFirstName);
    const editedRow = page.locator('tbody tr').filter({ hasText: editedFirstName }).first();
    await expect(editedRow).toBeVisible({ timeout: 15000 });
    await editedRow.locator('button').click();
    await page.getByRole('button', { name: /sí, eliminar/i }).click();
    await expect(page.locator('tbody tr').filter({ hasText: editedFirstName })).toHaveCount(0, { timeout: 15000 });
    await clearPeopleSearch(page);
  });

  test('categorías > roles y jurisdicciones > permite ABM visible en frontend', async () => {
    const roleName = buildUniqueLabel('Rol E2E');
    const roleNameUpdated = `${roleName} Editado`;
    const jurisdiccionName = buildUniqueLabel('Jurisdiccion E2E');
    const jurisdiccionNameUpdated = `${jurisdiccionName} Editada`;

    await openRolesCatalog(page);
    await page.getByText('Cargar un nuevo rol').click();
    const roleCreateInput = page.locator('#roles-titulo');
    await roleCreateInput.fill(roleName);
    await roleCreateInput.press('Enter');
    await expect(page.getByText('Rol creado')).toBeVisible({ timeout: 10000 });

    let roleRow = await waitForRoleInCatalog(page, roleName);
    await roleRow.getByRole('button', { name: 'Editar' }).click();
    const rolesSection = getRolesSection(page);
    const roleInput = rolesSection.locator('tbody tr input[type="text"]').first();
    await expect(roleInput).toBeVisible({ timeout: 5000 });
    await roleInput.fill(roleNameUpdated);
    await rolesSection.getByRole('button', { name: 'Guardar' }).click();
    await expect(page.getByText('Rol actualizado')).toBeVisible({ timeout: 10000 });
    roleRow = await waitForRoleInCatalog(page, roleNameUpdated);

    await roleRow.getByRole('button', { name: 'Eliminar' }).click();
    await page.getByRole('button', { name: /^eliminar$/i }).click();
    await expect(page.getByText('Rol eliminado')).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => {
        await openRolesCatalog(page);
        const roleSearch = page.getByTestId('categories-search-roles');
        await roleSearch.fill(roleNameUpdated);
        return await getRolesSection(page).locator('tbody tr').filter({ hasText: roleNameUpdated }).count();
      }, {
        timeout: 15000,
        message: `El rol "${roleNameUpdated}" no desapareció del catálogo luego de eliminarlo.`,
      })
      .toBe(0);

    await openJurisdiccionesCatalog(page);
    await createJurisdiccion(page, jurisdiccionName);

    const createdJurisdiccion = await waitForJurisdiccionInCatalog(page, jurisdiccionName);
    await expect(createdJurisdiccion).toBeVisible({ timeout: 15000 });
    await createdJurisdiccion.click();
    await page.getByTitle('Editar jurisdicción').click();
    await expect(page.getByRole('heading', { name: 'Editar Jurisdicción' })).toBeVisible({ timeout: 10000 });
    await page.getByPlaceholder('Ej: Paraná, Concordia, Federal...').fill(jurisdiccionNameUpdated);
    await page.getByRole('button', { name: 'Guardar Cambios' }).click();
    await expect(page.getByRole('heading', { name: 'Editar Jurisdicción' })).toBeHidden({ timeout: 10000 });
    await expect(page.getByText('Jurisdicción actualizada')).toBeVisible({ timeout: 10000 });

    const updatedJurisdiccion = await waitForJurisdiccionInCatalog(page, jurisdiccionNameUpdated);
    await expect(updatedJurisdiccion).toBeVisible({ timeout: 15000 });
    await updatedJurisdiccion.click();
    await page.getByTitle('Eliminar jurisdicción').click();
    await page.getByRole('button', { name: /^eliminar$/i }).click();
    await expect(page.getByText('Jurisdicción eliminada')).toBeVisible({ timeout: 10000 });
    await expect
      .poll(async () => {
        await openJurisdiccionesCatalog(page);
        const searchInput = page.getByPlaceholder('Buscar jurisdicción...');
        await searchInput.fill(jurisdiccionNameUpdated);
        return await page.locator('div').filter({ hasText: jurisdiccionNameUpdated }).count();
      }, {
        timeout: 15000,
        message: `La jurisdicción "${jurisdiccionNameUpdated}" no desapareció del catálogo luego de eliminarla.`,
      })
      .toBe(0);
  });

  test('admin > consulta bitácora y edita un usuario restaurando su estado final', async () => {
    await openAdminBitacoraTab(page);

    const firstBitacoraViewButton = page.getByRole('button', { name: /ver detalle del movimiento/i }).first();
    await expect(firstBitacoraViewButton).toBeVisible({ timeout: 15000 });
    await firstBitacoraViewButton.click();
    await expect(page.getByRole('heading', { name: 'Detalle del movimiento' })).toBeVisible({ timeout: 10000 });
    await closeModalWithEscape(page, 'Detalle del movimiento');

    await openAdminUsersTab(page);

    const { tag, row } = await findAdminUserRow(page);
    const originalName = ((await row.locator('td').nth(1).textContent()) || '').trim();
    const updatedName = `${originalName} E2E`;

    await row.getByTitle('Editar usuario').click();
    await expect(page.getByRole('heading', { name: new RegExp(`Editar Usuario: ${tag}`) })).toBeVisible({ timeout: 10000 });
    await page.locator('#admin-edit-user-name').fill(updatedName);
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`Editar Usuario: ${tag}`) })).toBeHidden({ timeout: 15000 });

    const updatedRow = await getAdminUserRowByTag(page, tag);
    await expect(updatedRow).toContainText(updatedName, { timeout: 15000 });

    await updatedRow.getByTitle('Editar usuario').click();
    await expect(page.getByRole('heading', { name: new RegExp(`Editar Usuario: ${tag}`) })).toBeVisible({ timeout: 10000 });
    await page.locator('#admin-edit-user-name').fill(originalName);
    await page.getByRole('button', { name: /guardar cambios/i }).click();
    await expect(page.getByRole('heading', { name: new RegExp(`Editar Usuario: ${tag}`) })).toBeHidden({ timeout: 15000 });

    const restoredRow = await getAdminUserRowByTag(page, tag);
    await expect(restoredRow).toContainText(originalName);
  });
});
