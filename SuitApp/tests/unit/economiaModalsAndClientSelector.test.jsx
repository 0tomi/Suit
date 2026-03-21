import React from 'react';
import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
    casesState: { cases: [] },
    gastoCatalogoState: { gastos_catalogo: [] },
    clientsContextState: { clients: [], error: '', syncing: false },
    useCaseClientsOptions: vi.fn(),
    createHonorario: vi.fn(),
    createGastoCaso: vi.fn(),
    showAppToast: vi.fn(),
    openModal: vi.fn(),
    closeModalById: vi.fn(),
    logger: {
        error: vi.fn(),
        warn: vi.fn(),
        info: vi.fn(),
        debug: vi.fn(),
    },
}));

vi.mock('../../src/context/CasesContext.jsx', () => ({
    useCases: () => mocks.casesState,
}));

vi.mock('../../src/context/GastoCatalogoContext.jsx', () => ({
    useGastoCatalogo: () => mocks.gastoCatalogoState,
}));

vi.mock('../../src/context/ClientsContext.jsx', () => ({
    useClients: () => mocks.clientsContextState,
}));

vi.mock('../../src/hooks/useCaseClientsOptions.js', () => ({
    useCaseClientsOptions: (...args) => mocks.useCaseClientsOptions(...args),
}));

vi.mock('../../src/services/honorarioService.js', () => ({
    createHonorario: (...args) => mocks.createHonorario(...args),
}));

vi.mock('../../src/services/gastoSuitCaseService.js', () => ({
    createGastoCaso: (...args) => mocks.createGastoCaso(...args),
}));

vi.mock('../../src/context/ModalContext.jsx', () => ({
    useModal: () => ({
        openModal: mocks.openModal,
        closeModal: mocks.closeModalById,
    }),
}));

vi.mock('../../src/services/logService.js', () => ({
    createLogger: () => mocks.logger,
}));

vi.mock('../../src/components/ui/show-app-toast', () => ({
    showAppToast: (...args) => mocks.showAppToast(...args),
}));

vi.mock('../../src/components/ui/Select', async () => {
    const ReactModule = await import('react');
    const SelectContext = ReactModule.createContext(null);

    function extractText(children) {
        if (typeof children === 'string' || typeof children === 'number') {
            return String(children);
        }

        return ReactModule.Children.toArray(children)
            .map((child) => {
                if (ReactModule.isValidElement(child)) {
                    return extractText(child.props.children);
                }

                return typeof child === 'string' || typeof child === 'number'
                    ? String(child)
                    : '';
            })
            .join(' ')
            .replace(/\s+/g, ' ')
            .trim();
    }

    function readPlaceholder(children) {
        const childArray = ReactModule.Children.toArray(children);
        const selectValueNode = childArray.find((child) => ReactModule.isValidElement(child));
        return selectValueNode?.props?.placeholder || 'Seleccionar...';
    }

    function Select({ value, onValueChange, disabled = false, children }) {
        const childArray = ReactModule.Children.toArray(children);
        const contentNode = childArray.find((child) => child.type?.displayName === 'MockSelectContent');
        const options = ReactModule.Children.toArray(contentNode?.props?.children)
            .filter((child) => ReactModule.isValidElement(child))
            .map((child) => ({
                value: String(child.props.value),
                label: extractText(child.props.children),
            }));

        return (
            <SelectContext.Provider value={{ value: value || '', onValueChange, disabled, options }}>
                {childArray.filter((child) => child.type?.displayName !== 'MockSelectContent')}
            </SelectContext.Provider>
        );
    }

    function SelectTrigger({ children, id, className = '', ...props }) {
        const context = ReactModule.useContext(SelectContext);
        const placeholder = readPlaceholder(children);

        return (
            <select
                id={id}
                value={context?.value || ''}
                onChange={(event) => context?.onValueChange?.(event.target.value)}
                disabled={context?.disabled}
                className={className}
                {...props}
            >
                <option value="">{placeholder}</option>
                {(context?.options || []).map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        );
    }

    function SelectValue() {
        return null;
    }

    function SelectContent({ children }) {
        return <>{children}</>;
    }
    SelectContent.displayName = 'MockSelectContent';

    function SelectItem() {
        return null;
    }

    return {
        Select,
        SelectTrigger,
        SelectValue,
        SelectContent,
        SelectItem,
    };
});

import { NewHonorarioModal } from '../../src/components/economia/NewHonorarioModal.jsx';
import { NewGastoModal } from '../../src/components/economia/NewGastoModal.jsx';
import { SelectClientModal } from '../../src/components/clients/SelectClientModal.jsx';

function submitByButtonName(buttonName) {
    const submitButton = screen.getByRole('button', { name: buttonName });
    const form = submitButton.closest('form');

    if (!form) {
        throw new Error(`No se encontró el form para el botón "${buttonName}".`);
    }

    fireEvent.submit(form);
}

describe('Modales de economía y selector de clientes', () => {
    const caseClientsMap = {
        1: [{ id: 10, first_name: 'Ana', last_name: 'Uno' }],
        2: [{ id: 20, first_name: 'Pedro', last_name: 'Dos' }],
    };

    beforeEach(() => {
        vi.clearAllMocks();

        mocks.casesState.cases = [
            { id: 1, title: 'Caso Uno' },
            { id: 2, title: 'Caso Dos' },
        ];
        mocks.gastoCatalogoState.gastos_catalogo = [
            { id: 99, titulo: 'Tasa de justicia' },
        ];
        mocks.clientsContextState.clients = [];
        mocks.clientsContextState.error = '';
        mocks.clientsContextState.syncing = false;
        mocks.useCaseClientsOptions.mockImplementation((selectedCaseId) => ({
            clients: caseClientsMap[selectedCaseId] || [],
            loading: false,
            error: '',
        }));
        mocks.createHonorario.mockResolvedValue({ ok: true });
        mocks.createGastoCaso.mockResolvedValue({ ok: true });
    });

    it('NewHonorarioModal muestra banner y errores inline para campos obligatorios', async () => {
        render(<NewHonorarioModal closeModal={vi.fn()} onSuccess={vi.fn()} />);

        submitByButtonName('Crear Honorario');

        await waitFor(() => {
            expect(screen.getByTestId('new-honorario-error-banner')).toHaveTextContent(
                'Seleccioná un caso. Seleccioná un cliente. El monto debe ser mayor a cero.'
            );
        });

        expect(screen.getByText('Seleccioná un caso.')).toBeInTheDocument();
        expect(screen.getByText('Seleccioná un cliente.')).toBeInTheDocument();
        expect(screen.getByText('El monto debe ser mayor a cero.')).toBeInTheDocument();
        expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'No se pudo crear el honorario',
            variant: 'danger',
        }));
    });

    it('NewHonorarioModal filtra clientes por caso y limpia el cliente al cambiar de caso', () => {
        render(<NewHonorarioModal closeModal={vi.fn()} onSuccess={vi.fn()} />);

        const caseSelect = screen.getByLabelText(/Caso/i);
        const clientSelect = screen.getByLabelText(/Cliente/i);

        fireEvent.change(caseSelect, { target: { value: '1' } });
        expect(within(clientSelect).getByRole('option', { name: 'Ana Uno' })).toBeInTheDocument();

        fireEvent.change(clientSelect, { target: { value: '10' } });
        expect(clientSelect).toHaveValue('10');

        fireEvent.change(caseSelect, { target: { value: '2' } });

        expect(clientSelect).toHaveValue('');
        expect(within(clientSelect).queryByRole('option', { name: 'Ana Uno' })).not.toBeInTheDocument();
        expect(within(clientSelect).getByRole('option', { name: 'Pedro Dos' })).toBeInTheDocument();
    });

    it('NewGastoModal muestra banner rojo si el backend rechaza el alta y mantiene el error dentro del modal', async () => {
        mocks.createGastoCaso.mockResolvedValue({
            ok: false,
            error: 'Backend rechazó el gasto.',
        });

        render(<NewGastoModal closeModal={vi.fn()} onSuccess={vi.fn()} />);

        fireEvent.change(screen.getByLabelText(/Caso/i), { target: { value: '1' } });
        fireEvent.change(screen.getByLabelText(/Tipo de Gasto/i), { target: { value: '99' } });
        fireEvent.change(screen.getByLabelText(/Cliente/i), { target: { value: '10' } });
        fireEvent.change(screen.getByLabelText(/Monto/i), { target: { value: '1500' } });
        submitByButtonName('Crear Gasto');

        await waitFor(() => {
            expect(screen.getByTestId('new-gasto-error-banner')).toHaveTextContent('Backend rechazó el gasto.');
        });

        expect(mocks.showAppToast).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Error',
            description: 'Backend rechazó el gasto.',
            variant: 'danger',
        }));
    });

    it('NewGastoModal vuelve a pedir cliente cuando cambia el caso seleccionado', async () => {
        render(<NewGastoModal closeModal={vi.fn()} onSuccess={vi.fn()} />);

        const caseSelect = screen.getByLabelText(/Caso/i);
        const clientSelect = screen.getByLabelText(/Cliente/i);

        fireEvent.change(caseSelect, { target: { value: '1' } });
        fireEvent.change(clientSelect, { target: { value: '10' } });
        fireEvent.change(caseSelect, { target: { value: '2' } });

        submitByButtonName('Crear Gasto');

        await waitFor(() => {
            expect(screen.getByTestId('new-gasto-error-banner')).toHaveTextContent('Seleccioná un tipo de gasto. Seleccioná un cliente. El monto debe ser mayor a cero.');
        });

        expect(clientSelect).toHaveValue('');
        expect(within(clientSelect).getByRole('option', { name: 'Pedro Dos' })).toBeInTheDocument();
    });

    it('SelectClientModal muestra un banner visible si falla la carga de clientes', () => {
        mocks.clientsContextState.error = 'Timeout de sincronización';

        render(
            <SelectClientModal
                closeModal={vi.fn()}
                onClientSelected={vi.fn()}
            />
        );

        expect(screen.getByTestId('select-client-error-banner')).toHaveTextContent(
            'No se pudieron cargar los clientes: Timeout de sincronización'
        );
        expect(screen.getByText('No hay clientes disponibles para seleccionar.')).toBeInTheDocument();
    });
});
