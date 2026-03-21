import { renderHook, waitFor, act } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { useEntityDetail } from '../../src/hooks/useEntityDetail.js';

function deferred() {
    let resolve;
    let reject;

    const promise = new Promise((res, rej) => {
        resolve = res;
        reject = rej;
    });

    return { promise, resolve, reject };
}

describe('useEntityDetail', () => {
    it('prioriza items sobre initialEntity y evita fetch innecesario', () => {
        const fetchById = vi.fn();
        const items = [{ id: 7, name: 'Caso desde contexto' }];

        const { result } = renderHook(() => useEntityDetail({
            id: '7',
            items,
            fetchById,
            initialEntity: { id: 7, name: 'Snapshot viejo' },
            notFoundMessage: 'Caso no encontrado.',
            loadErrorMessage: 'Error al cargar caso.',
        }));

        expect(result.current.entity).toEqual(items[0]);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBeNull();
        expect(fetchById).not.toHaveBeenCalled();
    });

    it('usa initialEntity si no hay match en items y luego sincroniza con contexto fresco', async () => {
        const fetchById = vi.fn();
        const initialEntity = { id: 12, name: 'Snapshot inicial' };
        const freshEntity = { id: 12, name: 'Dato fresco de contexto', status: 'closed' };

        const { result, rerender } = renderHook(
            ({ items }) => useEntityDetail({
                id: '12',
                items,
                fetchById,
                initialEntity,
                notFoundMessage: 'Caso no encontrado.',
                loadErrorMessage: 'Error al cargar caso.',
            }),
            { initialProps: { items: [] } }
        );

        expect(result.current.entity).toEqual(initialEntity);
        expect(result.current.loading).toBe(false);
        expect(fetchById).not.toHaveBeenCalled();

        rerender({ items: [freshEntity] });

        await waitFor(() => {
            expect(result.current.entity).toEqual(freshEntity);
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
        });
    });

    it('hace fetch cuando no hay dato local y expone not found y reload', async () => {
        const fetchById = vi
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce({ id: 4, name: 'Cliente recuperado' });

        const { result } = renderHook(() => useEntityDetail({
            id: '4',
            items: [],
            fetchById,
            initialEntity: null,
            notFoundMessage: 'Cliente no encontrado.',
            loadErrorMessage: 'Error al cargar cliente.',
        }));

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBe('Cliente no encontrado.');
            expect(result.current.entity).toBeNull();
        });

        await act(async () => {
            await result.current.reload();
        });

        await waitFor(() => {
            expect(result.current.loading).toBe(false);
            expect(result.current.error).toBeNull();
            expect(result.current.entity).toEqual({ id: 4, name: 'Cliente recuperado' });
        });
    });

    it('ignora respuestas viejas cuando cambia el id', async () => {
        const firstRequest = deferred();
        const secondRequest = deferred();
        const fetchById = vi.fn((id) => {
            if (String(id) === '1') return firstRequest.promise;
            return secondRequest.promise;
        });

        const { result, rerender } = renderHook(
            ({ id }) => useEntityDetail({
                id,
                items: [],
                fetchById,
                initialEntity: null,
                notFoundMessage: 'No encontrado.',
                loadErrorMessage: 'Error.',
            }),
            { initialProps: { id: '1' } }
        );

        rerender({ id: '2' });

        await act(async () => {
            secondRequest.resolve({ id: 2, name: 'Segundo' });
            await secondRequest.promise;
        });

        await waitFor(() => {
            expect(result.current.entity).toEqual({ id: 2, name: 'Segundo' });
            expect(result.current.error).toBeNull();
            expect(result.current.loading).toBe(false);
        });

        await act(async () => {
            firstRequest.resolve({ id: 1, name: 'Primero tardio' });
            await firstRequest.promise;
        });

        expect(result.current.entity).toEqual({ id: 2, name: 'Segundo' });
        expect(result.current.error).toBeNull();
        expect(result.current.loading).toBe(false);
    });
});
