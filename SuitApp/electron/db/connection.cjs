const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');
const { LEGACY_DB_BASENAME } = require('./shared.cjs');
const { getLogger } = require('../logService.cjs');

const logger = getLogger('db:connection');

function getElectronApp() {
    if (globalThis.__SUITAPP_TEST_ELECTRON_APP__?.getPath) {
        return globalThis.__SUITAPP_TEST_ELECTRON_APP__;
    }

    const electron = require('electron');
    if (!electron?.app?.getPath) {
        throw new Error('Electron app no está disponible para resolver userData.');
    }
    return electron.app;
}

function openDatabase(dbPath) {
    const sqlite = new Database(dbPath);
    sqlite.pragma('journal_mode = WAL');
    sqlite.pragma('foreign_keys = ON');
    return sqlite;
}

function getUserDataPath(...segments) {
    return path.join(getElectronApp().getPath('userData'), ...segments);
}

function removeFileIfExists(filePath) {
    try {
        fs.rmSync(filePath, { force: true });
    } catch (err) {
        logger.warn(`Failed to remove file "${filePath}"`, err);
    }
}

function cleanupLegacyDatabaseFiles() {
    const legacyBasePath = getUserDataPath(LEGACY_DB_BASENAME);
    for (const suffix of ['', '-wal', '-shm']) {
        removeFileIfExists(`${legacyBasePath}${suffix}`);
    }
}

function buildProfileFilename(profileId) {
    return `suit_profile_${String(profileId)}.db`;
}

function getProfileDbPath(dbFilename) {
    return getUserDataPath(dbFilename);
}

module.exports = {
    openDatabase,
    getUserDataPath,
    removeFileIfExists,
    cleanupLegacyDatabaseFiles,
    buildProfileFilename,
    getProfileDbPath,
};
