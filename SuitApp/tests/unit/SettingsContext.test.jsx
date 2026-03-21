import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { SettingsProvider, useSettings } from '../../src/context/SettingsContext.jsx';

let authState = { user: { id: 1 } };

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

function wrapper({ children }) {
    return <SettingsProvider>{children}</SettingsProvider>;
}

describe('SettingsContext', () => {
    beforeEach(() => {
        localStorage.clear();
        authState = { user: { id: 1 } };
    });

    it('aisla configuraciones por usuario', async () => {
        localStorage.setItem('suit-settings:user:1', JSON.stringify({
            sidebarMode: 'click',
        }));
        localStorage.setItem('suit-settings:user:2', JSON.stringify({
            sidebarMode: 'alwaysOpen',
        }));

        const { result, rerender } = renderHook(() => useSettings(), { wrapper });
        expect(result.current.sidebarMode).toBe('click');

        authState = { user: { id: 2 } };
        rerender();

        await waitFor(() => {
            expect(result.current.sidebarMode).toBe('alwaysOpen');
        });
    });

    it('persiste cambios en la clave del usuario activo', () => {
        const { result } = renderHook(() => useSettings(), { wrapper });

        act(() => {
            result.current.setSidebarMode('alwaysClosed');
        });

        const rawUser1 = localStorage.getItem('suit-settings:user:1');
        const rawUser2 = localStorage.getItem('suit-settings:user:2');

        expect(rawUser1).toBeTruthy();
        expect(JSON.parse(rawUser1).sidebarMode).toBe('alwaysClosed');
        expect(rawUser2).toBeNull();
    });

    it('migra la clave legacy solo para el primer usuario y la elimina', async () => {
        localStorage.setItem('suit-settings', JSON.stringify({
            sidebarMode: 'click',
        }));

        const { result, rerender } = renderHook(() => useSettings(), { wrapper });
        expect(result.current.sidebarMode).toBe('click');
        expect(localStorage.getItem('suit-settings')).toBeNull();
        expect(localStorage.getItem('suit-settings:user:1')).toBeTruthy();

        authState = { user: { id: 2 } };
        rerender();

        await waitFor(() => {
            expect(result.current.sidebarMode).toBe('hover');
        });
    });

    it('expone tutoriales visibles por default y persiste cambios del toggle', () => {
        const { result } = renderHook(() => useSettings(), { wrapper });

        expect(result.current.showTutorials).toBe(true);

        act(() => {
            result.current.setShowTutorials(false);
        });

        expect(result.current.showTutorials).toBe(false);
        expect(JSON.parse(localStorage.getItem('suit-settings:user:1'))).toEqual(
            expect.objectContaining({ showTutorials: false }),
        );
    });
});
