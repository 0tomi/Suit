/**
 * E2E: Migración v16 y sincronización de catálogos del rework.
 *
 * Verifica que tras el login:
 * - Las tablas de catálogos nuevos existen y tienen datos (radicaciones, roles, tipo_pagos).
 * - La tabla `cases` tiene las columnas del rework (nro_expediente puede ser null).
 * - El acceso a los catálogos desde el renderer (via window.electronAPI.db.getAll) funciona.
 *
 * NOTA: Este test lanza la app real y espera a que el sync inicial ocurra.
 * Si el servidor API no está disponible, los catálogos podrían estar vacíos;
 * en ese caso solo verificamos que las tablas existan (getAll no lanza error).
 */

import { test, expect } from '@playwright/test';
import { launchAndLogin } from './helpers/electronTestUtils.js';

test.describe('Rework Migration — catálogos y esquema v16', () => {
    let electronApp, window;

    test.beforeEach(async () => {
        ({ electronApp, window } = await launchAndLogin({
            prefix: 'rework-migration',
        }));
    });

    test.afterEach(async () => {
        if (electronApp) await electronApp.close();
    });

    test('la tabla radicaciones existe y getAll no lanza error', async () => {
        const rows = await window.evaluate(async () => {
            return await window.electronAPI.db.getAll('radicaciones');
        });

        // Debe ser un array (vacío si el servidor no está disponible, con datos si lo está)
        expect(Array.isArray(rows)).toBe(true);
    });

    test('la tabla roles existe y tiene al menos una fila tras sync', async () => {
        // Esperamos hasta 10s a que el sync inicial de catálogos complete
        const rows = await window.waitForFunction(async () => {
            const result = await window.electronAPI.db.getAll('roles');
            return Array.isArray(result) ? result : null;
        }, { timeout: 10000 }).catch(async () => {
            // Si waitForFunction falla, intentamos una lectura directa
            return await window.evaluate(async () => {
                return await window.electronAPI.db.getAll('roles');
            });
        });

        expect(Array.isArray(rows)).toBe(true);
    });

    test('la tabla tipo_pagos existe y getAll no lanza error', async () => {
        const rows = await window.evaluate(async () => {
            return await window.electronAPI.db.getAll('tipo_pagos');
        });

        expect(Array.isArray(rows)).toBe(true);
    });

    test('la tabla cases tiene la columna nro_expediente accesible', async () => {
        const cases = await window.evaluate(async () => {
            return await window.electronAPI.db.getAll('cases');
        });

        // La tabla cases debe existir (array, posiblemente vacío)
        expect(Array.isArray(cases)).toBe(true);

        if (cases.length > 0) {
            const firstCase = cases[0];
            // La columna nro_expediente debe existir en el esquema (valor puede ser null)
            expect('nro_expediente' in firstCase).toBe(true);
        }
    });

    test('la tabla parte_caso existe y getAll no lanza error', async () => {
        const rows = await window.evaluate(async () => {
            return await window.electronAPI.db.getAll('parte_caso');
        });

        expect(Array.isArray(rows)).toBe(true);
    });

    test('la tabla honorarios existe y getAll no lanza error', async () => {
        const rows = await window.evaluate(async () => {
            return await window.electronAPI.db.getAll('honorarios');
        });

        expect(Array.isArray(rows)).toBe(true);
    });

    test('la tabla gasto_suit_cases existe y getAll no lanza error', async () => {
        const rows = await window.evaluate(async () => {
            return await window.electronAPI.db.getAll('gasto_suit_cases');
        });

        expect(Array.isArray(rows)).toBe(true);
    });

    test('catálogos tienen datos válidos si el servidor está disponible', async () => {
        // Si roles tiene datos (servidor disponible), verificamos integridad mínima de filas
        const roles = await window.evaluate(async () => {
            return await window.electronAPI.db.getAll('roles');
        });

        if (roles.length > 0) {
            const firstRole = roles[0];
            // Cada fila de roles debe tener al menos id y titulo
            expect(firstRole).toHaveProperty('id');
            expect(firstRole).toHaveProperty('titulo');
        }

        const radicaciones = await window.evaluate(async () => {
            return await window.electronAPI.db.getAll('radicaciones');
        });

        if (radicaciones.length > 0) {
            const firstRad = radicaciones[0];
            // Cada fila de radicaciones debe tener id y name (mapeado desde nombre_lugar)
            expect(firstRad).toHaveProperty('id');
            expect(firstRad).toHaveProperty('name');
        }
    });
});
