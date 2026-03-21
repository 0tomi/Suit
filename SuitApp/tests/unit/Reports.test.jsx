import { render, screen } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const useAuthMock = vi.fn();

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => useAuthMock(),
}));

vi.mock('../../src/components/reports/ReportsDashboard.jsx', () => ({
    default: () => <div data-testid="reports-dashboard-stub">dashboard</div>,
}));

import Reports from '../../src/pages/Reports.jsx';

describe('Reports', () => {
    beforeEach(() => {
        useAuthMock.mockReset();
    });

    it('bloquea el dashboard para usuarios no administradores', () => {
        useAuthMock.mockReturnValue({
            user: { id: 7, role: 'user' },
        });

        render(<Reports />);

        expect(screen.getByText('Acceso denegado')).toBeInTheDocument();
        expect(screen.getByText('Solo los usuarios administradores pueden acceder al dashboard de Reportes.')).toBeInTheDocument();
        expect(screen.queryByTestId('reports-dashboard-stub')).not.toBeInTheDocument();
    });

    it('renderiza el dashboard para administradores', () => {
        useAuthMock.mockReturnValue({
            user: { id: 1, role: 'admin' },
        });

        render(<Reports />);

        expect(screen.getByTestId('reports-dashboard-stub')).toBeInTheDocument();
        expect(screen.queryByText('Acceso denegado')).not.toBeInTheDocument();
    });
});
