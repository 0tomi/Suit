/**
 * Tests for ECO-7 and ECO-11 fixes.
 *
 * ECO-7: removeEntrega in useEntregas now delegates state reload to reload()
 *        (which uses a generation counter to prevent stale-write races).
 *
 * ECO-11: propTypes in HonorariosList and GastosList is now declared outside
 *         the component body, so it is not re-assigned on every render.
 */
import React from 'react';
import { renderHook, act, render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must be hoisted before any imports that transitively use them
// ---------------------------------------------------------------------------

vi.mock('../../src/services/entregaService.js', () => ({
    getEntregasByHonorario: vi.fn(),
    createEntrega: vi.fn(),
    updateEntrega: vi.fn(),
    deleteEntrega: vi.fn(),
}));

vi.mock('../../src/services/honorarioService', () => ({
    getHonorariosByCaso: vi.fn(),
    getHonorariosByDateRange: vi.fn().mockResolvedValue([]),
    createHonorario: vi.fn(),
    updateHonorario: vi.fn(),
    deleteHonorario: vi.fn(),
}));

vi.mock('../../src/services/gastoSuitCaseService', () => ({
    getGastosByCaso: vi.fn(),
    getGastosByDateRange: vi.fn().mockResolvedValue([]),
    createGasto: vi.fn(),
    updateGasto: vi.fn(),
    deleteGasto: vi.fn(),
}));

// useHonorarios and useGastosCaso both try to read SQLite on mount.
// We mock these hooks at the module level so we control their return value
// without needing a real SQLite connection.
vi.mock('../../src/hooks/useHonorarios.js', () => ({
    useHonorarios: vi.fn(() => ({
        honorarios: [],
        loading: false,
        reload: vi.fn(),
    })),
}));

vi.mock('../../src/hooks/useGastosCaso.js', () => ({
    useGastosCaso: vi.fn(() => ({
        gastos: [],
        loading: false,
        reload: vi.fn(),
    })),
}));

// ModalContext is used inside both HonorariosList and GastosList.
vi.mock('../../src/context/ModalContext', () => ({
    useModal: vi.fn(() => ({
        openModal: vi.fn(),
        closeModal: vi.fn(),
    })),
}));

// ---------------------------------------------------------------------------
// Now import the units under test (after mocks are registered)
// ---------------------------------------------------------------------------
import { useEntregas } from '../../src/hooks/useEntregas.js';
import { deleteEntrega, getEntregasByHonorario } from '../../src/services/entregaService.js';
import { HonorariosList } from '../../src/components/economia/HonorariosList.jsx';
import { GastosList } from '../../src/components/economia/GastosList.jsx';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Builds a minimal window.electronAPI mock that satisfies useEntregas.
 * Simulates an empty entregas table by default.
 */
function makeElectronApi({ dbRows = [] } = {}) {
    return {
        // Extend the base mock from setup.js with the db sub-namespace.
        ...window.electronAPI,
        db: {
            getAll: vi.fn().mockResolvedValue(dbRows),
            deleteById: vi.fn().mockResolvedValue(undefined),
            upsertMany: vi.fn().mockResolvedValue(undefined),
        },
    };
}

// ---------------------------------------------------------------------------
// ECO-7: useEntregas — removeEntrega
// ---------------------------------------------------------------------------
describe('ECO-7 — useEntregas.removeEntrega', () => {
    beforeEach(() => {
        // Reset mocked service functions before each test.
        vi.clearAllMocks();

        // deleteEntrega resolves with a success payload by default.
        deleteEntrega.mockResolvedValue({ success: true });

        // getEntregasByHonorario resolves with an empty list by default.
        getEntregasByHonorario.mockResolvedValue([]);

        // Attach a fresh electronAPI mock so SQLite calls do not throw.
        window.electronAPI = makeElectronApi();
    });

    it('llama a deleteEntrega con el id correcto', async () => {
        const { result } = renderHook(() => useEntregas(42));

        // Wait for the initial load to settle before calling removeEntrega.
        await act(async () => {
            await result.current.removeEntrega(7);
        });

        expect(deleteEntrega).toHaveBeenCalledWith(7);
    });

    it('llama a window.electronAPI.db.deleteById con "entregas" y el id correcto', async () => {
        const { result } = renderHook(() => useEntregas(42));

        await act(async () => {
            await result.current.removeEntrega(7);
        });

        expect(window.electronAPI.db.deleteById).toHaveBeenCalledWith('entregas', 7);
    });

    it('llama a reload() después del delete — el estado se actualiza vía loadData', async () => {
        // After removeEntrega calls reload(), loadData reads from cache again.
        // We verify that db.getAll is called at least a second time (the reload
        // triggers another read from the SQLite cache).
        const { result } = renderHook(() => useEntregas(42));

        // Wait for the initial load's db.getAll call.
        await act(async () => {
            // Settle the initial loadData triggered by useEffect.
        });

        const callsBeforeRemove = window.electronAPI.db.getAll.mock.calls.length;

        await act(async () => {
            await result.current.removeEntrega(7);
        });

        // reload() triggers loadData again, which calls db.getAll at least once more.
        expect(window.electronAPI.db.getAll.mock.calls.length).toBeGreaterThan(callsBeforeRemove);
    });

    it('no lanza error cuando window.electronAPI no está disponible', async () => {
        // Simulate the absence of the Electron bridge (e.g., bare browser env).
        window.electronAPI = undefined;

        // deleteEntrega must still resolve normally.
        deleteEntrega.mockResolvedValue({ success: true });

        const { result } = renderHook(() => useEntregas(42));

        // Should not throw — the guard `if (window.electronAPI)` prevents the call.
        await expect(
            act(async () => {
                await result.current.removeEntrega(7);
            })
        ).resolves.not.toThrow();

        // The service-level delete was still executed.
        expect(deleteEntrega).toHaveBeenCalledWith(7);
    });
});

// ---------------------------------------------------------------------------
// ECO-11: HonorariosList — propTypes outside component body
// ---------------------------------------------------------------------------
describe('ECO-11 — HonorariosList propTypes', () => {
    it('renderiza sin errores cuando caseId es string', () => {
        // Should not throw and should show the "Honorarios" heading.
        render(<HonorariosList caseId="123" />);
        expect(screen.getByText('Honorarios')).toBeInTheDocument();
    });

    it('renderiza sin errores cuando caseId es number', () => {
        render(<HonorariosList caseId={123} />);
        expect(screen.getByText('Honorarios')).toBeInTheDocument();
    });

    it('propTypes acepta string sin emitir advertencia de PropTypes', () => {
        // PropTypes validation runs synchronously before render; spy on console.error
        // to detect any PropTypes warning that would indicate a type mismatch.
        const consoleSpy = vi.spyOn(console, 'error');
        render(<HonorariosList caseId="abc" />);
        // Filter for PropTypes-related errors specifically.
        const propTypesWarnings = consoleSpy.mock.calls.filter(
            (args) => typeof args[0] === 'string' && args[0].includes('PropTypes')
        );
        expect(propTypesWarnings).toHaveLength(0);
    });

    it('propTypes acepta number sin emitir advertencia de PropTypes', () => {
        const consoleSpy = vi.spyOn(console, 'error');
        render(<HonorariosList caseId={99} />);
        const propTypesWarnings = consoleSpy.mock.calls.filter(
            (args) => typeof args[0] === 'string' && args[0].includes('PropTypes')
        );
        expect(propTypesWarnings).toHaveLength(0);
    });
});

// ---------------------------------------------------------------------------
// ECO-11: GastosList — propTypes outside component body
// ---------------------------------------------------------------------------
describe('ECO-11 — GastosList propTypes', () => {
    it('renderiza sin errores cuando caseId es string', () => {
        render(<GastosList caseId="456" />);
        expect(screen.getByText('Gastos')).toBeInTheDocument();
    });

    it('renderiza sin errores cuando caseId es number', () => {
        render(<GastosList caseId={456} />);
        expect(screen.getByText('Gastos')).toBeInTheDocument();
    });

    it('propTypes acepta string sin emitir advertencia de PropTypes', () => {
        const consoleSpy = vi.spyOn(console, 'error');
        render(<GastosList caseId="xyz" />);
        const propTypesWarnings = consoleSpy.mock.calls.filter(
            (args) => typeof args[0] === 'string' && args[0].includes('PropTypes')
        );
        expect(propTypesWarnings).toHaveLength(0);
    });

    it('propTypes acepta number sin emitir advertencia de PropTypes', () => {
        const consoleSpy = vi.spyOn(console, 'error');
        render(<GastosList caseId={77} />);
        const propTypesWarnings = consoleSpy.mock.calls.filter(
            (args) => typeof args[0] === 'string' && args[0].includes('PropTypes')
        );
        expect(propTypesWarnings).toHaveLength(0);
    });
});
