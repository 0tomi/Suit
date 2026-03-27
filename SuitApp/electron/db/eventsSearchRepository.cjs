function searchEvents(dbInstance, { query, fueroId, eventTypeId, agendaId } = {}) {
    if (!dbInstance) return [];

    let sql = `
        SELECT
            e.id,
            e.title AS evento,
            et.name AS tipo,
            c.id AS suitCaseId,
            ct.name AS casetype
        FROM events e
        LEFT JOIN event_types et ON et.id = e.event_type_id
        LEFT JOIN cases c ON c.id = e.suit_case_id
        LEFT JOIN agendas a ON a.id = e.agenda_id
        LEFT JOIN case_types ct ON ct.id = c.case_type_id
        WHERE 1=1
    `;
    const params = [];

    if (query) {
        sql += ' AND e.title LIKE ?';
        params.push(`%${query}%`);
    }

    if (fueroId) {
        sql += ' AND c.case_type_id = ?';
        params.push(fueroId);
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

module.exports = {
    searchEvents,
};
