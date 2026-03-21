import React, { StrictMode, useEffect, useState } from 'react';
import { act, render, screen, waitFor, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

let authState = { user: { id: 1, tag: 'test' }, authEpoch: 1 };
const setSyncStatus = vi.fn();

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/context/SyncStatusContext.jsx', () => ({
    useSyncStatus: () => ({ setSyncStatus }),
}));

import { createResourceContext } from '../../src/context/createResourceContext.jsx';

const dbRows = [
    {
        id: 7,
        title: 'Expediente de prueba',
        data_json: JSON.stringify({
            id: 7,
            title: 'Expediente de prueba',
            parties: [{ id: 1, name: 'Parte Demo' }],
        }),
    },
];

function mountResourceContext({ resourceName = 'Cases', syncFn = vi.fn().mockResolvedValue(undefined), parseRows } = {}) {
    return createResourceContext({
        resourceName,
        syncFn,
        parseRows,
        autoRefreshOnMount: true,
    });
}

function createElectronApiMock(rows = dbRows) {
    return {
        db: {
            getAll: vi.fn().mockResolvedValue(rows),
        },
    };
}

describe('createResourceContext', () => {
    beforeEach(() => {
        authState = { user: { id: 1, tag: 'test' }, authEpoch: 1 };
        setSyncStatus.mockReset();
        window.electronAPI = createElectronApiMock();
    });

    it('carga el payload inicial, expone el estado base y permite refrescar', async () => {
        const syncFn = vi.fn().mockResolvedValue(undefined);
        const parseRows = vi.fn((rows) => rows.map((row) => ({ ...row, parsed: true })));
        const { Provider, useResource } = mountResourceContext({ syncFn, parseRows });

        function Probe() {
            const context = useResource();

            return (
                <div>
                    <div data-testid="count">{context.cases.length}</div>
                    <div data-testid="initialized">{String(context.initialized)}</div>
                    <div data-testid="syncing">{String(context.syncing)}</div>
                    <div data-testid="parsed">{String(context.cases[0]?.parsed ?? false)}</div>
                    <button onClick={() => context.refreshCases()}>refresh</button>
                </div>
            );
        }

        render(
            <Provider>
                <Probe />
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('count')).toHaveTextContent('1');
            expect(screen.getByTestId('initialized')).toHaveTextContent('true');
            expect(screen.getByTestId('parsed')).toHaveTextContent('true');
        });

        expect(parseRows).toHaveBeenCalled();
        expect(syncFn).toHaveBeenCalledTimes(1);
        expect(window.electronAPI.db.getAll).toHaveBeenCalledTimes(2);
        expect(setSyncStatus).toHaveBeenCalledWith('Cases', true);
        expect(setSyncStatus).toHaveBeenCalledWith('Cases', false);

        fireEvent.click(screen.getByText('refresh'));

        await waitFor(() => {
            expect(syncFn).toHaveBeenCalledTimes(2);
            expect(window.electronAPI.db.getAll).toHaveBeenCalledTimes(3);
        });
    });

    it('memoiza el valor del contexto ante rerenders ajenos al provider', async () => {
        const syncFn = vi.fn().mockResolvedValue(undefined);
        const { Provider, useResource } = mountResourceContext({ syncFn });
        const onContextChange = vi.fn();

        function Probe() {
            const context = useResource();

            useEffect(() => {
                onContextChange(context);
            }, [context]);

            return <div data-testid="value-ready">{String(context.initialized)}</div>;
        }

        function Harness() {
            const [tick, setTick] = useState(0);

            return (
                <div>
                    <button onClick={() => setTick((value) => value + 1)}>rerender</button>
                    <span data-testid="tick">{tick}</span>
                    <Provider>
                        <Probe />
                    </Provider>
                </div>
            );
        }

        render(<Harness />);

        await waitFor(() => {
            expect(screen.getByTestId('value-ready')).toHaveTextContent('true');
            expect(onContextChange).toHaveBeenCalled();
        });

        onContextChange.mockClear();
        fireEvent.click(screen.getByText('rerender'));

        expect(screen.getByTestId('tick')).toHaveTextContent('1');
        expect(onContextChange).not.toHaveBeenCalled();
    });

    it('evita duplicar la sincronizacion inicial bajo StrictMode', async () => {
        const syncFn = vi.fn().mockResolvedValue(undefined);
        const { Provider, useResource } = mountResourceContext({ syncFn });

        function Probe() {
            const context = useResource();
            return <div data-testid="initialized">{String(context.initialized)}</div>;
        }

        render(
            <StrictMode>
                <Provider>
                    <Probe />
                </Provider>
            </StrictMode>
        );

        await waitFor(() => {
            expect(screen.getByTestId('initialized')).toHaveTextContent('true');
            expect(syncFn).toHaveBeenCalledTimes(1);
        });
    });

    it('descarta cargas locales stale al cambiar authEpoch', async () => {
        let resolveFirstLoad;
        const firstLoadPromise = new Promise((resolve) => {
            resolveFirstLoad = resolve;
        });
        let readCount = 0;

        window.electronAPI = {
            db: {
                getAll: vi.fn(async () => {
                    readCount += 1;
                    if (readCount === 1) {
                        await firstLoadPromise;
                        return [{
                            id: 1,
                            title: 'Caso viejo',
                            data_json: JSON.stringify({ id: 1, title: 'Caso viejo' }),
                        }];
                    }
                    return [{
                        id: 2,
                        title: 'Caso nuevo',
                        data_json: JSON.stringify({ id: 2, title: 'Caso nuevo' }),
                    }];
                }),
            },
        };

        const syncFn = vi.fn().mockResolvedValue(undefined);
        const { Provider, useResource } = mountResourceContext({ syncFn });

        function Probe() {
            const context = useResource();
            return <div data-testid="first-case-title">{context.cases[0]?.title || ''}</div>;
        }

        const rendered = render(
            <Provider>
                <Probe />
            </Provider>
        );

        authState = { user: { id: 2, tag: 'other' }, authEpoch: 2 };
        rendered.rerender(
            <Provider>
                <Probe />
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('first-case-title')).toHaveTextContent('Caso nuevo');
        });

        await act(async () => {
            resolveFirstLoad();
            await Promise.resolve();
        });

        await waitFor(() => {
            expect(screen.getByTestId('first-case-title')).toHaveTextContent('Caso nuevo');
        });
    });

    it('expone refreshData y aliases normalizados para recursos en snake_case', async () => {
        const syncFn = vi.fn().mockResolvedValue(undefined);
        const { Provider, useResource } = mountResourceContext({
            resourceName: 'tipo_pagos',
            syncFn,
        });

        function Probe() {
            const context = useResource();

            return (
                <div>
                    <div data-testid="has-refresh-data">{String(typeof context.refreshData === 'function')}</div>
                    <div data-testid="has-refresh-normalized">{String(typeof context.refreshTipoPagos === 'function')}</div>
                    <div data-testid="has-refresh-legacy">{String(typeof context.refreshtipo_pagos === 'function')}</div>
                </div>
            );
        }

        render(
            <Provider>
                <Probe />
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('has-refresh-data')).toHaveTextContent('true');
            expect(screen.getByTestId('has-refresh-normalized')).toHaveTextContent('true');
            expect(screen.getByTestId('has-refresh-legacy')).toHaveTextContent('true');
        });
    });

    it('permite desactivar la sincronizacion automatica al montar', async () => {
        const syncFn = vi.fn().mockResolvedValue(undefined);
        const { Provider, useResource } = createResourceContext({
            resourceName: 'Files',
            syncFn,
            autoRefreshOnMount: false,
        });

        function Probe() {
            const context = useResource();

            return (
                <div>
                    <div data-testid="initialized">{String(context.initialized)}</div>
                    <div data-testid="count">{context.files.length}</div>
                    <button onClick={() => context.refreshFiles()}>refresh-files</button>
                </div>
            );
        }

        render(
            <Provider>
                <Probe />
            </Provider>
        );

        await waitFor(() => {
            expect(screen.getByTestId('initialized')).toHaveTextContent('true');
            expect(screen.getByTestId('count')).toHaveTextContent('1');
        });

        expect(syncFn).not.toHaveBeenCalled();
        expect(window.electronAPI.db.getAll).toHaveBeenCalledTimes(1);

        fireEvent.click(screen.getByText('refresh-files'));

        await waitFor(() => {
            expect(syncFn).toHaveBeenCalledTimes(1);
            expect(window.electronAPI.db.getAll).toHaveBeenCalledTimes(2);
        });
    });
});
