import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.fn();
const apiRequestMock = vi.fn();

vi.mock('../../src/services/api.js', () => ({
    apiGet: (...args) => apiGetMock(...args),
    apiRequest: (...args) => apiRequestMock(...args),
}));

import {
    canPostponeDeadline,
    postponeDeadline,
    resolveDeadlinePriorityForDate,
} from '../../src/services/deadlineService.js';

describe('deadlineService', () => {
    beforeEach(() => {
        apiGetMock.mockReset();
        apiRequestMock.mockReset();
    });

    it('solo oculta la prórroga para vencimientos cumplidos', () => {
        expect(canPostponeDeadline({ status: 'Vencido' })).toBe(true);
        expect(canPostponeDeadline({ status: 'Pendiente' })).toBe(true);
        expect(canPostponeDeadline({ status: 'Prorrogado' })).toBe(true);
        expect(canPostponeDeadline({ status: 'Cumplido' })).toBe(false);
    });

    it('calcula prioridad normal cuando faltan más de dos días', () => {
        expect(resolveDeadlinePriorityForDate('2026-03-20', { now: new Date('2026-03-11T12:00:00Z') })).toBe('Normal');
    });

    it('calcula prioridad urgente cuando faltan dos días o menos', () => {
        expect(resolveDeadlinePriorityForDate('2026-03-13', { now: new Date('2026-03-11T12:00:00Z') })).toBe('Urgente');
    });

    it('prorroga y normaliza la prioridad con la fecha nueva', async () => {
        apiRequestMock
            .mockResolvedValueOnce({ ok: true, status: 200, data: { ok: true } })
            .mockResolvedValueOnce({ ok: true, status: 200, data: { ok: true } });

        // Fecha suficientemente lejana para que la prioridad sea Normal sin importar cuándo corra
        const result = await postponeDeadline(9, '2030-06-15');

        expect(result.ok).toBe(true);
        expect(apiRequestMock).toHaveBeenNthCalledWith(1, '/vencimientos/9/prorrogar', {
            method: 'POST',
            body: { due_date: '2030-06-15' },
        });
        expect(apiRequestMock).toHaveBeenNthCalledWith(2, '/vencimientos/9', {
            method: 'PUT',
            body: {
                priority: 'Normal',
                status: 'Prorrogado',
            },
        });
    });

    it('no intenta actualizar prioridad si la prórroga falla en API', async () => {
        apiRequestMock.mockResolvedValueOnce({
            ok: false,
            status: 422,
            data: { message: 'Solo se pueden prorrogar vencimientos vencidos.' },
        });

        const result = await postponeDeadline(12, '2026-03-20');

        expect(result.ok).toBe(false);
        expect(apiRequestMock).toHaveBeenCalledTimes(1);
    });
});
