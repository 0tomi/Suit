import { test, expect } from '@playwright/test';
import { launchAndLogin, launchElectronApp, ensureLoggedIn, goToSection } from './helpers/electronTestUtils.js';

const PIN_LABELS = {
    pinned: 'No mostrar en el sidebar',
    unpinned: 'Mostrar en sidebar',
};

/**
 * La página pública "Secciones" es el punto de entrada del flujo.
 * Desde ahí el usuario decide si solo inspecciona cards o si luego va a Configuración a pinnear.
 */
async function openSectionsPage(window, { timeout = 15000 } = {}) {
    await goToSection(window, 'sections', { timeout });
    await expect(window.getByTestId('page-sections-title')).toBeVisible({ timeout });
}

/**
 * Abre el panel real de pinning en Ajustes > Secciones.
 * La ruta /sections renderiza las cards públicas, pero los botones sections-pin-btn-* viven en Settings.
 */
async function openSectionsPinningPanel(window, { timeout = 15000 } = {}) {
    await openSectionsPage(window, { timeout });
    await window.getByTestId('sidebar-nav-settings').click();
    await expect(window.locator('h1', { hasText: 'Configuración' })).toBeVisible({ timeout });
    const seccionesTab = window.locator('#settings-tab-secciones');
    await seccionesTab.waitFor({ state: 'visible', timeout });
    await seccionesTab.click();
}

/**
 * Cierra sesión usando el flujo real expuesto en la sección Perfil de Ajustes.
 */
async function logout(window) {
    await window.getByTestId('sidebar-nav-settings').click();
    await expect(window.locator('h1', { hasText: 'Configuración' })).toBeVisible({ timeout: 10000 });
    const perfilTab = window.locator('#settings-tab-perfil');
    await perfilTab.waitFor({ state: 'visible', timeout: 10000 });
    await perfilTab.click();
    await window.getByRole('button', { name: 'Cerrar sesión' }).first().click();
    await window.getByRole('button', { name: 'Cerrar sesión' }).last().click();
    await expect(window.getByTestId('login-submit')).toBeVisible({ timeout: 15000 });
}

/**
 * Tests E2E para la feature de Sidebar Dinámica y la página Secciones.
 * Validan: visibilidad permanente del ícono Secciones, renderizado de cards,
 * pin/unpin dinámico, persistencia entre sesiones y control de acceso admin.
 */
test.describe('Secciones — Sidebar dinámica', () => {

    test('El ícono Secciones siempre está visible en el sidebar', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            // Verificar que el NavLink de Secciones está presente independientemente del estado
            const sectionsNav = window.getByTestId('sidebar-nav-sections-manager');
            await sectionsNav.waitFor({ timeout: 10000 });
            await expect(sectionsNav).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    test('La página Secciones renderiza cards de las secciones', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openSectionsPage(window);

            // Verificar que las cards de secciones no-admin están presentes
            for (const label of ['Agenda', 'Vencimientos', 'Personas', 'Casos', 'Documentos', 'Modelos']) {
                await expect(window.getByText(label).first()).toBeVisible({ timeout: 5000 });
            }

            // El Panel Admin NO debe aparecer para el usuario de test (no-admin)
            await expect(window.getByText('Panel Admin')).not.toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    test('Los defaults muestran solo Agenda, Vencimientos y Casos en el sidebar', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openSectionsPage(window);

            // Esperar a que el sidebar esté listo
            await window.getByTestId('sidebar-nav-agenda').waitFor({ timeout: 10000 });

            // Deben estar presentes (defaults)
            await expect(window.getByTestId('sidebar-nav-agenda')).toBeVisible();
            await expect(window.getByTestId('sidebar-nav-deadlines')).toBeVisible();
            await expect(window.getByTestId('sidebar-nav-cases')).toBeVisible();

            // NO deben estar en el sidebar (no están en DEFAULT_PINNED_SECTIONS)
            await expect(window.getByTestId('sidebar-nav-people')).not.toBeVisible();
            await expect(window.getByTestId('sidebar-nav-documents')).not.toBeVisible();
            await expect(window.getByTestId('sidebar-nav-templates')).not.toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    test('Anclar una sección la agrega al sidebar dinámicamente', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            // Documentos no está anclado por defecto
            await expect(window.getByTestId('sidebar-nav-documents')).not.toBeVisible();

            // Ir al panel de pinning y anclar Documentos
            await openSectionsPinningPanel(window);
            const pinBtn = window.getByTestId('sections-pin-btn-documents');
            await pinBtn.waitFor({ timeout: 5000 });
            await pinBtn.click();

            // El sidebar ahora debe mostrar Documentos
            await expect(window.getByTestId('sidebar-nav-documents')).toBeVisible({ timeout: 5000 });

            // El botón debe reflejar el nuevo estado pineado.
            await expect(pinBtn).toContainText(PIN_LABELS.pinned, { timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('Desanclar una sección la elimina del sidebar dinámicamente', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            // Casos está anclado por defecto
            await expect(window.getByTestId('sidebar-nav-cases')).toBeVisible({ timeout: 10000 });

            // Ir al panel de pinning y desanclar Casos
            await openSectionsPinningPanel(window);
            const unpinBtn = window.getByTestId('sections-pin-btn-cases');
            await unpinBtn.waitFor({ timeout: 5000 });
            // El botón debe reflejar que hoy está visible en el sidebar.
            await expect(unpinBtn).toContainText(PIN_LABELS.pinned);
            await unpinBtn.click();

            // Casos debe desaparecer del sidebar
            await expect(window.getByTestId('sidebar-nav-cases')).not.toBeVisible({ timeout: 5000 });
            await expect(unpinBtn).toContainText(PIN_LABELS.unpinned, { timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    test('El estado de pinning persiste después de cerrar y relanzar la app', async () => {
        // Primera sesión: anclar Personas
        const { electronApp, window, userDataDir } = await launchAndLogin();
        try {
            await openSectionsPinningPanel(window);
            const pinBtn = window.getByTestId('sections-pin-btn-people');
            await pinBtn.waitFor({ timeout: 5000 });
            await pinBtn.click();
            await expect(window.getByTestId('sidebar-nav-people')).toBeVisible({ timeout: 5000 });
        } finally {
            await electronApp.close();
        }

        // Segunda sesión con el mismo userDataDir: Personas debe seguir anclada
        const { electronApp: app2, window: window2 } = await launchElectronApp({ userDataDir });
        try {
            await ensureLoggedIn(window2);
            await openSectionsPage(window2);
            await expect(window2.getByTestId('sidebar-nav-people')).toBeVisible({ timeout: 10000 });
        } finally {
            await app2.close();
        }
    });

});

// =============================================================================
// Tests adicionales: puntos de fallo no cubiertos por la batería original
// =============================================================================

test.describe('Secciones — Puntos de fallo adicionales', () => {

    /**
     * El botón de pinning debe mostrar "Mostrar en sidebar" (no pinned) ANTES del click,
     * y "No mostrar en el sidebar" (pinned) DESPUÉS. El test original no verificaba el estado
     * inicial del botón, por lo que podría pasar si el estado ya fuera "pinned"
     * de una sesión anterior compartida.
     */
    test('El botón muestra el estado correcto antes y después del click', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openSectionsPinningPanel(window);

            // Modelos no está en DEFAULT_PINNED_SECTIONS.
            const pinBtn = window.getByTestId('sections-pin-btn-templates');
            await pinBtn.waitFor({ timeout: 5000 });
            await expect(pinBtn).toContainText(PIN_LABELS.unpinned);

            await pinBtn.click();

            // Después del click el texto cambia al estado pineado.
            await expect(pinBtn).toContainText(PIN_LABELS.pinned, { timeout: 3000 });
            await expect(window.getByTestId('sidebar-nav-templates')).toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    /**
     * El sidebar preserva el orden del SECTIONS_REGISTRY sin importar el orden
     * en que el usuario ancló las secciones. Anclar Modelos (posición 5 en el
     * registry) y luego Personas (posición 2) debe mostrarlos en orden
     * registry: Personas → Modelos.
     */
    test('El sidebar muestra las secciones en el orden del registry, no en orden de pinning', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openSectionsPinningPanel(window);

            // Anclar primero Modelos (index 5 en el registry, key: templates)
            const pinTemplates = window.getByTestId('sections-pin-btn-templates');
            await pinTemplates.waitFor({ timeout: 5000 });
            await pinTemplates.click();
            await expect(window.getByTestId('sidebar-nav-templates')).toBeVisible({ timeout: 5000 });

            // Anclar luego Personas (index 2 en el registry, key: people)
            const pinPeople = window.getByTestId('sections-pin-btn-people');
            await pinPeople.click();
            await expect(window.getByTestId('sidebar-nav-people')).toBeVisible({ timeout: 5000 });

            // Obtener posición DOM de cada navLink dentro del elemento padre <nav>
            const peopleIndex = await window.getByTestId('sidebar-nav-people').evaluate(
                (el) => Array.from(el.parentElement.children).indexOf(el)
            );
            const templatesIndex = await window.getByTestId('sidebar-nav-templates').evaluate(
                (el) => Array.from(el.parentElement.children).indexOf(el)
            );
            // Personas (registry index 2) debe preceder a Modelos (registry index 5)
            expect(peopleIndex).toBeLessThan(templatesIndex);
        } finally {
            await electronApp.close();
        }
    });

    /**
     * Desanclar las tres secciones por defecto debe dejar el sidebar sin
     * navItems dinámicos, pero el ícono de Secciones (hardcoded fuera del
     * array navItems) debe seguir visible. Verifica que el sidebar no se rompe
     * con un array vacío.
     */
    test('Desanclar todas las secciones deja el sidebar sin navItems pero Secciones sigue visible', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openSectionsPinningPanel(window);

            // Desanclar los tres defaults uno a uno, esperando que el estado cambie entre cada uno
            for (const key of ['agenda', 'deadlines', 'cases']) {
                const btn = window.getByTestId(`sections-pin-btn-${key}`);
                await btn.waitFor({ timeout: 5000 });
                await expect(btn).toContainText(PIN_LABELS.pinned);
                await btn.click();
                await expect(btn).toContainText(PIN_LABELS.unpinned, { timeout: 3000 });
            }

            // Los tres defaults deben haber desaparecido del sidebar
            await expect(window.getByTestId('sidebar-nav-agenda')).not.toBeVisible({ timeout: 3000 });
            await expect(window.getByTestId('sidebar-nav-deadlines')).not.toBeVisible({ timeout: 3000 });
            await expect(window.getByTestId('sidebar-nav-cases')).not.toBeVisible({ timeout: 3000 });

            // El ícono de Secciones siempre debe estar visible (no está bajo pinning)
            await expect(window.getByTestId('sidebar-nav-sections-manager')).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    /**
     * Anclar una sección y clickear el NavLink resultante en el sidebar
     * debe navegar correctamente a esa página. El test original solo verificaba
     * que el link aparecía, no que fuera funcional.
     */
    test('Anclar Personas y navegar desde el sidebar lleva a la página de Personas', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openSectionsPinningPanel(window);

            const pinBtn = window.getByTestId('sections-pin-btn-people');
            await pinBtn.waitFor({ timeout: 5000 });
            await expect(pinBtn).toContainText(PIN_LABELS.unpinned);
            await pinBtn.click();

            const peopleNav = window.getByTestId('sidebar-nav-people');
            await peopleNav.waitFor({ state: 'visible', timeout: 5000 });
            await peopleNav.click();

            // La página de Personas debe cargar y dejar activa la pestaña Clientes por defecto.
            await expect(window.getByTestId('page-people-title')).toBeVisible({ timeout: 10000 });
            await expect(window.getByTestId('page-clients-title')).toContainText('Clientes');
        } finally {
            await electronApp.close();
        }
    });

    /**
     * Una sección con adminOnly:true no debe aparecer en el sidebar aunque
     * su key esté presente en pinnedSections (estado corrupto o de migración).
     * Valida el filtro adminOnly del useMemo en Sidebar.jsx para el usuario test
     * que no tiene rol admin.
     */
    test('Una sección adminOnly no aparece en el sidebar para usuarios no-admin aunque esté en pinnedSections', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            // Inyectar 'admin' en pinnedSections vía localStorage para simular
            // un estado corrupto o proveniente de una migración incorrecta
            await window.evaluate(() => {
                const keys = Object.keys(localStorage).filter(k => k.startsWith('suit-settings:user:'));
                if (keys.length === 0) return;
                const key = keys[0];
                const raw = localStorage.getItem(key);
                const settings = raw ? JSON.parse(raw) : {};
                settings.pinnedSections = [...(settings.pinnedSections || []), 'admin'];
                localStorage.setItem(key, JSON.stringify(settings));
            });

            // Re-navegar para que React recargue el settings desde localStorage
            await openSectionsPage(window);

            // El sidebar NO debe mostrar Panel Admin
            await expect(window.getByTestId('sidebar-nav-admin')).not.toBeVisible({ timeout: 3000 });
        } finally {
            await electronApp.close();
        }
    });

    /**
     * Las secciones ancladas deben persistir después de logout y re-login
     * en la misma sesión de proceso. SettingsContext usa localStorage keyed
     * por user.id, así que el re-login del mismo usuario debe restaurar el estado.
     */
    test('Las secciones ancladas persisten después de logout y re-login sin reiniciar la app', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            // Anclar Documentos
            await openSectionsPinningPanel(window);
            const pinBtn = window.getByTestId('sections-pin-btn-documents');
            await pinBtn.waitFor({ timeout: 5000 });
            await expect(pinBtn).toContainText(PIN_LABELS.unpinned);
            await pinBtn.click();
            await expect(window.getByTestId('sidebar-nav-documents')).toBeVisible({ timeout: 5000 });

            await logout(window);
            await ensureLoggedIn(window);
            await openSectionsPage(window);

            // Documentos debe seguir anclado (settings cacheados en localStorage por userId)
            await expect(window.getByTestId('sidebar-nav-documents')).toBeVisible({ timeout: 5000 });
        } finally {
            await electronApp.close();
        }
    });

    /**
     * Dos clicks rápidos (dblclick) sobre el botón de anclar no deben dejar
     * el badge y el navItem en estados contradictorios. El resultado puede ser
     * cualquier estado válido (anclado o no), pero badge y navItem deben coincidir.
     */
    test('Doble-click sobre el pin deja badge y navItem en estado coherente', async () => {
        const { electronApp, window } = await launchAndLogin();
        try {
            await openSectionsPinningPanel(window);

            const pinBtn = window.getByTestId('sections-pin-btn-templates');
            await pinBtn.waitFor({ timeout: 5000 });
            // Verificar estado inicial conocido: no anclado
            await expect(pinBtn).toContainText(PIN_LABELS.unpinned);

            // Doble-click rápido
            await pinBtn.dblclick();

            // Esperar a que React procese todos los eventos de estado pendientes
            await window.waitForTimeout(400);

            // Leer estado final de ambos indicadores
            const btnText = await pinBtn.innerText();
            const navVisible = await window.getByTestId('sidebar-nav-templates').isVisible();

            // Invariante: badge y navItem deben ser coherentes entre sí
            if (btnText.includes(PIN_LABELS.unpinned)) {
                // No anclado: el navItem no debe estar en el sidebar
                expect(navVisible).toBe(false);
            } else {
                // Anclado: el navItem debe estar en el sidebar
                expect(navVisible).toBe(true);
            }
        } finally {
            await electronApp.close();
        }
    });

});
