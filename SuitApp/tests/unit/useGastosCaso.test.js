/**
 * Tests unitarios para el hook useGastosCaso.
 *
 * CONTEXTO:
 * - El hook carga gastos operativos de un caso desde SQLite primero, luego sincroniza con la API.
 * - Los gastos tienen `client_ids` como array en la API pero serializado como JSON en SQLite.
 * - Operaciones CRUD: addGasto, editGasto, removeGasto.
 * - Usa requestGenerationRef para evitar race conditions (mismo patrón que useHonorarios).
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de los servicios antes de importar el hook
vi.mock('../../src/services/gastoSuitCaseService.js', () => ({
    getGastosByCaso: vi.fn(),
    createGastoCaso: vi.fn(),
    updateGastoCaso: vi.fn(),
    deleteGastoCaso: vi.fn(),
}));

import { useGastosCaso } from '../../src/hooks/useGastosCaso.js';
import {
    getGastosByCaso,
    createGastoCaso,
    updateGastoCaso,
    deleteGastoCaso,
} from '../../src/services/gastoSuitCaseService.js';

/**
 * Construye una fila de caché simulada para `gasto_suit_cases`.
 * `client_ids` se serializa como JSON en SQLite, pero se guarda en data_json como array.
 */
function makeGastoRow(id, caseId, monto = 500, clientIds = [1, 2]) {
    const obj = {
        id,
        gasto_id: id * 10,
        suit_case_id: caseId,
        monto,
        // client_ids es array en la API, guardado en data_json como array
        client_ids: clientIds,
    };
    return {
        id,
        gasto_id: id * 10,
        suit_case_id: caseId,
        monto,
        // En SQLite client_ids es JSON serializado
        client_ids: JSON.stringify(clientIds),
        data_json: JSON.stringify(obj),
        synced_at: '2026-01-01',
    };
}

describe('useGastosCaso', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        // setup.js ya provee window.electronAPI.logs.*; extendemos con db.*
        window.electronAPI.db = {
            getAll: vi.fn().mockResolvedValue([]),
            upsertMany: vi.fn().mockResolvedValue(undefined),
            deleteById: vi.fn().mockResolvedValue(undefined),
        };
    });

    it('con caseId null retorna array vacío y loading false inmediatamente', async () => {
        const { result } = renderHook(() => useGastosCaso(null));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.gastos).toEqual([]);
        expect(result.current.error).toBeNull();
        // No debe intentar leer la DB si no hay caseId
        expect(window.electronAPI.db.getAll).not.toHaveBeenCalled();
    });

    it('carga desde caché primero, luego actualiza con datos de la API', async () => {
        const cacheRows = [makeGastoRow(1, 20, 300)];
        const apiRows = [makeGastoRow(1, 20, 400), makeGastoRow(2, 20, 150)];

        // Primera llamada: caché inicial. Segunda: datos frescos tras upsert.
        window.electronAPI.db.getAll = vi.fn()
            .mockResolvedValueOnce(cacheRows)
            .mockResolvedValueOnce(apiRows);
        window.electronAPI.db.upsertMany = vi.fn().mockResolvedValue(undefined);

        getGastosByCaso.mockResolvedValue(apiRows);

        const { result } = renderHook(() => useGastosCaso(20));

        // Esperar a que la carga inicial de caché ponga loading en false
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.gastos.length).toBeGreaterThan(0);
        });

        // Esperar a que la sincronización con la API termine (2 registros)
        await waitFor(() => {
            expect(result.current.gastos.length).toBe(2);
        });

        expect(getGastosByCaso).toHaveBeenCalledWith(20);
        expect(window.electronAPI.db.upsertMany).toHaveBeenCalledWith(
            'gasto_suit_cases',
            expect.arrayContaining([expect.objectContaining({ suit_case_id: 20 })])
        );
    });

    it('acepta la forma real { data: [...] } al sincronizar desde la API', async () => {
        const apiRows = [makeGastoRow(1, 20, 400), makeGastoRow(2, 20, 150)];

        window.electronAPI.db.getAll = vi.fn()
            .mockResolvedValueOnce([])
            .mockResolvedValueOnce(apiRows);
        window.electronAPI.db.upsertMany = vi.fn().mockResolvedValue(undefined);

        getGastosByCaso.mockResolvedValue({ data: apiRows });

        const { result } = renderHook(() => useGastosCaso(20));

        await waitFor(() => {
            expect(window.electronAPI.db.upsertMany).toHaveBeenCalledWith(
                'gasto_suit_cases',
                expect.arrayContaining([expect.objectContaining({ suit_case_id: 20 })])
            );
        });

        await waitFor(() => {
            expect(result.current.gastos.length).toBe(2);
        });
    });

    it('filtra los gastos por suit_case_id al leer de caché', async () => {
        // La tabla tiene gastos de dos casos distintos; solo debe mostrar los del caso 20
        const allRows = [
            makeGastoRow(1, 20, 300),
            makeGastoRow(2, 99, 800), // otro caso — no debe aparecer
            makeGastoRow(3, 20, 200),
        ];

        window.electronAPI.db.getAll = vi.fn().mockResolvedValue(allRows);
        getGastosByCaso.mockResolvedValue([makeGastoRow(1, 20, 300), makeGastoRow(3, 20, 200)]);

        const { result } = renderHook(() => useGastosCaso(20));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // El filtro debe excluir el gasto del caso 99 ya en la carga inicial de caché
        const caseIds = result.current.gastos.map((g) => g.suit_case_id);
        expect(caseIds.every((id) => String(id) === '20')).toBe(true);
    });

    it('addGasto llama a createGastoCaso con caseId y datos, luego recarga', async () => {
        const cacheRows = [makeGastoRow(1, 20, 300)];

        window.electronAPI.db.getAll = vi.fn().mockResolvedValue(cacheRows);
        window.electronAPI.db.upsertMany = vi.fn().mockResolvedValue(undefined);

        getGastosByCaso.mockResolvedValue(cacheRows);
        createGastoCaso.mockResolvedValue({ id: 5, suit_case_id: 20, monto: 700 });

        const { result } = renderHook(() => useGastosCaso(20));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.addGasto({ gasto_id: 10, monto: 700, client_ids: [1] });
        });

        expect(createGastoCaso).toHaveBeenCalledWith(20, { gasto_id: 10, monto: 700, client_ids: [1] });
        // Debe haber recargado desde la API (al menos 2 llamadas)
        expect(getGastosByCaso.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('editGasto llama a updateGastoCaso con id y datos, luego recarga', async () => {
        window.electronAPI.db.getAll = vi.fn().mockResolvedValue([makeGastoRow(1, 20, 300)]);
        window.electronAPI.db.upsertMany = vi.fn().mockResolvedValue(undefined);

        getGastosByCaso.mockResolvedValue([makeGastoRow(1, 20, 999)]);
        updateGastoCaso.mockResolvedValue({ id: 1, monto: 999 });

        const { result } = renderHook(() => useGastosCaso(20));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.editGasto(1, { monto: 999 });
        });

        expect(updateGastoCaso).toHaveBeenCalledWith(1, { monto: 999 });
        // Recarga tras edición
        expect(getGastosByCaso.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('removeGasto llama a deleteGastoCaso y elimina de la caché local', async () => {
        const cacheRows = [makeGastoRow(1, 20, 300), makeGastoRow(2, 20, 500)];
        const afterDelete = [makeGastoRow(2, 20, 500)];

        window.electronAPI.db.getAll = vi.fn()
            .mockResolvedValueOnce(cacheRows)   // carga inicial
            .mockResolvedValueOnce(cacheRows)   // sincronización con API
            .mockResolvedValueOnce(afterDelete); // lectura tras deleteById

        window.electronAPI.db.upsertMany = vi.fn().mockResolvedValue(undefined);
        window.electronAPI.db.deleteById = vi.fn().mockResolvedValue(undefined);

        getGastosByCaso.mockResolvedValue(cacheRows);
        deleteGastoCaso.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useGastosCaso(20));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.removeGasto(1);
        });

        expect(deleteGastoCaso).toHaveBeenCalledWith(1);
        expect(window.electronAPI.db.deleteById).toHaveBeenCalledWith('gasto_suit_cases', 1);
    });

    it('client_ids se serializa correctamente en la fila de caché al hacer upsert', async () => {
        // La API devuelve client_ids como array; buildGastoCacheRow debe serializarlo como JSON
        const apiGasto = {
            id: 1,
            gasto_id: 10,
            suit_case_id: 20,
            monto: 250,
            client_ids: [3, 7, 12],
        };

        window.electronAPI.db.getAll = vi.fn().mockResolvedValue([]);
        window.electronAPI.db.upsertMany = vi.fn().mockResolvedValue(undefined);

        getGastosByCaso.mockResolvedValue([apiGasto]);

        renderHook(() => useGastosCaso(20));

        await waitFor(() => {
            expect(window.electronAPI.db.upsertMany).toHaveBeenCalled();
        });

        const [[table, rows]] = window.electronAPI.db.upsertMany.mock.calls;
        expect(table).toBe('gasto_suit_cases');
        // client_ids debe haberse serializado a string JSON
        const row = rows.find((r) => r.id === 1);
        expect(typeof row.client_ids).toBe('string');
        expect(JSON.parse(row.client_ids)).toEqual([3, 7, 12]);
    });

    it('set error cuando la API falla y no hay caché', async () => {
        window.electronAPI.db.getAll = vi.fn().mockResolvedValue([]);
        getGastosByCaso.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useGastosCaso(20));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.error).not.toBeNull();
        });

        expect(result.current.gastos).toEqual([]);
    });

    it('puede reutilizar solo la caché inicial sin llamar a la API', async () => {
        const cacheRows = [makeGastoRow(1, 20, 300)];

        window.electronAPI.db.getAll = vi.fn().mockResolvedValue(cacheRows);
        window.electronAPI.db.upsertMany = vi.fn().mockResolvedValue(undefined);

        const { result } = renderHook(() => useGastosCaso(20, { skipInitialFetch: true }));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.gastos).toHaveLength(1);
        });

        expect(getGastosByCaso).not.toHaveBeenCalled();
        expect(window.electronAPI.db.upsertMany).not.toHaveBeenCalled();
    });
});
