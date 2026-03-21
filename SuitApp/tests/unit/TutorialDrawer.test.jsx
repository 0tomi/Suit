import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';

// --- Mocks hoisted (se ejecutan antes de cualquier import) ---

// vaul: mockeamos el Drawer para que renderice en el DOM sin portal nativo de Radix
const DrawerContext = React.createContext({ onOpenChange: () => { } });

vi.mock('vaul', () => ({
    Drawer: {
        Root: ({ open, onOpenChange, children }) =>
            open
                ? React.createElement(
                    DrawerContext.Provider,
                    { value: { onOpenChange } },
                    React.createElement('div', { 'data-testid': 'vaul-root' }, children),
                )
                : null,
        Portal: ({ children }) => React.createElement('div', null, children),
        Overlay: () => React.createElement('div', { 'data-testid': 'vaul-overlay' }),
        Content: ({ children, className, style }) =>
            React.createElement('div', { 'data-testid': 'vaul-content', className, style }, children),
        Title: ({ children, className }) =>
            React.createElement('h2', { 'data-testid': 'vaul-title', className }, children),
        Close: ({ children }) => {
            const { onOpenChange } = React.useContext(DrawerContext);
            return React.cloneElement(children, {
                onClick: (...args) => {
                    children.props.onClick?.(...args);
                    onOpenChange?.(false);
                },
            });
        },
    },
}));

// embla-carousel-react: la libreria real devuelve un api ESTABLE (via ref/state internos).
// El mock DEBE devolver el mismo objeto en cada llamada para evitar un loop infinito
// de re-renders: emblaApi cambia → onSelect se recrea → useEffect corre → setState → render → loop.
// Usamos vi.hoisted para que stableApi exista antes de que vi.mock sea hoisted por Vitest.
const stableApi = vi.hoisted(() => ({
    selectedScrollSnap: () => 0,
    scrollSnapList: () => [0, 1, 2],
    canScrollPrev: () => false,
    canScrollNext: () => true,
    scrollPrev: vi.fn(),
    scrollNext: vi.fn(),
    scrollTo: vi.fn(),
    on: vi.fn(),
    off: vi.fn(),
}));

vi.mock('embla-carousel-react', () => ({
    // Devuelve siempre la misma referencia de api para mantener estabilidad referencial
    default: () => [() => {}, stableApi],
}));

// --- Importes del componente (despues de los mocks) ---
import { TutorialDrawer } from '../../src/components/ui/TutorialDrawer.jsx';

const MOCK_STEPS = [
    { image: 'data:image/png;base64,abc1', description: 'Descripcion del paso uno' },
    { image: 'data:image/png;base64,abc2', description: 'Descripcion del paso dos' },
    { image: 'data:image/png;base64,abc3', description: 'Descripcion del paso tres' },
];

describe('TutorialDrawer', () => {
    let onClose;

    beforeEach(() => {
        onClose = vi.fn();
        vi.clearAllMocks();
    });

    it('renderiza el drawer cuando open=true', () => {
        render(React.createElement(TutorialDrawer, { steps: MOCK_STEPS, open: true, onClose }));
        expect(screen.getByTestId('vaul-content')).toBeInTheDocument();
        expect(screen.getByTestId('vaul-title')).toHaveTextContent('Tutorial');
    });

    it('no renderiza nada cuando open=false', () => {
        render(React.createElement(TutorialDrawer, { steps: MOCK_STEPS, open: false, onClose }));
        expect(screen.queryByTestId('vaul-content')).not.toBeInTheDocument();
    });

    it('muestra la descripcion del primer paso al abrir', () => {
        render(React.createElement(TutorialDrawer, { steps: MOCK_STEPS, open: true, onClose }));
        expect(screen.getByText('Descripcion del paso uno')).toBeInTheDocument();
    });

    it('renderiza el boton de cierre debajo de la descripcion', () => {
        render(React.createElement(TutorialDrawer, { steps: MOCK_STEPS, open: true, onClose }));
        expect(screen.getByRole('button', { name: 'Cerrar tutorial' })).toBeInTheDocument();
    });

    it('no renderiza progress bar', () => {
        render(React.createElement(TutorialDrawer, { steps: MOCK_STEPS, open: true, onClose }));
        expect(screen.queryByRole('progressbar')).not.toBeInTheDocument();
    });

    it('el boton de cierre llama a onClose', () => {
        render(React.createElement(TutorialDrawer, { steps: MOCK_STEPS, open: true, onClose }));
        fireEvent.click(screen.getByRole('button', { name: 'Cerrar tutorial' }));
        expect(onClose).toHaveBeenCalledTimes(1);
    });

    it('muestra N dots segun la cantidad de pasos', async () => {
        render(React.createElement(TutorialDrawer, { steps: MOCK_STEPS, open: true, onClose }));
        await waitFor(() => {
            expect(screen.getAllByRole('button', { name: /ir al paso/i })).toHaveLength(3);
        });
        const dots = screen.getAllByRole('button', { name: /ir al paso/i });
        expect(dots).toHaveLength(3);
    });
});
