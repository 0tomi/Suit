import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LinkPopover from '../../src/components/Editor/LinkPopover.jsx';
import { HotkeysHelpModal } from '../../src/components/ui/HotkeysHelpModal.jsx';
import { CaseReportView } from '../../src/components/cases/CaseReportView.jsx';

vi.mock('../../src/hotkeys/useHotkeysSystem', () => ({
  useHotkeysSystem: () => ({
    currentScope: 'editor',
    hotkeysConfig: [
      { id: 'h1', desc: 'Guardar', keys: 'Ctrl+S', scope: 'global' },
    ],
  }),
}));

describe('react-doctor quick low-risk fixes', () => {
  it('inicializa LinkPopover sin derivar useState desde props y mantiene foco en el input', async () => {
    render(
      <LinkPopover
        isOpen
        currentUrl="https://example.com"
        onConfirm={vi.fn()}
        onClose={vi.fn()}
      />
    );

    const input = screen.getByPlaceholderText('https://ejemplo.com');
    await waitFor(() => {
      expect(input).toHaveValue('https://example.com');
    });
    expect(document.activeElement).toBe(input);
  });

  it('HotkeysHelpModal cierra con overlay/teclado y no al clickear contenido interno', () => {
    const onClose = vi.fn();
    render(<HotkeysHelpModal isOpen onClose={onClose} />);

    fireEvent.click(screen.getByText('Guardar'));
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.keyDown(screen.getByRole('button', { name: 'Cerrar ayuda de atajos' }), { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('CaseReportView renderiza estilos de impresión sin dangerouslySetInnerHTML', () => {
    render(
      <CaseReportView
        data={{
          generatedAt: '2026-03-20',
          caseData: { title: 'Caso demo', created_at: '2026-01-01' },
          participants: [],
          clients: [],
          events: [],
          honorarios: [],
          gastos: [],
          documents: [],
          multimedia: [],
          files: [],
          partes: [],
        }}
      />
    );

    expect(screen.getByText('Ficha Ejecutiva del Expediente')).toBeInTheDocument();
    expect(document.querySelector('#case-report-content style')?.textContent).toContain('@media print');
  });
});
