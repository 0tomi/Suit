const { parseJsonSafe } = require('./shared.cjs');
const { fromApiStartsAt } = require('../dateTimeAdapter.cjs');

function normalizeMonthBounds(year, month) {
    const normalizedYear = Number(year);
    const normalizedMonth = Number(month);

    if (!Number.isInteger(normalizedYear) || normalizedYear < 1) {
        throw new Error(`Invalid year "${String(year)}"`);
    }
    if (!Number.isInteger(normalizedMonth) || normalizedMonth < 1 || normalizedMonth > 12) {
        throw new Error(`Invalid month "${String(month)}"`);
    }

    // Prefijos de fecha local (sin timezone) para comparar contra starts_at naive.
    // Los strings ISO ordenan lexicográficamente, por lo que >= '2026-03-01'
    // y < '2026-04-01' funciona correctamente para filtrar por mes.
    const startDate = `${String(normalizedYear)}-${String(normalizedMonth).padStart(2, '0')}-01`;
    const nextMonth = normalizedMonth === 12 ? 1 : normalizedMonth + 1;
    const nextYear = normalizedMonth === 12 ? normalizedYear + 1 : normalizedYear;
    const endDateExclusive = `${String(nextYear)}-${String(nextMonth).padStart(2, '0')}-01`;

    return { startDate, endDateExclusive };
}

function normalizeEventRowForMonthReplace(row, agendaId) {
    const id = Number(row?.id);
    if (!Number.isFinite(id)) return null;

    const eventAgendaId = Number(row?.agenda_id ?? agendaId);
    const suitCaseId = row?.suit_case_id ?? row?.case_id ?? null;
    // Normalizar starts_at: puede venir de la API (con Z) o ya ser naive.
    const startsAt = fromApiStartsAt(row?.starts_at) ?? null;
    return {
        id,
        agenda_id: Number.isFinite(eventAgendaId) ? eventAgendaId : agendaId,
        suit_case_id: suitCaseId,
        event_type_id: row?.event_type_id ?? 1,
        title: row?.title ?? null,
        description: row?.description ?? null,
        starts_at: startsAt,
        is_all_day: row?.is_all_day ? 1 : 0,
        data_json: row?.data_json ?? null,
        synced_at: row?.synced_at ?? new Date().toISOString(),
    };
}

function readEventSyncMeta(row) {
    const payload = parseJsonSafe(row?.data_json);
    return payload && typeof payload === 'object' ? payload : {};
}

function isPendingEventRow(row) {
    const payload = readEventSyncMeta(row);
    return payload.pending_sync === true;
}

function buildEventPayloadFromRow(row = {}) {
    const parsed = parseJsonSafe(row?.data_json);
    if (parsed && typeof parsed === 'object') return parsed;

    return {
        id: row?.id ?? null,
        agenda_id: row?.agenda_id ?? null,
        suit_case_id: row?.suit_case_id ?? null,
        event_type_id: row?.event_type_id ?? 1,
        title: row?.title ?? null,
        description: row?.description ?? null,
        starts_at: row?.starts_at ?? null,
        is_all_day: row?.is_all_day ? 1 : 0,
    };
}

function mergePendingSyncStateForReconcile(existingRow, incomingRow) {
    if (!isPendingEventRow(existingRow)) return incomingRow;

    const existingPayload = readEventSyncMeta(existingRow);
    const incomingPayload = buildEventPayloadFromRow(incomingRow);

    return {
        ...incomingRow,
        data_json: JSON.stringify({
            ...incomingPayload,
            pending_sync: true,
            pending_sync_status: existingPayload.pending_sync_status ?? null,
            pending_sync_error: existingPayload.pending_sync_error ?? null,
            local_origin: existingPayload.local_origin ?? null,
        }),
    };
}

function replaceEventsForAgendaMonth(dbInstance, agendaId, year, month, rows = []) {
    if (!dbInstance) return;

    const normalizedAgendaId = Number(agendaId);
    if (!Number.isInteger(normalizedAgendaId) || normalizedAgendaId < 1) {
        throw new Error(`Invalid agendaId "${String(agendaId)}"`);
    }

    const { startDate, endDateExclusive } = normalizeMonthBounds(year, month);
    const safeRows = Array.isArray(rows)
        ? rows.map((row) => normalizeEventRowForMonthReplace(row, normalizedAgendaId)).filter(Boolean)
        : [];

    const deleteStmt = dbInstance.prepare(`
        DELETE FROM events
        WHERE agenda_id = ?
          AND starts_at >= ?
          AND starts_at < ?
    `);

    const upsertStmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO events (
            id,
            agenda_id,
            suit_case_id,
            event_type_id,
            title,
            description,
            starts_at,
            is_all_day,
            data_json,
            synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const replaceTransaction = dbInstance.transaction(() => {
        deleteStmt.run(normalizedAgendaId, startDate, endDateExclusive);
        for (const row of safeRows) {
            upsertStmt.run(
                row.id,
                row.agenda_id,
                row.suit_case_id,
                row.event_type_id,
                row.title,
                row.description,
                row.starts_at,
                row.is_all_day,
                row.data_json,
                row.synced_at,
            );
        }
    });

    replaceTransaction();
}

function reconcileEventsForAgendaMonth(dbInstance, agendaId, year, month, rows = []) {
    if (!dbInstance) return { inserted: 0, updated: 0, deleted: 0, preservedPending: 0 };

    const normalizedAgendaId = Number(agendaId);
    if (!Number.isInteger(normalizedAgendaId) || normalizedAgendaId < 1) {
        throw new Error(`Invalid agendaId "${String(agendaId)}"`);
    }

    const { startDate, endDateExclusive } = normalizeMonthBounds(year, month);
    const safeRows = Array.isArray(rows)
        ? rows.map((row) => normalizeEventRowForMonthReplace(row, normalizedAgendaId)).filter(Boolean)
        : [];

    const selectStmt = dbInstance.prepare(`
        SELECT *
        FROM events
        WHERE agenda_id = ?
          AND starts_at >= ?
          AND starts_at < ?
    `);
    const deleteStmt = dbInstance.prepare('DELETE FROM events WHERE id = ?');
    const upsertStmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO events (
            id,
            agenda_id,
            suit_case_id,
            event_type_id,
            title,
            description,
            starts_at,
            is_all_day,
            data_json,
            synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const summary = {
        inserted: 0,
        updated: 0,
        deleted: 0,
        preservedPending: 0,
    };

    const reconcileTransaction = dbInstance.transaction(() => {
        const existingRows = selectStmt.all(normalizedAgendaId, startDate, endDateExclusive);
        const existingById = new Map(existingRows.map((row) => [Number(row.id), row]));
        const remoteIds = new Set();

        for (const row of safeRows) {
            remoteIds.add(Number(row.id));
            const existing = existingById.get(Number(row.id));
            const rowToPersist = existing ? mergePendingSyncStateForReconcile(existing, row) : row;

            if (existing) {
                summary.updated += 1;
            } else {
                summary.inserted += 1;
            }

            upsertStmt.run(
                rowToPersist.id,
                rowToPersist.agenda_id,
                rowToPersist.suit_case_id,
                rowToPersist.event_type_id,
                rowToPersist.title,
                rowToPersist.description,
                rowToPersist.starts_at,
                rowToPersist.is_all_day,
                rowToPersist.data_json,
                rowToPersist.synced_at,
            );
        }

        for (const existingRow of existingRows) {
            const existingId = Number(existingRow.id);
            if (remoteIds.has(existingId)) continue;
            if (isPendingEventRow(existingRow)) {
                summary.preservedPending += 1;
                continue;
            }
            deleteStmt.run(existingId);
            summary.deleted += 1;
        }
    });

    reconcileTransaction();
    return summary;
}

function reconcileEventsForAgendasMonth(dbInstance, year, month, rowsByAgendaId = {}) {
    if (!dbInstance) return { inserted: 0, updated: 0, deleted: 0, preservedPending: 0 };

    const { startDate, endDateExclusive } = normalizeMonthBounds(year, month);

    const selectStmt = dbInstance.prepare(`
        SELECT *
        FROM events
        WHERE agenda_id = ?
          AND starts_at >= ?
          AND starts_at < ?
    `);
    const deleteStmt = dbInstance.prepare('DELETE FROM events WHERE id = ?');
    const upsertStmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO events (
            id,
            agenda_id,
            suit_case_id,
            event_type_id,
            title,
            description,
            starts_at,
            is_all_day,
            data_json,
            synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const summary = {
        inserted: 0,
        updated: 0,
        deleted: 0,
        preservedPending: 0,
    };

    const batchTransaction = dbInstance.transaction(() => {
        for (const [agendaIdStr, rows] of Object.entries(rowsByAgendaId)) {
            const agendaId = Number(agendaIdStr);
            if (!Number.isInteger(agendaId) || agendaId < 1) continue;

            const safeRows = Array.isArray(rows)
                ? rows.map((row) => normalizeEventRowForMonthReplace(row, agendaId)).filter(Boolean)
                : [];

            const existingRows = selectStmt.all(agendaId, startDate, endDateExclusive);
            const existingById = new Map(existingRows.map((row) => [Number(row.id), row]));
            const remoteIds = new Set();

            for (const row of safeRows) {
                remoteIds.add(Number(row.id));
                const existing = existingById.get(Number(row.id));
                const rowToPersist = existing ? mergePendingSyncStateForReconcile(existing, row) : row;

                if (existing) {
                    summary.updated += 1;
                } else {
                    summary.inserted += 1;
                }

                upsertStmt.run(
                    rowToPersist.id,
                    rowToPersist.agenda_id,
                    rowToPersist.suit_case_id,
                    rowToPersist.event_type_id,
                    rowToPersist.title,
                    rowToPersist.description,
                    rowToPersist.starts_at,
                    rowToPersist.is_all_day,
                    rowToPersist.data_json,
                    rowToPersist.synced_at,
                );
            }

            for (const existingRow of existingRows) {
                const existingId = Number(existingRow.id);
                if (remoteIds.has(existingId)) continue;
                if (isPendingEventRow(existingRow)) {
                    summary.preservedPending += 1;
                    continue;
                }
                deleteStmt.run(existingId);
                summary.deleted += 1;
            }
        }
    });

    batchTransaction();
    return summary;
}

/**
 * Reemplaza la foto completa de eventos de una agenda preservando eventos pendientes locales.
 * Se usa para hidratar la agenda completa de un caso sin quedar atados a una sola vista mensual.
 */
function reconcileEventsForAgenda(dbInstance, agendaId, rows = []) {
    if (!dbInstance) return { inserted: 0, updated: 0, deleted: 0, preservedPending: 0 };

    const normalizedAgendaId = Number(agendaId);
    if (!Number.isInteger(normalizedAgendaId) || normalizedAgendaId < 1) {
        throw new Error(`Invalid agendaId "${String(agendaId)}"`);
    }

    const safeRows = Array.isArray(rows)
        ? rows.map((row) => normalizeEventRowForMonthReplace(row, normalizedAgendaId)).filter(Boolean)
        : [];

    const selectStmt = dbInstance.prepare('SELECT * FROM events WHERE agenda_id = ?');
    const deleteStmt = dbInstance.prepare('DELETE FROM events WHERE id = ?');
    const upsertStmt = dbInstance.prepare(`
        INSERT OR REPLACE INTO events (
            id,
            agenda_id,
            suit_case_id,
            event_type_id,
            title,
            description,
            starts_at,
            is_all_day,
            data_json,
            synced_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const summary = {
        inserted: 0,
        updated: 0,
        deleted: 0,
        preservedPending: 0,
    };

    const reconcileTransaction = dbInstance.transaction(() => {
        const existingRows = selectStmt.all(normalizedAgendaId);
        const existingById = new Map(existingRows.map((row) => [Number(row.id), row]));
        const remoteIds = new Set();

        for (const row of safeRows) {
            remoteIds.add(Number(row.id));
            const existing = existingById.get(Number(row.id));
            const rowToPersist = existing ? mergePendingSyncStateForReconcile(existing, row) : row;

            if (existing) {
                summary.updated += 1;
            } else {
                summary.inserted += 1;
            }

            upsertStmt.run(
                rowToPersist.id,
                rowToPersist.agenda_id,
                rowToPersist.suit_case_id,
                rowToPersist.event_type_id,
                rowToPersist.title,
                rowToPersist.description,
                rowToPersist.starts_at,
                rowToPersist.is_all_day,
                rowToPersist.data_json,
                rowToPersist.synced_at,
            );
        }

        for (const existingRow of existingRows) {
            const existingId = Number(existingRow.id);
            if (remoteIds.has(existingId)) continue;
            if (isPendingEventRow(existingRow)) {
                summary.preservedPending += 1;
                continue;
            }
            deleteStmt.run(existingId);
            summary.deleted += 1;
        }
    });

    reconcileTransaction();
    return summary;
}

module.exports = {
    buildEventPayloadFromRow,
    mergePendingSyncStateForReconcile,
    normalizeEventRowForMonthReplace,
    readEventSyncMeta,
    isPendingEventRow,
    reconcileEventsForAgenda,
    replaceEventsForAgendaMonth,
    reconcileEventsForAgendaMonth,
    reconcileEventsForAgendasMonth,
};
