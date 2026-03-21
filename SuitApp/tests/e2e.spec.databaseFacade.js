import { test, expect } from '@playwright/test';
import { launchElectronApp } from './helpers/electronTestUtils.js';

test.describe('database facade refactor', () => {
    test('replays legacy migrations for a pre-existing profile database', async () => {
        const { electronApp, userDataDir } = await launchElectronApp({ prefix: 'db-migration' });

        try {
            const state = await electronApp.evaluate(async ({ app }, userDataPath) => {
                const require = process.mainModule.require.bind(process.mainModule);
                const path = require('path');
                const appPath = app.getAppPath();
                const projectRoot = path.basename(appPath) === 'electron' ? path.dirname(appPath) : appPath;
                const electronRoot = path.basename(appPath) === 'electron' ? appPath : path.join(appPath, 'electron');
                const Database = require(path.join(projectRoot, 'node_modules/better-sqlite3'));
                const database = require(path.join(electronRoot, 'database.cjs'));
                const nowIso = '2026-03-10T12:00:00.000Z';

                const globalDb = new Database(path.join(userDataPath, 'suit_global.db'));
                const profileInsert = globalDb.prepare(`
                    INSERT INTO profiles (
                        kind,
                        remote_user_id,
                        display_name,
                        tag,
                        db_filename,
                        created_at,
                        last_used_at,
                        last_authenticated_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                `);
                const result = profileInsert.run(
                    'remote',
                    501,
                    'Legacy User',
                    'legacy',
                    'legacy_profile.db',
                    nowIso,
                    nowIso,
                    nowIso,
                );
                globalDb.close();

                const legacyDbPath = path.join(userDataPath, 'legacy_profile.db');
                const legacyDb = new Database(legacyDbPath);
                legacyDb.exec(`
                    CREATE TABLE config (
                        key   TEXT PRIMARY KEY,
                        value TEXT
                    );
                    INSERT INTO config (key, value) VALUES ('schema_version', '10');

                    CREATE TABLE events (
                        id            INTEGER PRIMARY KEY,
                        agenda_id     INTEGER,
                        case_id       INTEGER,
                        event_type_id INTEGER DEFAULT 1,
                        title         TEXT,
                        description   TEXT,
                        date          TEXT,
                        time          TEXT,
                        data_json     TEXT,
                        synced_at     TEXT
                    );

                    CREATE TABLE event_notifications (
                        event_id               INTEGER,
                        user_id                INTEGER,
                        when_to_notify_minutes INTEGER,
                        data_json              TEXT,
                        synced_at              TEXT,
                        PRIMARY KEY (event_id, user_id)
                    );
                `);
                legacyDb.prepare(`
                    INSERT INTO events (
                        id,
                        agenda_id,
                        case_id,
                        event_type_id,
                        title,
                        description,
                        date,
                        time,
                        data_json,
                        synced_at
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                `).run(
                    901,
                    7,
                    88,
                    1,
                    'Audiencia futura',
                    'Migracion legacy',
                    '2099-03-15',
                    '10:30',
                    JSON.stringify({ id: 901 }),
                    nowIso,
                );
                legacyDb.prepare(`
                    INSERT INTO event_notifications (
                        event_id,
                        user_id,
                        when_to_notify_minutes,
                        data_json,
                        synced_at
                    ) VALUES (?, ?, ?, ?, ?)
                `).run(
                    901,
                    77,
                    30,
                    JSON.stringify({ source: 'legacy' }),
                    nowIso,
                );
                legacyDb.close();

                database.activateProfile(Number(result.lastInsertRowid));
                const migratedNotification = database.getEventNotification(901, 77);
                const migratedDb = new Database(legacyDbPath, { readonly: true });
                const columnNames = migratedDb.prepare('PRAGMA table_info(event_notifications)').all().map((column) => column.name);
                const outboxTable = migratedDb.prepare(`
                    SELECT name
                    FROM sqlite_master
                    WHERE type = 'table'
                      AND name = 'event_outbox'
                `).get();
                migratedDb.close();

                return {
                    schemaVersion: database.getConfig('schema_version'),
                    migratedNotification,
                    columnNames,
                    outboxTable: outboxTable?.name ?? null,
                };
            }, userDataDir);

            expect(state.schemaVersion).toBe('15');
            // Desde schema_version 13, events y event_notifications se recrean desde cero:
            // la API vuelve a poblar esta cache, por lo que las filas legacy ya no persisten.
            expect(state.migratedNotification).toBeNull();
            expect(state.columnNames).toContain('notify_at');
            expect(state.columnNames).not.toContain('when_to_notify_minutes');
            expect(state.outboxTable).toBe('event_outbox');
        } finally {
            await electronApp.close();
        }
    });

    test('keeps profile data isolated while switching the active database', async () => {
        const { electronApp, window } = await launchElectronApp({ prefix: 'db-profiles' });

        try {
            const state = await window.evaluate(async () => {
                const profileOne = await window.electronAPI.profiles.activateRemoteUser({
                    id: 11,
                    name: 'Ada',
                    tag: 'ada',
                });
                await window.electronAPI.config.set('auth_token', 'token-ada');
                await window.electronAPI.db.upsertMany('users', [{
                    id: 1,
                    name: 'Ada Lovelace',
                    email: 'ada@example.com',
                    role: 'admin',
                    tag: 'ada',
                    synced_at: '2026-03-10T10:00:00.000Z',
                }]);

                const profileTwo = await window.electronAPI.profiles.activateRemoteUser({
                    id: 22,
                    name: 'Linus',
                    tag: 'linus',
                });
                const profileTwoInitialToken = await window.electronAPI.config.get('auth_token');
                await window.electronAPI.config.set('auth_token', 'token-linus');
                await window.electronAPI.db.upsertMany('users', [{
                    id: 2,
                    name: 'Linus Torvalds',
                    email: 'linus@example.com',
                    role: 'user',
                    tag: 'linus',
                    synced_at: '2026-03-10T11:00:00.000Z',
                }]);

                await window.electronAPI.profiles.activate(profileOne.id);
                const profileOneState = {
                    active: await window.electronAPI.profiles.getActive(),
                    token: await window.electronAPI.config.get('auth_token'),
                    users: await window.electronAPI.db.getAll('users'),
                };

                await window.electronAPI.profiles.activate(profileTwo.id);
                const profileTwoState = {
                    active: await window.electronAPI.profiles.getActive(),
                    token: await window.electronAPI.config.get('auth_token'),
                    users: await window.electronAPI.db.getAll('users'),
                    profiles: await window.electronAPI.profiles.list(),
                };

                await window.electronAPI.profiles.deactivate();
                return {
                    profileOne,
                    profileTwo,
                    profileTwoInitialToken,
                    profileOneState,
                    profileTwoState,
                    afterDeactivate: await window.electronAPI.profiles.getActive(),
                };
            });

            expect(state.profileTwoInitialToken).toBeNull();
            expect(state.profileOneState.active).toEqual(expect.objectContaining({ id: state.profileOne.id }));
            expect(state.profileOneState.token).toBe('token-ada');
            expect(state.profileOneState.users).toEqual([
                expect.objectContaining({ id: 1, tag: 'ada' }),
            ]);
            expect(state.profileTwoState.active).toEqual(expect.objectContaining({ id: state.profileTwo.id }));
            expect(state.profileTwoState.token).toBe('token-linus');
            expect(state.profileTwoState.users).toEqual([
                expect.objectContaining({ id: 2, tag: 'linus' }),
            ]);
            expect(state.profileTwoState.profiles).toHaveLength(2);
            expect(state.afterDeactivate).toBeNull();
        } finally {
            await electronApp.close();
        }
    });

    test('preserves pending rows during month reconciliation and promotes offline events correctly', async () => {
        const { electronApp, window } = await launchElectronApp({ prefix: 'db-events' });

        try {
            const state = await window.evaluate(async () => {
                await window.electronAPI.profiles.activateRemoteUser({
                    id: 31,
                    name: 'Scheduler',
                    tag: 'scheduler',
                });

                await window.electronAPI.db.upsertMany('events', [
                    {
                        id: 10,
                        agenda_id: 2,
                        suit_case_id: 1,
                        event_type_id: 1,
                        title: 'Servidor viejo',
                        description: 'Debe actualizarse',
                        starts_at: '2026-03-10T10:00:00',
                        is_all_day: 0,
                        data_json: JSON.stringify({
                            id: 10,
                            agenda_id: 2,
                            suit_case_id: 1,
                            event_type_id: 1,
                            title: 'Servidor viejo',
                            description: 'Debe actualizarse',
                            starts_at: '2026-03-10T10:00:00',
                            is_all_day: 0,
                        }),
                        synced_at: '2026-03-10T09:00:00.000Z',
                    },
                    {
                        id: 11,
                        agenda_id: 2,
                        suit_case_id: 1,
                        event_type_id: 1,
                        title: 'Servidor borrado',
                        description: 'Debe desaparecer',
                        starts_at: '2026-03-12T11:00:00',
                        is_all_day: 0,
                        data_json: JSON.stringify({
                            id: 11,
                            agenda_id: 2,
                            suit_case_id: 1,
                            event_type_id: 1,
                            title: 'Servidor borrado',
                            description: 'Debe desaparecer',
                            starts_at: '2026-03-12T11:00:00',
                            is_all_day: 0,
                        }),
                        synced_at: '2026-03-10T09:00:00.000Z',
                    },
                    {
                        id: -99,
                        agenda_id: 2,
                        suit_case_id: 1,
                        event_type_id: 1,
                        title: 'Pendiente local',
                        description: 'Debe preservarse',
                        starts_at: '2026-03-13T12:00:00',
                        is_all_day: 0,
                        data_json: JSON.stringify({
                            id: -99,
                            agenda_id: 2,
                            suit_case_id: 1,
                            event_type_id: 1,
                            title: 'Pendiente local',
                            description: 'Debe preservarse',
                            starts_at: '2026-03-13T12:00:00',
                            is_all_day: 0,
                            pending_sync: true,
                            pending_sync_status: 'pending_event',
                            local_origin: 'manual',
                        }),
                        synced_at: '2026-03-10T09:00:00.000Z',
                    },
                ]);

                const reconcileSummary = await window.electronAPI.db.reconcileEventsForAgendaMonth(2, 2026, 3, [
                    {
                        id: 10,
                        agenda_id: 2,
                        suit_case_id: 1,
                        event_type_id: 2,
                        title: 'Servidor nuevo',
                        description: 'Actualizado',
                        starts_at: '2026-03-10T10:30:00',
                        is_all_day: 0,
                        data_json: JSON.stringify({
                            id: 10,
                            agenda_id: 2,
                            suit_case_id: 1,
                            event_type_id: 2,
                            title: 'Servidor nuevo',
                            description: 'Actualizado',
                            starts_at: '2026-03-10T10:30:00',
                            is_all_day: 0,
                            source: 'api',
                        }),
                        synced_at: '2026-03-10T12:00:00.000Z',
                    },
                ]);

                await window.electronAPI.db.upsertPendingEventBundle({
                    eventRow: {
                        id: -5,
                        agenda_id: 3,
                        suit_case_id: 9,
                        event_type_id: 1,
                        title: 'Evento local',
                        description: 'Creado offline',
                        starts_at: '2026-04-10T09:00:00',
                        is_all_day: 0,
                        data_json: JSON.stringify({
                            id: -5,
                            agenda_id: 3,
                            suit_case_id: 9,
                            event_type_id: 1,
                            title: 'Evento local',
                            description: 'Creado offline',
                            starts_at: '2026-04-10T09:00:00',
                            is_all_day: 0,
                            pending_sync: true,
                            pending_sync_status: 'pending_event',
                        }),
                        synced_at: '2026-04-10T08:00:00.000Z',
                    },
                    outboxRow: {
                        local_event_id: -5,
                        remote_event_id: null,
                        event_payload_json: JSON.stringify({ id: -5 }),
                        notification_payload_json: null,
                        status: 'pending_event',
                        retry_count: 0,
                        last_error: null,
                        created_at: '2026-04-10T08:00:00.000Z',
                        updated_at: '2026-04-10T08:00:00.000Z',
                    },
                    notificationRows: [{
                        event_id: -5,
                        user_id: 7,
                        notify_at: '2026-04-10T08:30:00.000Z',
                        last_updated_at: '2026-04-10T08:00:00.000Z',
                        status: 'scheduled',
                        handled_at: null,
                        data_json: JSON.stringify({
                            event_id: -5,
                            user_id: 7,
                            notify_at: '2026-04-10T08:30:00.000Z',
                            status: 'scheduled',
                        }),
                        synced_at: '2026-04-10T08:00:00.000Z',
                    }],
                });

                await window.electronAPI.db.promotePendingEvent(-5, {
                    id: 500,
                    agenda_id: 3,
                    suit_case_id: 9,
                    event_type_id: 1,
                    title: 'Evento remoto',
                    description: 'Persistido en API',
                    starts_at: '2026-04-10T09:00:00',
                    is_all_day: 0,
                    data_json: JSON.stringify({
                        id: 500,
                        agenda_id: 3,
                        suit_case_id: 9,
                        event_type_id: 1,
                        title: 'Evento remoto',
                        description: 'Persistido en API',
                        starts_at: '2026-04-10T09:00:00',
                        is_all_day: 0,
                    }),
                    synced_at: '2026-04-10T08:10:00.000Z',
                }, { clearOutbox: true });

                return {
                    reconcileSummary,
                    remainingMarchEvents: await window.electronAPI.db.getAll('events'),
                    promotedRemoteEvent: await window.electronAPI.db.getById('events', 500),
                    removedLocalEvent: await window.electronAPI.db.getById('events', -5),
                    removedOutboxRow: await window.electronAPI.db.getEventOutboxByLocalEventId(-5),
                };
            });
            const hydratedNotification = await electronApp.evaluate(async ({ app }) => {
                const require = process.mainModule.require.bind(process.mainModule);
                const path = require('path');
                const appPath = app.getAppPath();
                const electronRoot = path.basename(appPath) === 'electron' ? appPath : path.join(appPath, 'electron');
                const database = require(path.join(electronRoot, 'database.cjs'));
                return database.getEventNotificationWithEvent(500, 7);
            });

            expect(state.reconcileSummary).toEqual({
                inserted: 0,
                updated: 1,
                deleted: 1,
                preservedPending: 1,
            });

            const marchEventIds = state.remainingMarchEvents
                .filter((row) => row.agenda_id === 2)
                .map((row) => row.id)
                .sort((left, right) => left - right);
            expect(marchEventIds).toEqual([-99, 10]);
            expect(JSON.parse(state.remainingMarchEvents.find((row) => row.id === -99).data_json)).toEqual(
                expect.objectContaining({
                    pending_sync: true,
                    pending_sync_status: 'pending_event',
                    local_origin: 'manual',
                })
            );
            expect(state.promotedRemoteEvent).toEqual(expect.objectContaining({
                id: 500,
                title: 'Evento remoto',
                description: 'Persistido en API',
            }));
            expect(state.removedLocalEvent).toBeNull();
            expect(state.removedOutboxRow).toBeNull();
            expect(hydratedNotification).toEqual(expect.objectContaining({
                event_id: 500,
                user_id: 7,
                title: 'Evento remoto',
                description: 'Persistido en API',
                starts_at: '2026-04-10T09:00:00',
                is_all_day: 0,
            }));
        } finally {
            await electronApp.close();
        }
    });
});
