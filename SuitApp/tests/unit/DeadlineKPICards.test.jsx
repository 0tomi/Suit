import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { addDays, format } from 'date-fns';
import DeadlineKPICards from '../../src/components/deadlines/DeadlineKPICards.jsx';

function buildDeadlines() {
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const inThreeDays = format(addDays(today, 3), 'yyyy-MM-dd');
  const inFifteenDays = format(addDays(today, 15), 'yyyy-MM-dd');

  return [
    { id: 1, status: 'Vencido', due_date: `${todayStr}T00:00:00.000Z` },
    { id: 2, status: 'Pendiente', due_date: `${todayStr}T00:00:00.000Z` },
    { id: 3, status: 'Pendiente', due_date: `${inThreeDays}T00:00:00.000Z` },
    { id: 4, status: 'Pendiente', due_date: `${inFifteenDays}T00:00:00.000Z` },
    { id: 5, status: 'Cumplido', due_date: `${todayStr}T00:00:00.000Z` },
  ];
}

describe('DeadlineKPICards', () => {
  it('renderiza conteos y ejecuta filtros al hacer click en las cards', () => {
    const onFilterVencidos = vi.fn();
    const onFilterDate = vi.fn();

    render(
      <DeadlineKPICards
        deadlines={buildDeadlines()}
        activeFilter="hoy"
        onFilterVencidos={onFilterVencidos}
        onFilterDate={onFilterDate}
      />
    );

    expect(screen.getAllByText('1')).toHaveLength(2);
    expect(screen.getByText('2')).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Vencidos/i }));
    fireEvent.click(screen.getByRole('button', { name: /Hoy/i }));
    fireEvent.click(screen.getByRole('button', { name: /Esta semana/i }));
    fireEvent.click(screen.getByRole('button', { name: /Este mes/i }));

    expect(onFilterVencidos).toHaveBeenCalledTimes(1);
    expect(onFilterDate).toHaveBeenNthCalledWith(1, 'hoy');
    expect(onFilterDate).toHaveBeenNthCalledWith(2, 'semana');
    expect(onFilterDate).toHaveBeenNthCalledWith(3, 'mes');
  });
});
