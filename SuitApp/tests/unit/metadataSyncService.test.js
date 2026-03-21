/**
 * Tests unitarios para metadataSyncService.js
 *
 * ESTRATEGIA:
 * - Mockeamos `syncCore.js` para que `syncResource` ejecute la fetchFn directamente,
 *   sin pasar por los guards de API base, in-flight dedupe o last-modified checks.
 * - Mockeamos `api.js` (apiGet) para controlar las respuestas del servidor.
 * - Verificamos que buildRow mapea correctamente los campos de la API a las columnas SQLite.
 * - Verificamos que si la API falla (result sin `ok`), la función lanza Error.
 *
 * Los catálogos a testear:
 *   - syncRadicaciones: item.nombre_lugar → columna `name`
 *   - syncTipoPagos:    item.titulo       → columna `name`
 *   - syncRoles:        item.titulo       → columna `titulo`
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mockeamos syncCore para que syncResource simplemente invoque la fetchFn pasada.
vi.mock('../../src/services/sync/syncCore.js', () => ({
    syncResource: vi.fn(async (_resourceName, _lastModifiedEndpoint, fetchFn) => {
        return await fetchFn();
    }),
    resetSyncInFlightState: vi.fn(),
    getLocalLaravelTime: vi.fn(() => '2026-01-01 00:00:00'),
    isExpectedNetworkError: vi.fn(() => false),
    isServerUpToDate: vi.fn(() => false),
    parseTimestampToMs: vi.fn(() => null),
    clearStaleResources: vi.fn().mockResolvedValue(undefined),
    STALE_THRESHOLD_DAYS: 3,
}));

// Mockeamos apiGet para controlar las respuestas de la API
vi.mock('../../src/services/api.js', () => ({
    apiGet: vi.fn(),
    apiRequest: vi.fn(),
    getApiBase: vi.fn(() => 'http://localhost:8000/api'),
}));

import {
    syncRadicaciones,
    syncTipoPagos,
    syncRoles,
    syncGastosCatalogo,
    syncPartes,
} from '../../src/services/sync/metadataSyncService.js';
import { apiGet } from '../../src/services/api.js';

describe('metadataSyncService', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // setup.js provee window.electronAPI.logs.*; extendemos con db.*
        window.electronAPI.db = {
            getAll: vi.fn().mockResolvedValue([]),
            upsertMany: vi.fn().mockResolvedValue(undefined),
            clearTable: vi.fn().mockResolvedValue(undefined),
        };
    });

    // ── syncRadicaciones ────────────────────────────────────────────────────────

    describe('syncRadicaciones', () => {
        it('mapea item.nombre_lugar a la columna `name` en la fila cacheada', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [
                    { id: 1, nombre_lugar: 'Buenos Aires' },
                    { id: 2, nombre_lugar: 'Córdoba' },
                ],
            });

            await syncRadicaciones();

            expect(window.electronAPI.db.clearTable).toHaveBeenCalledWith('radicaciones');
            const [[table, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(table).toBe('radicaciones');
            expect(rows[0]).toMatchObject({ id: 1, name: 'Buenos Aires' });
            expect(rows[1]).toMatchObject({ id: 2, name: 'Córdoba' });
        });

        it('serializa el objeto completo en data_json', async () => {
            const item = { id: 3, nombre_lugar: 'Rosario', extra: 'algo' };
            apiGet.mockResolvedValue({ ok: true, status: 200, data: [item] });

            await syncRadicaciones();

            const [[, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(JSON.parse(rows[0].data_json)).toEqual(item);
        });

        it('lanza Error si la API devuelve result sin ok', async () => {
            apiGet.mockResolvedValue({ ok: false, status: 500, error: 'Server error' });

            await expect(syncRadicaciones()).rejects.toThrow(/radicaciones/);
        });

        it('maneja item.nombre_lugar null/undefined usando null en la columna name', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [{ id: 4, nombre_lugar: undefined }],
            });

            await syncRadicaciones();

            const [[, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(rows[0].name).toBeNull();
        });
    });

    // ── syncTipoPagos ───────────────────────────────────────────────────────────

    describe('syncTipoPagos', () => {
        it('mapea item.titulo a la columna `name` en la fila cacheada', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [
                    { id: 1, titulo: 'Efectivo' },
                    { id: 2, titulo: 'Transferencia' },
                ],
            });

            await syncTipoPagos();

            expect(window.electronAPI.db.clearTable).toHaveBeenCalledWith('tipo_pagos');
            const [[table, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(table).toBe('tipo_pagos');
            expect(rows[0]).toMatchObject({ id: 1, name: 'Efectivo' });
            expect(rows[1]).toMatchObject({ id: 2, name: 'Transferencia' });
        });

        it('lanza Error si la API devuelve result sin ok', async () => {
            apiGet.mockResolvedValue({ ok: false, status: 503 });

            await expect(syncTipoPagos()).rejects.toThrow(/tipo_pagos/);
        });

        it('maneja item.titulo null usando null en la columna name', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [{ id: 5, titulo: null }],
            });

            await syncTipoPagos();

            const [[, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(rows[0].name).toBeNull();
        });
    });

    // ── syncRoles ───────────────────────────────────────────────────────────────

    describe('syncRoles', () => {
        it('mapea item.titulo a la columna `titulo` (no `name`) en la fila cacheada', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [
                    { id: 1, titulo: 'Juez' },
                    { id: 2, titulo: 'Perito' },
                ],
            });

            await syncRoles();

            expect(window.electronAPI.db.clearTable).toHaveBeenCalledWith('roles');
            const [[table, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(table).toBe('roles');
            // Roles usa `titulo`, no `name`
            expect(rows[0]).toMatchObject({ id: 1, titulo: 'Juez' });
            expect(rows[1]).toMatchObject({ id: 2, titulo: 'Perito' });
            // No debe existir la clave `name` en la fila de rol
            expect(rows[0].name).toBeUndefined();
        });

        it('serializa el objeto completo en data_json', async () => {
            const item = { id: 3, titulo: 'Testigo' };
            apiGet.mockResolvedValue({ ok: true, status: 200, data: [item] });

            await syncRoles();

            const [[, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(JSON.parse(rows[0].data_json)).toEqual(item);
        });

        it('lanza Error si la API devuelve result sin ok', async () => {
            apiGet.mockResolvedValue({ ok: false, status: 404 });

            await expect(syncRoles()).rejects.toThrow(/roles/);
        });
    });

    // ── syncGastosCatalogo ──────────────────────────────────────────────────────

    describe('syncGastosCatalogo', () => {
        it('mapea item.titulo a la columna `titulo` en la fila cacheada', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [{ id: 1, titulo: 'Fotocopias' }],
            });

            await syncGastosCatalogo();

            const [[table, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(table).toBe('gastos_catalogo');
            expect(rows[0]).toMatchObject({ id: 1, titulo: 'Fotocopias' });
        });

        it('usa item.name como fallback cuando item.titulo no está presente', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [{ id: 2, name: 'Sellos' }],
            });

            await syncGastosCatalogo();

            const [[, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(rows[0].titulo).toBe('Sellos');
        });

        it('lanza Error si la API devuelve result sin ok', async () => {
            apiGet.mockResolvedValue({ ok: false, status: 500 });

            await expect(syncGastosCatalogo()).rejects.toThrow(/gastos_catalogo/);
        });
    });

    // ── syncPartes ──────────────────────────────────────────────────────────────

    describe('syncPartes', () => {
        it('mapea correctamente los campos nombre, apellido, email, telefono, rol_id', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [
                    { id: 1, nombre: 'Ana', apellido: 'Lopez', email: 'ana@test.com', telefono: '1234', rol_id: 2 },
                    { id: 2, nombre: 'Luis', apellido: 'Gomez', email: null, telefono: null, rol_id: null },
                ],
            });

            await syncPartes();

            expect(window.electronAPI.db.clearTable).toHaveBeenCalledWith('partes');
            const [[table, rows]] = window.electronAPI.db.upsertMany.mock.calls;
            expect(table).toBe('partes');
            expect(rows[0]).toMatchObject({
                id: 1, nombre: 'Ana', apellido: 'Lopez', email: 'ana@test.com', telefono: '1234', rol_id: 2,
            });
            expect(rows[1]).toMatchObject({ id: 2, email: null, telefono: null, rol_id: null });
        });

        it('lanza Error si la API devuelve result sin ok', async () => {
            apiGet.mockResolvedValue({ ok: false, status: 500 });

            await expect(syncPartes()).rejects.toThrow(/partes/);
        });
    });

    // ── Comportamiento compartido de replaceCachedRows ──────────────────────────

    describe('comportamiento compartido: replaceCachedRows', () => {
        it('siempre llama a clearTable antes de upsertMany', async () => {
            apiGet.mockResolvedValue({
                ok: true,
                status: 200,
                data: [{ id: 1, nombre_lugar: 'Test' }],
            });

            const clearOrder = [];
            window.electronAPI.db.clearTable = vi.fn(async (table) => { clearOrder.push(`clear:${table}`); });
            window.electronAPI.db.upsertMany = vi.fn(async (table) => { clearOrder.push(`upsert:${table}`); });

            await syncRadicaciones();

            expect(clearOrder[0]).toBe('clear:radicaciones');
            expect(clearOrder[1]).toBe('upsert:radicaciones');
        });

        it('no llama a upsertMany si la API devuelve array vacío', async () => {
            apiGet.mockResolvedValue({ ok: true, status: 200, data: [] });

            await syncRadicaciones();

            // clearTable debe haberse llamado, pero no upsertMany (0 rows)
            expect(window.electronAPI.db.clearTable).toHaveBeenCalledWith('radicaciones');
            expect(window.electronAPI.db.upsertMany).not.toHaveBeenCalled();
        });
    });
});
