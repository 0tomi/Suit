import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createEventOutboxService } from '../../src/services/events/eventOutboxService.js';

describe('eventOutboxService', () => {
    let db;
    let eventStore;
    let createRemoteEvent;
    let applyNotificationIntent;
    let runMonthPreflight;
    let service;

    beforeEach(() => {
        db = {
            upsertPendingEventBundle: vi.fn().mockResolvedValue(undefined),
            updatePendingEventBundle: vi.fn().mockResolvedValue(undefined),
            upsertEventOutbox: vi.fn().mockResolvedValue(undefined),
            deleteEventOutbox: vi.fn().mockResolvedValue(undefined),
            listEventOutbox: vi.fn().mockResolvedValue([]),
        };
        eventStore = {
            upsert: vi.fn(async (event) => event),
            promote: vi.fn(async (_localId, event) => event),
            read: vi.fn().mockResolvedValue(null),
        };
        createRemoteEvent = vi.fn();
        applyNotificationIntent = vi.fn().mockResolvedValue({ ok: true });
        runMonthPreflight = vi.fn().mockResolvedValue(undefined);
        service = createEventOutboxService({
            db,
            eventStore,
            createRemoteEvent,
            applyNotificationIntent,
            runMonthPreflight,
        });
    });

    it('reencola un evento FAILED como PENDING_EVENT al editarlo', async () => {
        const result = await service.requeuePendingCreate({
            eventId: -101,
            eventPayload: {
                title: 'Audiencia',
                agenda_id: 9,
                date: '2026-03-10',
            },
            notificationIntent: { action: 'none', minutes: null },
            existingOutboxEntry: {
                local_event_id: -101,
                status: 'failed',
                retry_count: 3,
                created_at: '2026-03-10T10:00:00.000Z',
            },
        });

        expect(result.ok).toBe(true);
        expect(result.queued).toBe(true);
        expect(result.event).toEqual(expect.objectContaining({
            id: -101,
            pending_sync: true,
            pending_sync_status: 'pending_event',
            pending_sync_error: null,
        }));
        expect(db.updatePendingEventBundle).toHaveBeenCalledWith(expect.objectContaining({
            outboxRow: expect.objectContaining({
                status: 'pending_event',
                retry_count: 3,
                last_error: null,
            }),
        }));
    });

    it('promueve un evento remoto conservando PENDING_NOTIFICATION cuando el error es offline-like', async () => {
        const result = await service.queueRemoteNotificationSync({
            remoteEvent: {
                id: 44,
                agenda_id: 9,
                title: 'Audiencia',
                date: '2026-03-10',
            },
            notificationIntent: { action: 'upsert', minutes: 30 },
            existingOutboxEntry: {
                local_event_id: -44,
                remote_event_id: 44,
                retry_count: 0,
                created_at: '2026-03-10T10:00:00.000Z',
            },
            sourceEventId: -44,
            error: 'Network timeout',
        });

        expect(result).toEqual(expect.objectContaining({
            id: 44,
            pending_sync: true,
            pending_sync_status: 'pending_notification',
        }));
        expect(eventStore.promote).toHaveBeenCalledWith(
            -44,
            expect.objectContaining({
                id: 44,
                pending_sync_status: 'pending_notification',
            }),
            expect.objectContaining({
                clearOutbox: false,
                outboxRow: expect.objectContaining({
                    remote_event_id: 44,
                    status: 'pending_notification',
                }),
            }),
        );
    });

    it('marca FAILED cuando la sincronizacion remota falla por error no offline', async () => {
        const result = await service.queueRemoteNotificationSync({
            remoteEvent: {
                id: 55,
                agenda_id: 9,
                title: 'Audiencia',
                date: '2026-03-10',
            },
            notificationIntent: { action: 'upsert', minutes: 30 },
            existingOutboxEntry: {
                local_event_id: 55,
                remote_event_id: 55,
                retry_count: 1,
                created_at: '2026-03-10T10:00:00.000Z',
            },
            sourceEventId: 55,
            error: 'Validation failed',
        });

        expect(result).toEqual(expect.objectContaining({
            id: 55,
            pending_sync: true,
            pending_sync_status: 'failed',
            pending_sync_error: 'Validation failed',
        }));
        expect(db.upsertEventOutbox).toHaveBeenCalledWith(expect.objectContaining({
            status: 'failed',
            last_error: 'Validation failed',
        }));
    });

    it('omite retries automaticos para filas FAILED durante el drenaje', async () => {
        db.listEventOutbox.mockResolvedValue([
            {
                local_event_id: -90,
                remote_event_id: null,
                event_payload_json: JSON.stringify({
                    title: 'Pendiente',
                    agenda_id: 3,
                    date: '2026-03-10',
                }),
                notification_payload_json: null,
                status: 'failed',
                retry_count: 2,
                last_error: 'Error permanente',
                created_at: '2026-03-10T10:00:00.000Z',
                updated_at: '2026-03-10T10:00:00.000Z',
            },
        ]);

        const result = await service.drainOutbox();

        expect(result).toEqual([]);
        expect(createRemoteEvent).not.toHaveBeenCalled();
        expect(runMonthPreflight).not.toHaveBeenCalled();
    });
});
