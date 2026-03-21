import { test, expect } from '@playwright/test';
import { ensureLoggedIn, goToSection, launchAndLogin, launchElectronApp } from './helpers/electronTestUtils.js';

/**
 * Feature: Reportes
 * Hipotesis cubiertas: #1, #2
 *
 * CONTEXTO:
 * - La nueva home de la app redirige a /reports despues del login.
 * - Reportes toma datos de varios providers y renderiza KPIs + proximos items.
 *
 * PUNTOS CRITICOS IDENTIFICADOS:
 * - Cambio de home desde Agenda hacia Reportes.
 * - Nueva entrada en el sidebar con render de tarjetas resumidas.
 */
test.describe('Reportes - home y navegacion', () => {
    test('la home autenticada abre Reportes y muestra el resumen principal', async () => {
        test.slow();
        const { electronApp, window } = await launchElectronApp({ prefix: 'reports-home' });

        try {
            await ensureLoggedIn(window, undefined, { landingSection: 'reports' });
            await expect(window.getByTestId('page-reports-title')).toContainText('Panel operativo del estudio');
            await expect(window.getByTestId('sidebar-nav-reports')).toBeVisible();

            await expect(window.getByText('Casos activos')).toBeVisible();
            await expect(window.getByText('Eventos pendientes')).toBeVisible();
            await expect(window.getByText('Pendientes, prorrogados o vencidos aun accionables.')).toBeVisible();
            await expect(window.getByText('Clientes activos')).toBeVisible();
            await expect(window.getByText('Actividad mensual')).toBeVisible();
            await expect(window.getByText('Actividad anual')).toBeVisible();

            await expect(window.getByTestId('reports-upcoming-event')).toBeVisible();
            await expect(window.getByTestId('reports-upcoming-deadline')).toBeVisible();
            await expect(window.getByTestId('reports-upcoming-urgent-deadline')).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });

    test('el sidebar permite volver a Reportes despues de navegar a otra seccion', async () => {
        test.slow();
        const { electronApp, window } = await launchAndLogin({
            prefix: 'reports-sidebar-nav',
        });

        try {
            await goToSection(window, 'agenda');
            await goToSection(window, 'reports');

            await expect(window.getByTestId('page-reports-title')).toBeVisible();
            await expect(window.getByText('Como se calcula la actividad')).toBeVisible();
        } finally {
            await electronApp.close();
        }
    });
});
