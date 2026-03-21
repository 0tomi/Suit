import { act, renderHook, waitFor } from '@testing-library/react';
import { describe, expect, it, vi, beforeEach } from 'vitest';

const createEventEntryMock = vi.fn();
const updateEventEntryMock = vi.fn();
const deleteEventEntryMock = vi.fn();
const getNotificationMock = vi.fn();

vi.mock('../../src/services/eventNotificationService.js', () => ({
    getNotification: (...args) => getNotificationMock(...args),
}));

vi.mock('../../src/components/ui/show-app-toast.jsx', () => ({
    showAppToast: vi.fn(),
}));

import { useAgendaController } from '../../src/hooks/useAgendaController.js';

describe('useAgendaController', () => {
    beforeEach(() => {
        createEventEntryMock.mockReset();
        updateEventEntryMock.mockReset();
        deleteEventEntryMock.mockReset();
        getNotificationMock.mockReset();
        getNotificationMock.mockResolvedValue(null);
    });

    it('abre modal nuevo y crea evento preparando los datos del toast', async () => {
        createEventEntryMock.mockResolvedValue({ ok: true, event: { id: 101 }, queued: false });

        const { result } = renderHook(() => useAgendaController({
            agendas: [{ id: 7, suit_case_id: null }],
            createEventEntry: createEventEntryMock,
        }));

        act(() => {
            result.current.openNewEventAtDate(new Date('2026-03-02T15:30:00'));
        });

        expect(result.current.modal.modalOpen).toBe(true);
        expect(result.current.modal.formData.agendaId).toBe(7);
        expect(result.current.modal.formData.notifyEnabled).toBe(false);

        act(() => {
            result.current.updateFormData({
                ...result.current.modal.formData,
                title: 'Audiencia',
                date: '2026-03-02',
                time: '15:30',
            });
        });

        await act(async () => {
            await result.current.saveEvent();
        });

        expect(createEventEntryMock).toHaveBeenCalledWith({
            eventPayload: {
                title: 'Audiencia',
                starts_at: '2026-03-02T15:30:00Z',
                is_all_day: false,
                description: null,
                agenda_id: 7,
                suit_case_id: null,
                event_type_id: 1,
            },
            notificationIntent: { action: 'none', minutes: null },
            syncAgendaId: 'ALL',
        });
        expect(result.current.toastData).toEqual({
            title: 'Evento creado',
            description: 'Audiencia - 02/03/2026 a las 15:30 hs',
            variant: 'success',
        });
        expect(result.current.modal.modalOpen).toBe(false);
    });

    it('activa notificacion con el ultimo valor usado cuando el toggle pasa de off a on', () => {
        const { result } = renderHook(() => useAgendaController({
            agendas: [{ id: 7, suit_case_id: null }],
            lastEventNotificationMinutes: 60,
        }));

        act(() => {
            result.current.openNewEventAtDate(new Date('2026-03-02T15:30:00'));
        });

        expect(result.current.modal.formData.notifyEnabled).toBe(false);

        act(() => {
            result.current.setNotificationEnabled(true);
        });

        expect(result.current.modal.formData.notifyEnabled).toBe(true);
        expect(result.current.modal.formData.notifyMode).toBe('preset');
        expect(result.current.modal.formData.notifyPresetMinutes).toBe(60);
    });

    it('abre modal de edicion y elimina evento existente', async () => {
        deleteEventEntryMock.mockResolvedValue({ ok: true });
        const event = {
            id: 55,
            title: 'Reunion',
            start: new Date('2026-03-03T09:00:00'),
            end: new Date('2026-03-03T10:00:00'),
            description: 'Seguimiento',
            agendaId: 3,
            suit_case_id: 8,
            event_type_id: 2,
            allDay: false,
        };

        const { result } = renderHook(() => useAgendaController({
            agendas: [{ id: 3, suit_case_id: 8 }],
            cases: [{ id: 8, status: 'open' }],
            caseId: 8,
            deleteEventEntry: deleteEventEntryMock,
        }));

        act(() => {
            result.current.openEditEvent(event);
        });

        expect(result.current.modal.modalOpen).toBe(true);
        expect(result.current.modal.selectedEvent?.id).toBe(55);

        await act(async () => {
            await result.current.deleteEvent();
        });

        expect(deleteEventEntryMock).toHaveBeenCalledWith({
            eventId: 55,
            isPending: false,
        });
        await waitFor(() => {
            expect(result.current.modal.modalOpen).toBe(false);
            expect(result.current.toastData).toEqual({
                title: 'Evento eliminado correctamente',
                description: 'Reunion',
                variant: 'success',
            });
        });
    });

    it('deriva suit_case_id desde la agenda seleccionada al guardar', async () => {
        createEventEntryMock.mockResolvedValue({ ok: true, event: { id: 999 }, queued: false });

        const { result } = renderHook(() => useAgendaController({
            agendas: [{ id: 99, suit_case_id: 22 }],
            createEventEntry: createEventEntryMock,
        }));

        act(() => {
            result.current.openNewEventAtDate(new Date('2026-03-02T15:30:00'));
        });

        act(() => {
            result.current.updateFormData({
                ...result.current.modal.formData,
                agendaId: '99',
                caseId: '',
                title: 'Evento agenda de caso',
                date: '2026-03-02',
                time: '11:00',
            });
        });

        await act(async () => {
            await result.current.saveEvent();
        });

        expect(createEventEntryMock).toHaveBeenCalledWith(expect.objectContaining({
            eventPayload: expect.objectContaining({
                agenda_id: 99,
                suit_case_id: 22,
            }),
        }));
    });

    it('usa Todas las agendas como filtro inicial por defecto', async () => {
        const { result } = renderHook(() => useAgendaController({
            agendas: [{ id: 7, suit_case_id: null }],
            cases: [],
        }));

        await waitFor(() => {
            expect(result.current.cal.selectedFilterAgenda).toBe('ALL');
        });
    });

    it('respeta la agenda por defecto cuando está visible', async () => {
        const { result } = renderHook(() => useAgendaController({
            agendas: [{ id: 7, suit_case_id: null }, { id: 9, suit_case_id: 22 }],
            cases: [{ id: 22, status: 'open' }],
            defaultAgendaView: '9',
        }));

        await waitFor(() => {
            expect(result.current.cal.selectedFilterAgenda).toBe('9');
        });
    });

    it('hace fallback a Todas las agendas si la agenda por defecto no está visible', async () => {
        const { result } = renderHook(() => useAgendaController({
            agendas: [{ id: 7, suit_case_id: null }, { id: 9, suit_case_id: 22 }],
            cases: [],
            defaultAgendaView: '9',
        }));

        await waitFor(() => {
            expect(result.current.cal.selectedFilterAgenda).toBe('ALL');
        });
    });
});
