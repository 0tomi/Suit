import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * CONTEXTO:
 * - `HonorariosList` usa `useHonorarios` solo en detalle de caso.
 * - En vista global ahora agrega honorarios iterando casos y llamando `getHonorariosByCaso`.
 * - `GastosList` sigue usando el endpoint global por rango.
 *
 * RIESGO CUBIERTO:
 * - Que la regresión deje vacía la pestaña global de honorarios por seguir esperando
 *   un endpoint admin-only.
 */
const {
    openModal,
    reloadHonorarios,
    reloadGastos,
    getHonorariosByCaso,
    getHonorariosByDateRange,
    getGastosByDateRange,
    cases,
    clients,
    gastosCatalogo,
} = vi.hoisted(() => ({
    openModal: vi.fn(),
    reloadHonorarios: vi.fn(),
    reloadGastos: vi.fn(),
    getHonorariosByCaso: vi.fn(),
    getHonorariosByDateRange: vi.fn(),
    getGastosByDateRange: vi.fn(),
    cases: [
        { id: 77, title: 'Caso Uno' },
        { id: 88, title: 'Caso Dos' },
    ],
    clients: [
        { id: 33, first_name: 'Lucia', last_name: 'Gomez' },
    ],
    gastosCatalogo: [
        { id: 10, titulo: 'Tasa de justicia' },
    ],
}));

vi.mock('../../src/context/ModalContext', () => ({
    useModal: () => ({ openModal }),
}));

vi.mock('../../src/context/AuthContext', () => ({
    useAuth: vi.fn(() => ({ user: { role: 'user' } })),
}));

vi.mock('../../src/context/UsersContext.jsx', () => ({
    useUsers: vi.fn(() => ({ users: [] })),
}));

vi.mock('../../src/components/ui/Table', () => ({
    Table: ({ children, isEmpty, emptyMessage, columns }) => (
        <table>
            <thead>
                <tr>
                    {columns.map((column) => (
                        <th key={column.header}>{column.header}</th>
                    ))}
                </tr>
            </thead>
            <tbody>
                {isEmpty ? (
                    <tr>
                        <td>{emptyMessage}</td>
                    </tr>
                ) : children}
            </tbody>
        </table>
    ),
}));

vi.mock('../../src/hooks/useHonorarios.js', () => ({
    useHonorarios: vi.fn(() => ({
        honorarios: [
            {
                id: 1,
                suit_case_id: 77,
                client: { first_name: 'Ana', last_name: 'Pérez' },
                monto: 1500,
                pagado: false,
                created_at: '2026-03-18T00:00:00.000Z',
            },
        ],
        loading: false,
        reload: reloadHonorarios,
    })),
}));

vi.mock('../../src/context/ClientsContext.jsx', () => ({
    useClients: vi.fn(() => ({ clients })),
}));

vi.mock('../../src/context/GastoCatalogoContext.jsx', () => ({
    useGastoCatalogo: vi.fn(() => ({ gastos_catalogo: gastosCatalogo })),
}));

vi.mock('../../src/context/CasesContext.jsx', () => ({
    useCases: vi.fn(() => ({ cases })),
}));

vi.mock('../../src/hooks/useGastosCaso.js', () => ({
    useGastosCaso: vi.fn(() => ({
        gastos: [
            {
                id: 2,
                suit_case_id: 77,
                gasto: { titulo: 'Tasa de justicia' },
                monto: 500,
                created_at: '2026-03-18T00:00:00.000Z',
            },
        ],
        loading: false,
        reload: reloadGastos,
    })),
}));

vi.mock('../../src/services/honorarioService', () => ({
    getHonorariosByCaso,
    getHonorariosByDateRange,
}));

vi.mock('../../src/services/gastoSuitCaseService', () => ({
    getGastosByDateRange,
}));

import { HonorariosList } from '../../src/components/economia/HonorariosList.jsx';
import { GastosList } from '../../src/components/economia/GastosList.jsx';

describe('Economía por caso usa hooks cache-first', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('HonorariosList muestra datos del hook y evita fetch global por rango cuando recibe caseId', async () => {
        render(<HonorariosList caseId={77} />);

        await waitFor(() => {
            expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
        });

        expect(screen.queryByText('Caso')).not.toBeInTheDocument();
        expect(getHonorariosByCaso).not.toHaveBeenCalled();
    });

    it('HonorariosList resuelve el nombre del cliente desde ClientsContext cuando la API no expandió client', async () => {
        const { useHonorarios } = await import('../../src/hooks/useHonorarios.js');
        useHonorarios.mockReturnValueOnce({
            honorarios: [
                {
                    id: 9,
                    suit_case_id: 77,
                    client_id: 33,
                    client: null,
                    monto: '1756.00',
                    pagado: false,
                    created_at: '2026-03-18T00:00:00.000Z',
                },
            ],
            loading: false,
            reload: reloadHonorarios,
        });

        render(<HonorariosList caseId={77} />);

        await waitFor(() => {
            expect(screen.getByText('Lucia Gomez')).toBeInTheDocument();
        });
    });

    it('HonorariosList global agrega honorarios por rango y muestra el caso asociado', async () => {
        getHonorariosByDateRange.mockResolvedValue([
            {
                id: 10,
                suit_case_id: 77,
                client: { first_name: 'Ana', last_name: 'Pérez' },
                monto: '1500.00',
                pagado: false,
                created_at: '2026-03-18T00:00:00.000Z',
            },
            {
                id: 11,
                suit_case_id: 88,
                client_id: 33,
                monto: '2000.00',
                pagado: true,
                created_at: '2026-03-17T00:00:00.000Z',
            },
        ]);

        const { useHonorarios } = await import('../../src/hooks/useHonorarios.js');
        useHonorarios.mockReturnValueOnce({
            honorarios: [],
            loading: false,
            reload: reloadHonorarios,
        });

        render(<HonorariosList />);

        await waitFor(() => {
            expect(screen.getByText('Caso Uno')).toBeInTheDocument();
            expect(screen.getByText('Caso Dos')).toBeInTheDocument();
            expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
            expect(screen.getByText('Lucia Gomez')).toBeInTheDocument();
        });

        expect(getHonorariosByDateRange).toHaveBeenCalledTimes(1);
    });

    it('GastosList muestra datos del hook y evita fetch global por rango cuando recibe caseId', async () => {
        render(<GastosList caseId={77} />);

        await waitFor(() => {
            expect(screen.getByText('Tasa de justicia')).toBeInTheDocument();
        });

        expect(screen.queryByText('Caso')).not.toBeInTheDocument();
        expect(getGastosByDateRange).not.toHaveBeenCalled();
    });

    it('GastosList resuelve el tipo de gasto desde GastoCatalogoContext cuando el gasto cacheado solo trae gasto_id', async () => {
        const { useGastosCaso } = await import('../../src/hooks/useGastosCaso.js');
        useGastosCaso.mockReturnValueOnce({
            gastos: [
                {
                    id: 12,
                    suit_case_id: 77,
                    gasto_id: 10,
                    gasto: null,
                    monto: '850.00',
                    created_at: '2026-03-18T00:00:00.000Z',
                },
            ],
            loading: false,
            reload: reloadGastos,
        });

        render(<GastosList caseId={77} />);

        await waitFor(() => {
            expect(screen.getByText('Tasa de justicia')).toBeInTheDocument();
        });
    });
});
