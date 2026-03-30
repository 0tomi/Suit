function searchEvents(dbInstance, { query, eventTypeId, agendaId } = {}) {
    if (!dbInstance) return [];

    let sql = `
        SELECT
            e.id,
            e.title,
            e.title AS evento,
            e.agenda_id,
            e.event_type_id,
            e.suit_case_id,
            e.starts_at,
            et.name AS type,
            et.name AS tipo,
            a.name AS agenda_name
        FROM events e
        LEFT JOIN event_types et ON et.id = e.event_type_id
        LEFT JOIN agendas a ON a.id = e.agenda_id
        WHERE 1=1
    `;
    const params = [];

    if (query) {
        sql += ' AND e.title LIKE ?';
        params.push(`%${query}%`);
    }

    if (eventTypeId) {
        sql += ' AND e.event_type_id = ?';
        params.push(eventTypeId);
    }

    if (agendaId) {
        sql += ' AND e.agenda_id = ?';
        params.push(agendaId);
    }

    sql += ' ORDER BY e.starts_at DESC LIMIT 50';

    return dbInstance.prepare(sql).all(...params);
}

function getAgendaEventTypes(dbInstance, agendaId) {
    if (!dbInstance || agendaId == null || agendaId === '') return [];

    return dbInstance.prepare(`
        SELECT DISTINCT
            et.id,
            et.name,
            et.color
        FROM events e
        INNER JOIN event_types et ON et.id = e.event_type_id
        WHERE e.agenda_id = ?
        ORDER BY et.name COLLATE NOCASE ASC
    `).all(agendaId);
}

module.exports = {
    getAgendaEventTypes,
    searchEvents,
};
