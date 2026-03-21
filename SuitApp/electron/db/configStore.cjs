function getConfigValue(dbInstance, key) {
    if (!dbInstance) return null;
    const row = dbInstance.prepare('SELECT value FROM config WHERE key = ?').get(key);
    return row ? row.value : null;
}

function setConfigValue(dbInstance, key, value) {
    if (!dbInstance) return;
    dbInstance.prepare(
        'INSERT OR REPLACE INTO config (key, value) VALUES (?, ?)'
    ).run(key, value);
}

function deleteConfigValue(dbInstance, key) {
    if (!dbInstance) return;
    dbInstance.prepare('DELETE FROM config WHERE key = ?').run(key);
}

function getAllConfigValues(dbInstance) {
    if (!dbInstance) return {};
    const rows = dbInstance.prepare('SELECT key, value FROM config').all();
    const result = {};
    for (const row of rows) {
        result[row.key] = row.value;
    }
    return result;
}

module.exports = {
    getConfigValue,
    setConfigValue,
    deleteConfigValue,
    getAllConfigValues,
};
