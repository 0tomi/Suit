import { beforeEach, describe, expect, it, vi } from 'vitest';

const apiGetMock = vi.fn();
const apiRequestMock = vi.fn();

vi.mock('../../src/services/api.js', () => ({
    apiGet: (...args) => apiGetMock(...args),
    apiRequest: (...args) => apiRequestMock(...args),
}));

import {
    extractSettingsCollection,
    getSettings,
    normalizeSystemSettingEntry,
} from '../../src/services/adminService.js';

describe('adminService', () => {
    beforeEach(() => {
        apiGetMock.mockReset();
        apiRequestMock.mockReset();
    });

    it('normaliza una configuración válida', () => {
        expect(normalizeSystemSettingEntry({
            setting_key: 'deadline_urgency_days',
            setting_value: 3,
            label: 'Urgencia',
        })).toEqual({
            key: 'deadline_urgency_days',
            value: '3',
            description: 'Urgencia',
        });
    });

    it('extrae configuraciones desde payload con settings', () => {
        const result = extractSettingsCollection({
            settings: [{ key: 'deadline_urgency_days', value: '3' }],
        });

        expect(result).toEqual([{ key: 'deadline_urgency_days', value: '3' }]);
    });

    it('obtiene configuraciones y las normaliza', async () => {
        apiGetMock.mockResolvedValue({
            ok: true,
            status: 200,
            data: {
                data: [
                    { key: 'deadline_urgency_days', value: '3', description: 'Urgencia' },
                    { setting_key: 'client_moroso_threshold_days', setting_value: '45', label: 'Moroso' },
                ],
            },
        });

        await expect(getSettings()).resolves.toEqual([
            { key: 'deadline_urgency_days', value: '3', description: 'Urgencia' },
            { key: 'client_moroso_threshold_days', value: '45', description: 'Moroso' },
        ]);
    });

    it('lanza error cuando no se pueden cargar configuraciones', async () => {
        apiGetMock.mockResolvedValue({
            ok: false,
            status: 500,
            data: { message: 'Fallo al cargar' },
        });

        await expect(getSettings()).rejects.toThrow('Fallo al cargar');
    });
});
