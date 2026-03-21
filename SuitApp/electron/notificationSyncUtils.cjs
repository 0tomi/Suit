function buildNotificationIdentity(row) {
    return `${String(row?.user_id ?? '')}:${String(row?.event_id ?? '')}:${String(row?.notify_at ?? '')}`;
}

function mergeScheduledNotificationRows(...groups) {
    const merged = new Map();

    for (const group of groups) {
        if (!Array.isArray(group)) continue;

        for (const row of group) {
            if (!row?.notify_at) continue;

            const key = buildNotificationIdentity(row);
            if (!merged.has(key)) {
                merged.set(key, row);
            }
        }
    }

    return [...merged.values()];
}

module.exports = {
    mergeScheduledNotificationRows,
};
