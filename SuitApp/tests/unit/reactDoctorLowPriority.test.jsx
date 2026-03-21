import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ModalProvider, useModal } from '../../src/context/ModalContext.jsx';

vi.mock('framer-motion', () => ({
  AnimatePresence: ({ children }) => <>{children}</>,
  LazyMotion: ({ children }) => <>{children}</>,
  domAnimation: {},
  m: {
    div: ({ children, ...props }) => <div {...props}>{children}</div>,
  },
}));

function DummyModal() {
  return <div data-testid="dummy-modal-content">Contenido modal</div>;
}

function Harness() {
  const { openModal } = useModal();
  return <button type="button" onClick={() => openModal(DummyModal)}>Abrir</button>;
}

describe('ModalContext with LazyMotion', () => {
  it('abre y cierra modal por overlay', () => {
    render(
      <ModalProvider>
        <Harness />
      </ModalProvider>
    );

    fireEvent.click(screen.getByRole('button', { name: 'Abrir' }));
    const overlay = screen.getByRole('button', { name: 'Cerrar modal' });
    expect(overlay).toBeInTheDocument();

    fireEvent.click(overlay);
    expect(screen.queryByRole('button', { name: 'Cerrar modal' })).not.toBeInTheDocument();
  });
});
