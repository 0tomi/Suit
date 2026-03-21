import React from 'react';
import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const probeServer = vi.fn();
const setApiBase = vi.fn();
const isElectron = vi.fn();
const startupMark = vi.fn();

vi.mock('../../src/services/api.js', () => ({
    probeServer: (...args) => probeServer(...args),
    setApiBase: (...args) => setApiBase(...args),
}));

vi.mock('../../src/utils/platform.js', () => ({
    isElectron: (...args) => isElectron(...args),
}));

vi.mock('../../src/utils/startupMetrics.js', () => ({
    startupMark: (...args) => startupMark(...args),
}));

import { ApiProvider, useApi } from '../../src/context/ApiContext.jsx';

function wrapper({ children }) {
    return <ApiProvider>{children}</ApiProvider>;
}

describe('ApiContext', () => {
    beforeEach(() => {
        probeServer.mockReset();
        setApiBase.mockReset();
        isElectron.mockReset();
        startupMark.mockReset();

        isElectron.mockReturnValue(true);
        window.electronAPI = {
            config: {
                get: vi.fn(),
                set: vi.fn().mockResolvedValue(undefined),
            },
            discovery: {
                findServer: vi.fn(),
            },
        };
    });

    it('intenta autodiscovery durante bootstrap cuando no hay configuración guardada', async () => {
        window.electronAPI.config.get
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        window.electronAPI.discovery.findServer.mockResolvedValue({
            ok: true,
            host: '192.168.1.25',
            port: 8000,
        });
        probeServer.mockResolvedValue(true);

        const { result } = renderHook(() => useApi(), { wrapper });

        await waitFor(() => {
            expect(result.current.connected).toBe(true);
        });

        expect(window.electronAPI.discovery.findServer).toHaveBeenCalledTimes(1);
        expect(probeServer).toHaveBeenCalledWith('192.168.1.25', 8000);
        expect(window.electronAPI.config.set).toHaveBeenCalledWith('api_host', '192.168.1.25');
        expect(window.electronAPI.config.set).toHaveBeenCalledWith('api_port', '8000');
        expect(result.current.showSetup).toBe(false);
    });

    it('intenta autodiscovery antes de mostrar unavailable cuando la config guardada no responde', async () => {
        window.electronAPI.config.get
            .mockResolvedValueOnce('10.0.0.3')
            .mockResolvedValueOnce('9000');
        window.electronAPI.discovery.findServer.mockResolvedValue({
            ok: false,
            reason: 'timeout',
            message: 'No se encontró ningún servidor SuitAPI en la red local.',
        });
        probeServer.mockResolvedValue(false);

        const { result } = renderHook(() => useApi(), { wrapper });

        await waitFor(() => {
            expect(result.current.showServerUnavailableAlert).toBe(true);
        });

        expect(window.electronAPI.discovery.findServer).toHaveBeenCalledTimes(1);
        expect(probeServer).toHaveBeenCalledWith('10.0.0.3', '9000');
    });

    it('discoverAndConnect conserva host y port cuando el probe HTTP falla', async () => {
        window.electronAPI.config.get
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null);
        window.electronAPI.discovery.findServer.mockResolvedValueOnce({
            ok: false,
            reason: 'timeout',
            message: 'No se encontró ningún servidor SuitAPI en la red local.',
        }).mockResolvedValueOnce({
            ok: true,
            host: '192.168.1.30',
            port: 8010,
        });
        probeServer
            .mockResolvedValueOnce(false)
            .mockResolvedValueOnce(false);

        const { result } = renderHook(() => useApi(), { wrapper });

        await waitFor(() => {
            expect(result.current.showSetup).toBe(true);
        });

        let discoveryResult;
        await act(async () => {
            discoveryResult = await result.current.discoverAndConnect();
        });

        expect(discoveryResult).toEqual({
            ok: false,
            reason: 'probe-failed',
            message: 'Se encontro SuitAPI en 192.168.1.30:8010, pero la API HTTP no respondio.',
            host: '192.168.1.30',
            port: 8010,
        });
    });
});
