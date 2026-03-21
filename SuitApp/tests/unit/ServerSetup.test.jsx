import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiState = {
    apiHost: null,
    apiPort: null,
    saveAndConnect: vi.fn(),
    discoverAndConnect: vi.fn(),
    showSetup: true,
    setShowSetup: vi.fn(),
};

const isElectron = vi.fn();

vi.mock('../../src/context/ApiContext.jsx', () => ({
    useApi: () => apiState,
}));

vi.mock('../../src/utils/platform.js', () => ({
    isElectron: (...args) => isElectron(...args),
}));

import ServerSetup from '../../src/components/ServerSetup.jsx';

describe('ServerSetup', () => {
    beforeEach(() => {
        apiState.apiHost = null;
        apiState.apiPort = null;
        apiState.showSetup = true;
        apiState.setShowSetup.mockReset();
        apiState.saveAndConnect.mockReset();
        apiState.discoverAndConnect.mockReset();
        isElectron.mockReset();
        isElectron.mockReturnValue(true);
    });

    it('ejecuta autodiscovery al abrirse el modal', async () => {
        apiState.discoverAndConnect.mockResolvedValue({
            ok: false,
            reason: 'timeout',
            message: 'No se encontró ningún servidor SuitAPI en la red local.',
        });

        render(<ServerSetup />);

        await waitFor(() => {
            expect(apiState.discoverAndConnect).toHaveBeenCalledTimes(1);
        });
        expect(await screen.findByText('No se encontró ningún servidor SuitAPI en la red local.')).toBeInTheDocument();
    });

    it('prefill host y puerto cuando discovery encuentra servidor pero el probe falla', async () => {
        apiState.discoverAndConnect.mockResolvedValue({
            ok: false,
            reason: 'probe-failed',
            message: 'Se encontro SuitAPI en 192.168.1.30:8010, pero la API HTTP no respondio.',
            host: '192.168.1.30',
            port: 8010,
        });

        render(<ServerSetup />);

        await waitFor(() => {
            expect(screen.getByDisplayValue('192.168.1.30')).toBeInTheDocument();
            expect(screen.getByDisplayValue('8010')).toBeInTheDocument();
        });
    });

    it('permite reintentar discovery manualmente después del intento automático', async () => {
        apiState.discoverAndConnect
            .mockResolvedValueOnce({
                ok: false,
                reason: 'timeout',
                message: 'No se encontró ningún servidor SuitAPI en la red local.',
            })
            .mockResolvedValueOnce({
                ok: false,
                reason: 'timeout',
                message: 'No se encontró ningún servidor SuitAPI en la red local.',
            });

        render(<ServerSetup />);

        await waitFor(() => {
            expect(apiState.discoverAndConnect).toHaveBeenCalledTimes(1);
        });

        const discoveryButton = screen.getByTestId('server-setup-discovery');
        await waitFor(() => {
            expect(discoveryButton).toBeEnabled();
        });

        fireEvent.click(discoveryButton);

        await waitFor(() => {
            expect(apiState.discoverAndConnect).toHaveBeenCalledTimes(2);
        });
    });
});
