const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { getUserDataPath } = require('./db/connection.cjs');
const { getLogger } = require('./logService.cjs');

const logger = getLogger('media-cache');
const MEDIA_CACHE_ROOT = 'media-cache';

function sanitizeSegment(value) {
    return String(value || 'default')
        .toLowerCase()
        .replace(/[^a-z0-9_-]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 80) || 'default';
}

function toProfileId(profileId) {
    const numericProfileId = Number(profileId);
    return Number.isInteger(numericProfileId) && numericProfileId > 0 ? numericProfileId : null;
}

function getProfileMediaCacheDir(profileId) {
    const normalizedProfileId = toProfileId(profileId);
    if (!normalizedProfileId) return null;
    return getUserDataPath(MEDIA_CACHE_ROOT, `profile_${normalizedProfileId}`);
}

function buildCacheBasename(group, key) {
    const safeGroup = sanitizeSegment(group);
    const keyHash = crypto.createHash('sha256').update(String(key || '')).digest('hex');
    return `${safeGroup}__${keyHash}`;
}

function buildCachePaths({ profileId, group, key }) {
    const cacheDir = getProfileMediaCacheDir(profileId);
    if (!cacheDir || !group || !key) return null;

    const basename = buildCacheBasename(group, key);
    return {
        cacheDir,
        basename,
        binaryPath: path.join(cacheDir, `${basename}.bin`),
        metaPath: path.join(cacheDir, `${basename}.json`),
    };
}

function removeFileIfExists(filePath) {
    if (!filePath) return;
    try {
        fs.rmSync(filePath, { force: true });
    } catch (error) {
        logger.warn(`No se pudo eliminar el archivo de caché "${filePath}"`, error);
    }
}

function pruneGroupCache(cacheDir, group, keepBasename) {
    if (!cacheDir || !fs.existsSync(cacheDir)) return;

    const safeGroup = sanitizeSegment(group);
    const prefix = `${safeGroup}__`;

    for (const entry of fs.readdirSync(cacheDir)) {
        if (!entry.startsWith(prefix)) continue;
        if (entry.startsWith(`${keepBasename}.`)) continue;
        removeFileIfExists(path.join(cacheDir, entry));
    }
}

/**
 * Lee un blob multimedia persistido para el perfil activo.
 * Si la metadata no coincide o el archivo está corrupto, limpia esa entrada.
 */
function readCachedMedia({ profileId, group, key }) {
    const paths = buildCachePaths({ profileId, group, key });
    if (!paths) return null;
    if (!fs.existsSync(paths.binaryPath) || !fs.existsSync(paths.metaPath)) return null;

    try {
        const meta = JSON.parse(fs.readFileSync(paths.metaPath, 'utf8'));
        const bytes = fs.readFileSync(paths.binaryPath);
        return {
            data: bytes,
            contentType: meta?.contentType || 'application/octet-stream',
            cachedAt: meta?.cachedAt || null,
        };
    } catch (error) {
        logger.warn(`Entrada de caché multimedia corrupta para "${group}"`, error);
        removeFileIfExists(paths.binaryPath);
        removeFileIfExists(paths.metaPath);
        return null;
    }
}

/**
 * Guarda un blob multimedia en disco para reutilizarlo entre aperturas del caso.
 * Se conserva una sola versión por grupo para evitar crecimiento indefinido del caché.
 */
function writeCachedMedia({ profileId, group, key, bytes, contentType }) {
    const paths = buildCachePaths({ profileId, group, key });
    const isBinary = Array.isArray(bytes) || Buffer.isBuffer(bytes) || bytes instanceof Uint8Array;
    if (!paths || !isBinary || bytes.length === 0) return false;

    try {
        fs.mkdirSync(paths.cacheDir, { recursive: true });
        pruneGroupCache(paths.cacheDir, group, paths.basename);
        fs.writeFileSync(paths.binaryPath, Buffer.from(bytes));
        fs.writeFileSync(paths.metaPath, JSON.stringify({
            contentType: contentType || 'application/octet-stream',
            cachedAt: new Date().toISOString(),
        }, null, 2));
        return true;
    } catch (error) {
        logger.warn(`No se pudo persistir la caché multimedia para "${group}"`, error);
        removeFileIfExists(paths.binaryPath);
        removeFileIfExists(paths.metaPath);
        return false;
    }
}

function clearProfileMediaCache(profileId) {
    const cacheDir = getProfileMediaCacheDir(profileId);
    if (!cacheDir) return false;

    try {
        fs.rmSync(cacheDir, { recursive: true, force: true });
        return true;
    } catch (error) {
        logger.warn(`No se pudo limpiar la caché multimedia del perfil ${String(profileId)}`, error);
        return false;
    }
}

module.exports = {
    readCachedMedia,
    writeCachedMedia,
    clearProfileMediaCache,
};
