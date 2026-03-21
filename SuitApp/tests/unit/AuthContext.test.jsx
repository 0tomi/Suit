import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiLogin = vi.fn();
const apiLogout = vi.fn();
const validateToken = vi.fn();
const setAuthToken = vi.fn();
const subscribeApiState = vi.fn(() => () => { });
const clearApiRequestState = vi.fn();
const loadSaved = vi.fn();
const savePersistent = vi.fn();
const deletePersistent = vi.fn();
const resetNotificationSyncInFlightState = vi.fn();
const resetAgendaMonthSyncInFlightState = vi.fn();
const resetSyncInFlightState = vi.fn();

let apiContextState = {
    connected: false,
    loading: false,
};

vi.mock('../../src/services/authService.js', () => ({
    login: (...args) => apiLogin(...args),
    logout: (...args) => apiLogout(...args),
    validateToken: (...args) => validateToken(...args),
}));

vi.mock('../../src/services/api.js', () => ({
    clearApiRequestState: (...args) => clearApiRequestState(...args),
    setAuthToken: (...args) => setAuthToken(...args),
    subscribeApiState: (...args) => subscribeApiState(...args),
}));

vi.mock('../../src/utils/platform.js', () => ({
    loadSaved: (...args) => loadSaved(...args),
    savePersistent: (...args) => savePersistent(...args),
    deletePersistent: (...args) => deletePersistent(...args),
}));

vi.mock('../../src/services/eventNotificationService.js', () => ({
    resetNotificationSyncInFlightState: (...args) => resetNotificationSyncInFlightState(...args),
}));

vi.mock('../../src/services/sync/agendaMonthSyncService.js', () => ({
    resetAgendaMonthSyncInFlightState: (...args) => resetAgendaMonthSyncInFlightState(...args),
}));

vi.mock('../../src/services/sync/syncCore.js', () => ({
    resetSyncInFlightState: (...args) => resetSyncInFlightState(...args),
}));

vi.mock('../../src/context/ApiContext.jsx', () => ({
    useApi: () => apiContextState,
}));

import { AuthProvider, useAuth } from '../../src/context/AuthContext.jsx';

function Probe() {
    const { user, logout } = useAuth();

    return (
        <div>
            <div data-testid="user-id">{user?.id ?? 'none'}</div>
            <button onClick={() => logout()}>logout</button>
        </div>
    );
}

describe('AuthContext', () => {
    beforeEach(() => {
        globalThis.window = globalThis.window || {};
        apiContextState = { connected: false, loading: false };
        apiLogin.mockReset();
        apiLogout.mockReset();
        validateToken.mockReset();
        setAuthToken.mockReset();
        subscribeApiState.mockReset();
        clearApiRequestState.mockReset();
        loadSaved.mockReset();
        savePersistent.mockReset();
        deletePersistent.mockReset();
        resetNotificationSyncInFlightState.mockReset();
        resetAgendaMonthSyncInFlightState.mockReset();
        resetSyncInFlightState.mockReset();

        subscribeApiState.mockImplementation(() => () => { });
        loadSaved.mockImplementation(async (key) => {
            if (key === 'auth_user') return JSON.stringify({ id: 7, tag: 'cached-user' });
            return null;
        });
        deletePersistent.mockResolvedValue(undefined);
        savePersistent.mockResolvedValue(undefined);
        apiLogout.mockRejectedValue(new Error('offline'));

        window.electronAPI = {
            notifications: {
                clearStateForCurrentUser: vi.fn().mockRejectedValue(new Error('notification reset failed')),
            },
            profiles: {
                activateRemoteUser: vi.fn().mockResolvedValue({ id: 7 }),
                deactivate: vi.fn().mockResolvedValue(true),
            },
        };
    });

    it('garantiza limpieza de sesión aunque falle clearStateForCurrentUser', async () => {
        render(
            <AuthProvider>
                <Probe />
            </AuthProvider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('user-id')).toHaveTextContent('7');
        });

        fireEvent.click(screen.getByText('logout'));

        await waitFor(() => {
            expect(deletePersistent).toHaveBeenCalledWith('auth_token');
            expect(deletePersistent).toHaveBeenCalledWith('auth_user');
            expect(window.electronAPI.profiles.deactivate).toHaveBeenCalledTimes(1);
        });

        expect(setAuthToken).toHaveBeenCalledWith(null, { reason: 'logout' });
        expect(clearApiRequestState).toHaveBeenCalled();
        expect(resetSyncInFlightState).toHaveBeenCalled();
        expect(resetAgendaMonthSyncInFlightState).toHaveBeenCalled();
        expect(resetNotificationSyncInFlightState).toHaveBeenCalled();
    });
});
