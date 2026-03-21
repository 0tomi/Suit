const { GLOBAL_DB_FILENAME } = require('./shared.cjs');
const { getUserDataPath, cleanupLegacyDatabaseFiles, openDatabase, getProfileDbPath } = require('./connection.cjs');
const { createGlobalTables, createTables } = require('./schema.cjs');
const { runMigrations } = require('./migrations.cjs');

function initGlobalDatabase() {
    cleanupLegacyDatabaseFiles();
    const globalDb = openDatabase(getUserDataPath(GLOBAL_DB_FILENAME));
    createGlobalTables(globalDb);
    return globalDb;
}

function openProfileConnection(profileRow) {
    const dbInstance = openDatabase(getProfileDbPath(profileRow.db_filename));
    createTables(dbInstance);
    runMigrations(dbInstance);
    return dbInstance;
}

module.exports = {
    initGlobalDatabase,
    openProfileConnection,
};
