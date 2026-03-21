import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, beforeEach, vi } from 'vitest';
import { useEventColorResolver } from '../../src/hooks/useEventColorResolver.js';

let settingsState = {
    agendaColorMode: 'eventType',
    personalEventColor: '#3b82f6',
};
let eventTypesState = { event_types: [] };
let caseTypesState = { case_types: [] };
let casesState = { cases: [] };

const getCaseMock = vi.fn();
const logColorResolutionFallbackMock = vi.fn();
const logColorResolutionErrorMock = vi.fn();

vi.mock('../../src/context/SettingsContext.jsx', () => ({
    useSettings: () => settingsState,
}));

vi.mock('../../src/context/EventTypesContext.jsx', () => ({
    useEventTypes: () => eventTypesState,
}));

vi.mock('../../src/context/CaseTypesContext.jsx', () => ({
    useCaseTypes: () => caseTypesState,
}));

vi.mock('../../src/context/CasesContext.jsx', () => ({
    useCases: () => casesState,
}));

vi.mock('../../src/services/caseService.js', () => ({
    getCase: (...args) => getCaseMock(...args),
}));

vi.mock('../../src/utils/agendaColor/colorResolutionDiagnostics.js', () => ({
    logColorResolutionFallback: (...args) => logColorResolutionFallbackMock(...args),
    logColorResolutionError: (...args) => logColorResolutionErrorMock(...args),
}));

describe('useEventColorResolver', () => {
    beforeEach(() => {
        settingsState = {
            agendaColorMode: 'eventType',
            personalEventColor: '#3b82f6',
        };
        eventTypesState = { event_types: [] };
        caseTypesState = { case_types: [] };
        casesState = { cases: [] };
        getCaseMock.mockReset();
        logColorResolutionFallbackMock.mockReset();
        logColorResolutionErrorMock.mockReset();
    });

    it('resuelve color por tipo de evento en modo eventType', () => {
        eventTypesState = { event_types: [{ id: 3, color: '#ef4444' }] };

        const { result } = renderHook(() => useEventColorResolver());

        const color = result.current.resolveColor({
            id: 1,
            suit_case_id: 77,
            event_type_id: 3,
            agendaColor: '#2563eb',
        });
        expect(color).toBe('#ef4444');
    });

    it('resuelve color por tipo de caso en modo caseType', () => {
        settingsState = {
            ...settingsState,
            agendaColorMode: 'caseType',
        };
        caseTypesState = { case_types: [{ id: 5, eventColor: '#bc1010' }] };
        casesState = { cases: [{ id: 77, case_type_id: 5 }] };

        const { result } = renderHook(() => useEventColorResolver());

        const color = result.current.resolveColor({
            id: 1,
            suit_case_id: 77,
            event_type_id: 3,
            agendaColor: '#2563eb',
        });
        expect(color).toBe('#bc1010');
    });

    it('devuelve fallback cuando no hay datos de contexto', () => {
        const { result } = renderHook(() => useEventColorResolver());

        const color = result.current.resolveColor({
            id: 1,
            suit_case_id: 77,
            event_type_id: 3,
            agendaColor: null,
        });
        expect(color).toBe('#3b82f6');
        expect(logColorResolutionFallbackMock).toHaveBeenCalledWith(expect.objectContaining({
            eventId: 1,
            mode: 'eventType',
            reason: 'event_type_not_found',
        }));
    });

    it('evento personal usa siempre color personal sin depender del modo', () => {
        settingsState = {
            ...settingsState,
            agendaColorMode: 'caseType',
            personalEventColor: '#123456',
        };
        eventTypesState = { event_types: [{ id: 3, color: '#ef4444' }] };
        caseTypesState = { case_types: [{ id: 5, eventColor: '#bc1010' }] };
        casesState = { cases: [{ id: 77, case_type_id: 5 }] };

        const { result } = renderHook(() => useEventColorResolver());

        const color = result.current.resolveColor({
            id: 50,
            suit_case_id: null,
            event_type_id: 3,
            agendaColor: '#2563eb',
        });

        expect(color).toBe('#123456');
        expect(logColorResolutionFallbackMock).not.toHaveBeenCalled();
    });

    it('actualiza resolveColor cuando cambia agendaColorMode', () => {
        eventTypesState = { event_types: [{ id: 3, color: '#ef4444' }] };
        caseTypesState = { case_types: [{ id: 5, eventColor: '#10b981' }] };
        casesState = { cases: [{ id: 77, case_type_id: 5 }] };

        const { result, rerender } = renderHook(() => useEventColorResolver());

        const event = {
            id: 1,
            suit_case_id: 77,
            event_type_id: 3,
            agendaColor: '#2563eb',
        };

        expect(result.current.resolveColor(event)).toBe('#ef4444');

        settingsState = {
            ...settingsState,
            agendaColorMode: 'caseType',
        };
        rerender();

        expect(result.current.resolveColor(event)).toBe('#10b981');
    });

    it('hace fetch on-demand de casos faltantes y actualiza el color', async () => {
        settingsState = {
            ...settingsState,
            agendaColorMode: 'caseType',
        };
        caseTypesState = { case_types: [{ id: 5, eventColor: '#bc1010' }] };
        getCaseMock.mockResolvedValue({ id: 77, case_type_id: 5 });

        const event = {
            id: 11,
            suit_case_id: 77,
            event_type_id: 1,
            agendaColor: null,
        };

        const { result } = renderHook(() => useEventColorResolver());

        expect(result.current.resolveColor(event)).toBe('#3b82f6');

        act(() => {
            result.current.fetchMissingCases([event]);
        });

        await waitFor(() => {
            expect(getCaseMock).toHaveBeenCalledWith('77');
            expect(result.current.resolveColor(event)).toBe('#bc1010');
        });
    });

    it('deduplica solicitudes cuando se pide el mismo caso faltante mas de una vez', async () => {
        settingsState = {
            ...settingsState,
            agendaColorMode: 'caseType',
        };
        caseTypesState = { case_types: [{ id: 5, eventColor: '#bc1010' }] };

        let resolveFetch;
        getCaseMock.mockImplementation(() => new Promise((resolve) => {
            resolveFetch = resolve;
        }));

        const event = {
            id: 12,
            suit_case_id: 77,
            event_type_id: 1,
            agendaColor: null,
        };

        const { result } = renderHook(() => useEventColorResolver());

        act(() => {
            result.current.fetchMissingCases([event]);
            result.current.fetchMissingCases([event]);
        });

        expect(getCaseMock).toHaveBeenCalledTimes(1);
        expect(getCaseMock).toHaveBeenCalledWith('77');

        await act(async () => {
            resolveFetch({ id: 77, case_type_id: 5 });
        });

        await waitFor(() => {
            expect(result.current.resolveColor(event)).toBe('#bc1010');
        });
    });
});
