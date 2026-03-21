import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

let authState;

const refreshCaseTypes = vi.fn();
const refreshEventTypes = vi.fn();
const refreshTipoExpedientes = vi.fn();
const refreshTipoPagos = vi.fn();
const refreshGastosCatalogo = vi.fn();
const refreshRoles = vi.fn();
const refreshRadicaciones = vi.fn();

const adminServiceMocks = {
    createCaseType: vi.fn(),
    updateCaseType: vi.fn(),
    deleteCaseType: vi.fn(),
    createEventType: vi.fn(),
    updateEventType: vi.fn(),
    deleteEventType: vi.fn(),
};

const tipoExpedienteServiceMocks = {
    createTipoExpediente: vi.fn(),
    updateTipoExpediente: vi.fn(),
    deleteTipoExpediente: vi.fn(),
};

const tipoPagoServiceMocks = {
    createTipoPago: vi.fn(),
    updateTipoPago: vi.fn(),
    deleteTipoPago: vi.fn(),
};

const gastoCatalogoServiceMocks = {
    createGastoCatalogo: vi.fn(),
    updateGastoCatalogo: vi.fn(),
    deleteGastoCatalogo: vi.fn(),
};

const rolServiceMocks = {
    createRol: vi.fn(),
    updateRol: vi.fn(),
    deleteRol: vi.fn(),
};

const radicacionServiceMocks = {
    createRadicacion: vi.fn(),
    updateRadicacion: vi.fn(),
    deleteRadicacion: vi.fn(),
};

vi.mock('../../src/context/AuthContext.jsx', () => ({
    useAuth: () => authState,
}));

vi.mock('../../src/context/CaseTypesContext.jsx', () => ({
    useCaseTypes: () => ({
        case_types: [{ id: 1, name: 'Civil', description: 'General', eventColor: '#123456' }],
        initialized: true,
        syncing: false,
        refreshCaseTypes,
    }),
}));

vi.mock('../../src/context/EventTypesContext.jsx', () => ({
    useEventTypes: () => ({
        event_types: [{ id: 9, name: 'Audiencia', color: '#654321' }],
        initialized: true,
        syncing: false,
        refreshEventTypes,
    }),
}));

vi.mock('../../src/context/TipoExpedientesContext.jsx', () => ({
    useTipoExpedientes: () => ({
        tipo_expedientes: [{ id: 3, title: 'Sucesión', details: 'Opcional' }],
        initialized: true,
        syncing: false,
        refreshTipoExpedientes,
    }),
}));

vi.mock('../../src/context/TipoPagosContext.jsx', () => ({
    useTipoPagos: () => ({
        tipo_pagos: [{ id: 4, name: 'Transferencia' }],
        initialized: true,
        syncing: false,
        refreshTipoPagos,
    }),
}));

vi.mock('../../src/context/GastoCatalogoContext.jsx', () => ({
    useGastoCatalogo: () => ({
        gastos_catalogo: [{ id: 5, titulo: 'Viáticos', detalles: 'Traslados' }],
        initialized: true,
        syncing: false,
        refreshGastosCatalogo,
    }),
}));

vi.mock('../../src/context/RolesContext.jsx', () => ({
    useRoles: () => ({
        roles: [{ id: 6, titulo: 'Perito' }],
        initialized: true,
        syncing: false,
        refreshRoles,
    }),
}));

vi.mock('../../src/context/RadicacionesContext.jsx', () => ({
    useRadicaciones: () => ({
        radicaciones: [{ id: 7, name: 'Juzgado Federal' }],
        initialized: true,
        syncing: false,
        refreshRadicaciones,
    }),
}));

vi.mock('../../src/services/adminService.js', () => ({
    createCaseType: (...args) => adminServiceMocks.createCaseType(...args),
    updateCaseType: (...args) => adminServiceMocks.updateCaseType(...args),
    deleteCaseType: (...args) => adminServiceMocks.deleteCaseType(...args),
    createEventType: (...args) => adminServiceMocks.createEventType(...args),
    updateEventType: (...args) => adminServiceMocks.updateEventType(...args),
    deleteEventType: (...args) => adminServiceMocks.deleteEventType(...args),
}));

vi.mock('../../src/services/tipoExpedienteService.js', () => ({
    createTipoExpediente: (...args) => tipoExpedienteServiceMocks.createTipoExpediente(...args),
    updateTipoExpediente: (...args) => tipoExpedienteServiceMocks.updateTipoExpediente(...args),
    deleteTipoExpediente: (...args) => tipoExpedienteServiceMocks.deleteTipoExpediente(...args),
}));

vi.mock('../../src/services/tipoPagoService.js', () => ({
    createTipoPago: (...args) => tipoPagoServiceMocks.createTipoPago(...args),
    updateTipoPago: (...args) => tipoPagoServiceMocks.updateTipoPago(...args),
    deleteTipoPago: (...args) => tipoPagoServiceMocks.deleteTipoPago(...args),
}));

vi.mock('../../src/services/gastoCatalogoService.js', () => ({
    createGastoCatalogo: (...args) => gastoCatalogoServiceMocks.createGastoCatalogo(...args),
    updateGastoCatalogo: (...args) => gastoCatalogoServiceMocks.updateGastoCatalogo(...args),
    deleteGastoCatalogo: (...args) => gastoCatalogoServiceMocks.deleteGastoCatalogo(...args),
}));

vi.mock('../../src/services/rolService.js', () => ({
    createRol: (...args) => rolServiceMocks.createRol(...args),
    updateRol: (...args) => rolServiceMocks.updateRol(...args),
    deleteRol: (...args) => rolServiceMocks.deleteRol(...args),
}));

vi.mock('../../src/services/radicacionService.js', () => ({
    createRadicacion: (...args) => radicacionServiceMocks.createRadicacion(...args),
    updateRadicacion: (...args) => radicacionServiceMocks.updateRadicacion(...args),
    deleteRadicacion: (...args) => radicacionServiceMocks.deleteRadicacion(...args),
}));

import { useCategoriesCatalogs } from '../../src/hooks/useCategoriesCatalogs.js';

describe('useCategoriesCatalogs', () => {
    beforeEach(() => {
        authState = { user: { id: 1, role: 'admin' } };

        refreshCaseTypes.mockReset().mockResolvedValue(undefined);
        refreshEventTypes.mockReset().mockResolvedValue(undefined);
        refreshTipoExpedientes.mockReset().mockResolvedValue(undefined);
        refreshTipoPagos.mockReset().mockResolvedValue(undefined);
        refreshGastosCatalogo.mockReset().mockResolvedValue(undefined);
        refreshRoles.mockReset().mockResolvedValue(undefined);
        refreshRadicaciones.mockReset().mockResolvedValue(undefined);

        Object.values(adminServiceMocks).forEach((mock) => mock.mockReset().mockResolvedValue({ ok: true }));
        Object.values(tipoExpedienteServiceMocks).forEach((mock) => mock.mockReset().mockResolvedValue({ ok: true }));
        Object.values(tipoPagoServiceMocks).forEach((mock) => mock.mockReset().mockResolvedValue({ ok: true }));
        Object.values(gastoCatalogoServiceMocks).forEach((mock) => mock.mockReset().mockResolvedValue({ ok: true }));
        Object.values(rolServiceMocks).forEach((mock) => mock.mockReset().mockResolvedValue({ ok: true }));
        Object.values(radicacionServiceMocks).forEach((mock) => mock.mockReset().mockResolvedValue({ ok: true }));
    });

    it('agrupa los catálogos activos por dominio y expone el catálogo judicial vigente', () => {
        const { result } = renderHook(() => useCategoriesCatalogs());

        expect(result.current.isAdmin).toBe(true);
        expect(result.current.groups.map((group) => group.id)).toEqual(['casos', 'agenda', 'economia']);

        const casosGroup = result.current.groups[0];
        expect(casosGroup.label).toBe('Catálogo Judicial');
        expect(casosGroup.catalogs.map((catalog) => catalog.id)).toEqual([
            'fueros',
            'tipos-expediente',
            'radicaciones',
            'roles',
        ]);
        expect(casosGroup.catalogs[0].label).toBe('Fueros');
    });

    it('traduce payloads hacia la API y refresca el contexto correcto', async () => {
        const { result } = renderHook(() => useCategoriesCatalogs());

        const casosGroup = result.current.groups.find((group) => group.id === 'casos');
        const economiaGroup = result.current.groups.find((group) => group.id === 'economia');

        const fueros = casosGroup.catalogs.find((catalog) => catalog.id === 'fueros');
        const tipoExpediente = casosGroup.catalogs.find((catalog) => catalog.id === 'tipos-expediente');
        const radicaciones = casosGroup.catalogs.find((catalog) => catalog.id === 'radicaciones');
        const tiposPago = economiaGroup.catalogs.find((catalog) => catalog.id === 'tipos-pago');

        await act(async () => {
            await fueros.onCreate({ name: 'Laboral', description: 'Fuero laboral', eventColor: '#ff00aa' });
            await tipoExpediente.onUpdate(3, { title: 'Sucesión', details: 'Con bienes registrables' });
            await radicaciones.onCreate({ name: 'Cámara de Apelaciones' });
            await tiposPago.onCreate({ name: 'Cheque' });
        });

        expect(adminServiceMocks.createCaseType).toHaveBeenCalledWith({
            name: 'Laboral',
            description: 'Fuero laboral',
            eventColor: '#ff00aa',
        });
        expect(tipoExpedienteServiceMocks.updateTipoExpediente).toHaveBeenCalledWith(3, {
            titulo: 'Sucesión',
            detalles: 'Con bienes registrables',
        });
        expect(radicacionServiceMocks.createRadicacion).toHaveBeenCalledWith({
            nombre_lugar: 'Cámara de Apelaciones',
        });
        expect(tipoPagoServiceMocks.createTipoPago).toHaveBeenCalledWith({
            titulo: 'Cheque',
        });

        expect(refreshCaseTypes).toHaveBeenCalledTimes(1);
        expect(refreshTipoExpedientes).toHaveBeenCalledTimes(1);
        expect(refreshRadicaciones).toHaveBeenCalledTimes(1);
        expect(refreshTipoPagos).toHaveBeenCalledTimes(1);
    });

    it('bloquea mutaciones para usuarios no administradores', async () => {
        authState = { user: { id: 2, role: 'user' } };

        const { result } = renderHook(() => useCategoriesCatalogs());
        const agendaGroup = result.current.groups.find((group) => group.id === 'agenda');
        const tiposEvento = agendaGroup.catalogs[0];

        await expect(tiposEvento.onDelete(9)).rejects.toThrow('Solo los administradores pueden modificar catálogos.');
        expect(adminServiceMocks.deleteEventType).not.toHaveBeenCalled();
    });
});
