/**
 * E2E tests para el módulo TutorialDrawer.
 * Valida el tutorial de la Agenda General: apertura vía ícono Info,
 * navegación del carrusel, cierre del drawer
 * y visibilidad del toggle global que controla los tutoriales.
 *
 * HIPÓTESIS:
 * - Si el usuario abre el tutorial, debe ver de inmediato la descripción y el cierre debajo del contenido.
 * - Si navega entre slides, la descripción debe cambiar con el slide activo.
 * - Si desactiva showTutorials desde Ajustes, el ícono Info debe desaparecer al volver a Agenda.
 * - Si entra a Vencimientos con tutoriales activos, debe ver el mismo trigger reutilizable y abrir el tutorial propio de la sección.
 */
import { test, expect } from '@playwright/test';
import { goToSection, launchAndLogin, waitForPageReady } from './helpers/electronTestUtils.js';

/** Navega a la Agenda General (click en sidebar) y espera que cargue. */
async function goToAgenda(window) {
    await window.getByTestId('sidebar-nav-agenda').click();
    await waitForPageReady(window, 'agenda', { timeout: 15000 });
}

/** Navega a Vencimientos y espera que la sección esté lista. */
async function goToDeadlines(window) {
    await goToSection(window, 'deadlines', { timeout: 15000 });
}

/** El titulo del drawer es exactamente "Tutorial". */
const tutorialDrawerTitle = (window) =>
    window.getByRole('heading', { name: 'Tutorial', exact: true });

const tutorialCloseButton = (window) =>
    window.getByTestId('tutorial-close-button');

async function closeTutorial(window) {
    const closeButton = tutorialCloseButton(window);
    await expect(closeButton).toBeVisible({ timeout: 5000 });
    await closeButton.click();
}

test.describe('TutorialDrawer — Agenda General', () => {

    test('el ícono Info abre el drawer del tutorial', async () => {
        test.setTimeout(60_000);
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToAgenda(window);

            // El ícono de tutorial debe estar visible en el título
            const infoBtn = window.locator('button[aria-label="Ver tutorial de la Agenda"]');
            await expect(infoBtn).toBeVisible({ timeout: 5000 });
            await expect(window.getByTestId('agenda-tutorial-trigger')).toHaveClass(/tutorial-icon-hop/);
            await infoBtn.click();

            // El drawer debe abrirse
            await expect(tutorialDrawerTitle(window)).toBeVisible({ timeout: 5000 });

            // Descripción del primer paso (imagen 1)
            await expect(window.getByTestId('tutorial-description')).toContainText('Bienvenido a tu Agenda General', { timeout: 5000 });

            // Al abrir, debe verse el cierre textual bajo la descripcion
            await expect(tutorialCloseButton(window)).toBeVisible({ timeout: 3000 });

            await closeTutorial(window);
            await expect(tutorialDrawerTitle(window)).not.toBeVisible({ timeout: 5000 });
        } finally {
            await electronApp.close();
        }
    });

    test('navega entre slides y actualiza descripción', async () => {
        test.setTimeout(60_000);
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToAgenda(window);

            await window.locator('button[aria-label="Ver tutorial de la Agenda"]').click();
            await expect(tutorialDrawerTitle(window)).toBeVisible({ timeout: 5000 });

            // Paso 1 visible
            await expect(window.getByTestId('tutorial-description')).toContainText('Bienvenido a tu Agenda General', { timeout: 3000 });

            // Navega al siguiente slide
            const nextBtn = window.locator('button[aria-label="Siguiente"]');
            await expect(nextBtn).toBeVisible({ timeout: 3000 });
            await nextBtn.click({ noWaitAfter: true });

            // Paso 2: selector de agendas
            await expect(window.getByTestId('tutorial-description')).toContainText('El selector de agenda', { timeout: 5000 });

            await closeTutorial(window);
        } finally {
            await electronApp.close();
        }
    });

    test('el ícono no aparece si showTutorials está desactivado', async () => {
        test.setTimeout(90_000);
        const { electronApp, window } = await launchAndLogin();
        try {
            // Desactivar tutoriales desde Settings
            const settingsLink = window.getByRole('link', { name: 'Ajustes' }).first();
            await settingsLink.click();
            await window.waitForSelector('h1:has-text("Configuración")', { timeout: 10000 });
            await window.click('#settings-tab-general');
            const toggle = window.locator('#toggle-show-tutorials');
            await expect(toggle).toBeVisible({ timeout: 5000 });
            await toggle.click();

            // Volver a la Agenda
            await goToAgenda(window);

            // El ícono NO debe aparecer
            await expect(
                window.locator('button[aria-label="Ver tutorial de la Agenda"]')
            ).not.toBeVisible({ timeout: 5000 });
        } finally {
            await electronApp.close();
        }
    });
});

test.describe('TutorialDrawer — Vencimientos', () => {
    test('el ícono reutilizable abre el tutorial de la sección', async () => {
        test.setTimeout(60_000);
        const { electronApp, window } = await launchAndLogin();
        try {
            await goToDeadlines(window);

            const infoBtn = window.locator('button[aria-label="Ver tutorial de Vencimientos"]');
            await expect(infoBtn).toBeVisible({ timeout: 5000 });
            await expect(window.getByTestId('deadlines-tutorial-trigger')).toHaveClass(/tutorial-icon-hop/);

            await infoBtn.click();

            await expect(tutorialDrawerTitle(window)).toBeVisible({ timeout: 5000 });
            await expect(window.getByTestId('tutorial-description')).toContainText('Bienvenido a Vencimientos', { timeout: 5000 });

            const nextBtn = window.locator('button[aria-label="Siguiente"]');
            await expect(nextBtn).toBeVisible({ timeout: 3000 });
            await nextBtn.click({ noWaitAfter: true });

            await expect(window.getByTestId('tutorial-description')).toContainText('Estos cuatro botones grandes son atajos', { timeout: 5000 });

            await closeTutorial(window);
            await expect(tutorialDrawerTitle(window)).not.toBeVisible({ timeout: 5000 });
        } finally {
            await electronApp.close();
        }
    });
});
