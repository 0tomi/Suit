const { PROFILE_KIND_REMOTE } = require('./shared.cjs');
const { buildProfileFilename } = require('./connection.cjs');

function getProfileById(globalDb, profileId) {
    if (!globalDb) return null;
    return globalDb.prepare('SELECT * FROM profiles WHERE id = ?').get(profileId) || null;
}

function getProfileByRemoteUserId(globalDb, remoteUserId) {
    if (!globalDb) return null;
    return globalDb.prepare(`
        SELECT *
        FROM profiles
        WHERE kind = ?
          AND remote_user_id = ?
    `).get(PROFILE_KIND_REMOTE, remoteUserId) || null;
}

function listProfiles(globalDb) {
    if (!globalDb) return [];
    return globalDb.prepare(`
        SELECT *
        FROM profiles
        ORDER BY COALESCE(last_used_at, created_at) DESC, id DESC
    `).all();
}

function touchProfile(globalDb, profileId, {
    displayName = null,
    tag = null,
    authenticatedAt = null,
    usedAt = new Date().toISOString(),
} = {}) {
    if (!globalDb) return;
    globalDb.prepare(`
        UPDATE profiles
        SET display_name = COALESCE(?, display_name),
            tag = COALESCE(?, tag),
            last_authenticated_at = COALESCE(?, last_authenticated_at),
            last_used_at = ?
        WHERE id = ?
    `).run(displayName, tag, authenticatedAt, usedAt, profileId);
}

function createRemoteProfile(globalDb, user) {
    const remoteUserId = Number(user?.id);
    if (!Number.isInteger(remoteUserId) || remoteUserId < 1) {
        throw new Error('Cannot activate remote profile without a valid user id.');
    }
    if (!globalDb) {
        throw new Error('Global database has not been initialized.');
    }

    const now = new Date().toISOString();
    const result = globalDb.prepare(`
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
    `).run(
        PROFILE_KIND_REMOTE,
        remoteUserId,
        user?.name ?? null,
        user?.tag ?? null,
        `pending_remote_${remoteUserId}_${Date.now()}.db`,
        now,
        now,
        now,
    );

    const profileId = Number(result.lastInsertRowid);
    const dbFilename = buildProfileFilename(profileId);
    globalDb.prepare('UPDATE profiles SET db_filename = ? WHERE id = ?').run(dbFilename, profileId);
    return getProfileById(globalDb, profileId);
}

module.exports = {
    getProfileById,
    getProfileByRemoteUserId,
    listProfiles,
    touchProfile,
    createRemoteProfile,
};
