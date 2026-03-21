/**
 * Tests unitarios para el hook useHonorarios.
 *
 * CONTEXTO:
 * - El hook carga honorarios de un caso desde SQLite primero, luego sincroniza con la API.
 * - Operaciones CRUD: addHonorario, editHonorario, removeHonorario.
 * - Usa requestGenerationRef para evitar race conditions.
 *
 * PUNTOS CRÍTICOS:
 * - El estado inicial se muestra desde caché antes de que la API responda.
 * - Con caseId null/undefined retorna array vacío y loading false.
 * - removeHonorario actualiza la caché local sin esperar reload completo.
 */

import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock de los servicios de honorarios antes de importar el hook
vi.mock('../../src/services/honorarioService.js', () => ({
    getHonorariosByCaso: vi.fn(),
    createHonorario: vi.fn(),
    updateHonorario: vi.fn(),
    deleteHonorario: vi.fn(),
}));

import { useHonorarios } from '../../src/hooks/useHonorarios.js';
import {
    getHonorariosByCaso,
    createHonorario,
    updateHonorario,
    deleteHonorario,
} from '../../src/services/honorarioService.js';

/** Construye fila de caché simulada con data_json para parseJsonRows. */
function makeHonorarioRow(id, caseId, monto = 1000) {
    const obj = { id, suit_case_id: caseId, monto, detalles: null, pagado: false, client_id: null, total_entregas: 0 };
    return { ...obj, data_json: JSON.stringify(obj), synced_at: '2026-01-01' };
}

describe('useHonorarios', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('con caseId null, retorna array vacío y loading false inmediatamente', async () => {
        const { result } = renderHook(() => useHonorarios(null));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        expect(result.current.honorarios).toEqual([]);
        expect(result.current.error).toBeNull();
    });

    it('carga desde caché primero, luego actualiza con datos de la API', async () => {
        const cacheRows = [makeHonorarioRow(1, 10, 500)];
        const apiRows = [makeHonorarioRow(1, 10, 600), makeHonorarioRow(2, 10, 200)];

        // Primera llamada a getAll devuelve la caché; segunda devuelve los datos frescos tras upsert
        window.electronAPI.db = {
            getAll: vi.fn()
                .mockResolvedValueOnce(cacheRows)   // lectura inicial de caché
                .mockResolvedValueOnce(apiRows),    // lectura tras upsert
            upsertMany: vi.fn().mockResolvedValue(undefined),
        };

        getHonorariosByCaso.mockResolvedValue(apiRows);

        const { result } = renderHook(() => useHonorarios(10));

        // Primero, datos de caché deben aparecer con loading false
        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.honorarios.length).toBeGreaterThan(0);
        });

        // Esperar sincronización completa con la API
        await waitFor(() => {
            expect(result.current.honorarios.length).toBe(2);
        });

        expect(getHonorariosByCaso).toHaveBeenCalledWith(10);
        expect(window.electronAPI.db.upsertMany).toHaveBeenCalledWith(
            'honorarios',
            expect.arrayContaining([expect.objectContaining({ suit_case_id: 10 })])
        );
    });

    it('acepta la forma real { data: [...] } al sincronizar desde la API', async () => {
        const apiRows = [makeHonorarioRow(1, 10, 600), makeHonorarioRow(2, 10, 200)];

        window.electronAPI.db = {
            getAll: vi.fn()
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce(apiRows),
            upsertMany: vi.fn().mockResolvedValue(undefined),
        };

        getHonorariosByCaso.mockResolvedValue({ data: apiRows });

        const { result } = renderHook(() => useHonorarios(10));

        await waitFor(() => {
            expect(window.electronAPI.db.upsertMany).toHaveBeenCalledWith(
                'honorarios',
                expect.arrayContaining([expect.objectContaining({ suit_case_id: 10 })])
            );
        });

        await waitFor(() => {
            expect(result.current.honorarios.length).toBe(2);
        });
    });

    it('filtra los honorarios por suit_case_id al leer de caché', async () => {
        // La tabla tiene honorarios de dos casos distintos
        const allRows = [
            makeHonorarioRow(1, 10, 500),
            makeHonorarioRow(2, 99, 300), // otro caso — no debe aparecer
        ];

        window.electronAPI.db = {
            getAll: vi.fn().mockResolvedValue(allRows),
            upsertMany: vi.fn().mockResolvedValue(undefined),
        };

        getHonorariosByCaso.mockResolvedValue([makeHonorarioRow(1, 10, 500)]);

        const { result } = renderHook(() => useHonorarios(10));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
        });

        // Solo el honorario del caso 10 debe aparecer en la carga inicial
        const ids = result.current.honorarios.map((h) => h.suit_case_id);
        expect(ids.every((id) => String(id) === '10')).toBe(true);
    });

    it('addHonorario llama a createHonorario y recarga', async () => {
        const cacheRows = [makeHonorarioRow(1, 10, 500)];

        window.electronAPI.db = {
            getAll: vi.fn().mockResolvedValue(cacheRows),
            upsertMany: vi.fn().mockResolvedValue(undefined),
        };

        getHonorariosByCaso.mockResolvedValue(cacheRows);
        createHonorario.mockResolvedValue({ id: 2, suit_case_id: 10, monto: 1000 });

        const { result } = renderHook(() => useHonorarios(10));

        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.addHonorario({ monto: 1000 });
        });

        expect(createHonorario).toHaveBeenCalledWith(10, { monto: 1000 });
        // Verifica que se volvió a sincronizar (getHonorariosByCaso llamado al menos 2 veces)
        expect(getHonorariosByCaso.mock.calls.length).toBeGreaterThanOrEqual(2);
    });

    it('editHonorario llama a updateHonorario y recarga', async () => {
        window.electronAPI.db = {
            getAll: vi.fn().mockResolvedValue([makeHonorarioRow(1, 10, 500)]),
            upsertMany: vi.fn().mockResolvedValue(undefined),
        };

        getHonorariosByCaso.mockResolvedValue([makeHonorarioRow(1, 10, 999)]);
        updateHonorario.mockResolvedValue({ id: 1, monto: 999 });

        const { result } = renderHook(() => useHonorarios(10));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.editHonorario(1, { monto: 999 });
        });

        expect(updateHonorario).toHaveBeenCalledWith(1, { monto: 999 });
    });

    it('removeHonorario llama a deleteHonorario y elimina de la caché local', async () => {
        const cacheRows = [makeHonorarioRow(1, 10, 500), makeHonorarioRow(2, 10, 300)];

        window.electronAPI.db = {
            getAll: vi.fn()
                .mockResolvedValueOnce(cacheRows)
                .mockResolvedValueOnce(cacheRows)  // primera sync
                .mockResolvedValueOnce([makeHonorarioRow(2, 10, 300)]),  // tras deleteById
            upsertMany: vi.fn().mockResolvedValue(undefined),
            deleteById: vi.fn().mockResolvedValue(undefined),
        };

        getHonorariosByCaso.mockResolvedValue(cacheRows);
        deleteHonorario.mockResolvedValue({ ok: true });

        const { result } = renderHook(() => useHonorarios(10));
        await waitFor(() => expect(result.current.loading).toBe(false));

        await act(async () => {
            await result.current.removeHonorario(1);
        });

        expect(deleteHonorario).toHaveBeenCalledWith(1);
        expect(window.electronAPI.db.deleteById).toHaveBeenCalledWith('honorarios', 1);
    });

    it('set error cuando la API falla y no hay caché', async () => {
        window.electronAPI.db = {
            getAll: vi.fn().mockResolvedValue([]),  // caché vacía
            upsertMany: vi.fn().mockResolvedValue(undefined),
        };

        getHonorariosByCaso.mockRejectedValue(new Error('Network error'));

        const { result } = renderHook(() => useHonorarios(10));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.error).not.toBeNull();
        });
    });

    it('puede reutilizar solo la caché inicial sin llamar a la API', async () => {
        const cacheRows = [makeHonorarioRow(1, 10, 500)];

        window.electronAPI.db = {
            getAll: vi.fn().mockResolvedValue(cacheRows),
            upsertMany: vi.fn().mockResolvedValue(undefined),
        };

        const { result } = renderHook(() => useHonorarios(10, { skipInitialFetch: true }));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.honorarios).toHaveLength(1);
        });

        expect(getHonorariosByCaso).not.toHaveBeenCalled();
        expect(window.electronAPI.db.upsertMany).not.toHaveBeenCalled();
    });
});
