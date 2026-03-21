import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import SettingsCacheResetRow from '../../src/components/settings/SettingsCacheResetRow.jsx';

const runResync = vi.fn();
const showAppToast = vi.fn();
let hookState = {
    pendingUploadsCount: 0,
    resyncing: false,
    disabled: false,
    runResync,
};

vi.mock('../../src/hooks/useProfileCacheResync.js', () => ({
    useProfileCacheResync: () => hookState,
}));

vi.mock('../../src/components/ui/show-app-toast.jsx', () => ({
    showAppToast: (...args) => showAppToast(...args),
}));

describe('SettingsCacheResetRow', () => {
    beforeEach(() => {
        runResync.mockReset();
        showAppToast.mockReset();
        hookState = {
            pendingUploadsCount: 0,
            resyncing: false,
            disabled: false,
            runResync,
        };
    });

    it('deshabilita el botón cuando el resync no está disponible', () => {
        hookState = {
            ...hookState,
            disabled: true,
        };

        render(<SettingsCacheResetRow />);

        expect(screen.getByTestId('settings-clear-cache-button')).toBeDisabled();
        expect(screen.getByText(/Disponible solo cuando la app está conectada/i)).toBeInTheDocument();
    });

    it('muestra advertencia extra si hay cambios pendientes de subir', async () => {
        hookState = {
            ...hookState,
            pendingUploadsCount: 2,
        };

        render(<SettingsCacheResetRow />);
        fireEvent.click(screen.getByTestId('settings-clear-cache-button'));

        expect(await screen.findByText('¿Borrar cache?')).toBeInTheDocument();
        expect(screen.getByText(/Hay 2 cambios locales pendientes de subirse/i)).toBeInTheDocument();
    });

    it('ejecuta el resync y muestra toast de éxito al confirmar', async () => {
        runResync.mockResolvedValue(undefined);

        render(<SettingsCacheResetRow />);
        fireEvent.click(screen.getByTestId('settings-clear-cache-button'));
        const confirmButtons = await screen.findAllByRole('button', { name: 'Borrar cache' });
        fireEvent.click(confirmButtons.at(-1));

        await waitFor(() => {
            expect(runResync).toHaveBeenCalledTimes(1);
        });

        expect(showAppToast).toHaveBeenCalledWith(expect.objectContaining({
            title: '¡Resincronizado con exito!',
            variant: 'success',
        }));
    });
});
