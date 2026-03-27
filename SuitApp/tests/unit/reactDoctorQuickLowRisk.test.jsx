import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import LinkPopover from '../../src/components/Editor/LinkPopover.jsx';
import { HotkeysHelpModal } from '../../src/components/ui/HotkeysHelpModal.jsx';
import { CaseReportView } from '../../src/components/cases/CaseReportView.jsx';
import { getCaseReportData } from '../../src/services/caseDetailService.js';

const {
  mockGetCaseTypes,
  mockGetCase,
  mockGetParticipants,
  mockGetCaseClients,
  mockGetCaseAgenda,
  mockGetHonorariosByCaso,
  mockGetGastosByCaso,
  mockGetDocuments,
  mockGetPartesByCaso,
  mockGetRadicaciones,
  mockResolverDependencia,
  mockGetCaseTipoExpedientes,
  mockApiGet,
} = vi.hoisted(() => ({
  mockGetCaseTypes: vi.fn(),
  mockGetCase: vi.fn(),
  mockGetParticipants: vi.fn(),
  mockGetCaseClients: vi.fn(),
  mockGetCaseAgenda: vi.fn(),
  mockGetHonorariosByCaso: vi.fn(),
  mockGetGastosByCaso: vi.fn(),
  mockGetDocuments: vi.fn(),
  mockGetPartesByCaso: vi.fn(),
  mockGetRadicaciones: vi.fn(),
  mockResolverDependencia: vi.fn(),
  mockGetCaseTipoExpedientes: vi.fn(),
  mockApiGet: vi.fn(),
}));

vi.mock('../../src/hotkeys/useHotkeysSystem', () => ({
  useHotkeysSystem: () => ({
    currentScope: 'editor',
    hotkeysConfig: [
      { id: 'h1', desc: 'Guardar', keys: 'Ctrl+S', scope: 'global' },
    ],
  }),
}));

vi.mock('../../src/services/adminService.js', () => ({
  getCaseTypes: mockGetCaseTypes,
}));

vi.mock('../../src/services/caseService.js', () => ({
  getCase: mockGetCase,
  getParticipants: mockGetParticipants,
  getCaseClients: mockGetCaseClients,
  getCaseAgenda: mockGetCaseAgenda,
}));

vi.mock('../../src/services/honorarioService.js', () => ({
  getHonorariosByCaso: mockGetHonorariosByCaso,
}));

vi.mock('../../src/services/gastoSuitCaseService.js', () => ({
  getGastosByCaso: mockGetGastosByCaso,
}));

vi.mock('../../src/services/documentService.js', () => ({
  getDocuments: mockGetDocuments,
}));

vi.mock('../../src/services/parteService.js', () => ({
  getPartesByCaso: mockGetPartesByCaso,
}));

vi.mock('../../src/services/radicacionService.js', () => ({
  getRadicaciones: mockGetRadicaciones,
}));

vi.mock('../../src/services/dependenciaJudicialService.js', () => ({
  resolverDependencia: mockResolverDependencia,
}));

vi.mock('../../src/services/tipoExpedienteService.js', () => ({
  getCaseTipoExpedientes: mockGetCaseTipoExpedientes,
}));

vi.mock('../../src/services/api.js', () => ({
  apiGet: mockApiGet,
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

    fireEvent.keyDown(screen.getByRole('dialog'), { key: 'Escape' });
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

  it('CaseReportView usa el contrato vigente de clientes para renderizar nombre e identificación', () => {
    render(
      <CaseReportView
        data={{
          generatedAt: '2026-03-20',
          caseData: { title: 'Caso demo', created_at: '2026-01-01' },
          participants: [],
          clients: [
            { id: 7, first_name: 'Ana', last_name: 'Pérez', identification_number: '30111222' },
          ],
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

    expect(screen.getByText('Ana Pérez')).toBeInTheDocument();
    expect(screen.getByText('30111222')).toBeInTheDocument();
  });

  it('CaseReportView muestra metadatos judiciales explícitos del reporte', () => {
    render(
      <CaseReportView
        data={{
          generatedAt: '2026-03-20',
          caseData: { title: 'Caso demo', created_at: '2026-01-01' },
          caseMetadata: {
            fuero: 'Laboral',
            tipoExpedientes: ['Despido', 'Accidente laboral'],
            radicacion: 'Federal',
            jurisdiccion: 'Rosario',
            dependencia: 'Juzgado Laboral N° 2',
          },
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

    expect(screen.getByText('Fuero')).toBeInTheDocument();
    expect(screen.getByText('Laboral')).toBeInTheDocument();
    expect(screen.getByText('Despido')).toBeInTheDocument();
    expect(screen.getByText('Accidente laboral')).toBeInTheDocument();
    expect(screen.getByText('Federal')).toBeInTheDocument();
    expect(screen.getByText('Rosario')).toBeInTheDocument();
    expect(screen.getByText('Juzgado Laboral N° 2')).toBeInTheDocument();
  });

  it('getCaseReportData obtiene partes y resuelve metadatos judiciales del caso', async () => {
    mockGetCaseTypes.mockResolvedValueOnce({ data: [{ id: 9, name: 'Laboral' }] });
    mockGetCase.mockResolvedValueOnce({ id: 12, title: 'Caso demo', case_type_id: 9, radicacion_id: 3, dependencia_id: 44 });
    mockGetParticipants.mockResolvedValueOnce([{ id: 1, tag: 'test' }]);
    mockGetCaseClients.mockResolvedValueOnce([
      { id: 3, first_name: 'Ana', last_name: 'Pérez', identification_number: '30111222' },
    ]);
    mockGetCaseAgenda.mockResolvedValueOnce({ events: [{ id: 91, title: 'Audiencia' }] });
    mockGetHonorariosByCaso.mockResolvedValueOnce([{ id: 20, monto: 1000 }]);
    mockGetGastosByCaso.mockResolvedValueOnce([{ id: 30, monto: 500 }]);
    mockGetDocuments.mockResolvedValueOnce([{ id: 40, suit_case_id: 12 }]);
    mockGetCaseTipoExpedientes.mockResolvedValueOnce({ data: [{ id: 5, titulo: 'Despido' }] });
    mockGetRadicaciones.mockResolvedValueOnce({ data: [{ id: 3, tipo: 'Federal' }] });
    mockResolverDependencia.mockResolvedValueOnce({
      id: 44,
      nombre_juzgado: 'Juzgado Laboral N° 2',
      jurisdiccion: { nombre: 'Rosario' },
    });
    mockGetPartesByCaso.mockResolvedValueOnce([
      { id: 50, nombre: 'Perito', apellido: 'López', rol_titulo: 'Perito' },
    ]);
    mockApiGet
      .mockResolvedValueOnce({ ok: true, data: [{ id: 60, suit_case_id: 12 }] })
      .mockResolvedValueOnce({ ok: true, data: [{ id: 70, suit_case_id: 12 }] })
      .mockResolvedValueOnce({ ok: true, data: [{ id: 80, monto: 250 }] });

    const reportData = await getCaseReportData(12);

    expect(mockGetPartesByCaso).toHaveBeenCalledWith(12);
    expect(reportData.clients).toEqual([
      { id: 3, first_name: 'Ana', last_name: 'Pérez', identification_number: '30111222' },
    ]);
    expect(reportData.partes).toEqual([
      { id: 50, nombre: 'Perito', apellido: 'López', rol_titulo: 'Perito' },
    ]);
    expect(reportData.documents).toEqual([{ id: 40, suit_case_id: 12 }]);
    expect(reportData.multimedia).toEqual([{ id: 60, suit_case_id: 12 }]);
    expect(reportData.files).toEqual([{ id: 70, suit_case_id: 12 }]);
    expect(reportData.honorarios[0].entregas).toEqual([{ id: 80, monto: 250 }]);
    expect(reportData.caseMetadata).toEqual({
      fuero: 'Laboral',
      tipoExpedientes: ['Despido'],
      radicacion: 'Federal',
      jurisdiccion: 'Rosario',
      dependencia: 'Juzgado Laboral N° 2',
    });
  });
});
