const fs = require('fs');
const path = require('path');

function resolveExistingPath(candidates = []) {
    for (const candidate of candidates) {
        if (!candidate) continue;
        if (pathExists(candidate)) {
            return candidate;
        }
    }

    return candidates[0] ?? null;
}

function resolveBuildAssetCandidates(relativeAssetPath) {
    return [
        path.join(process.resourcesPath || '', relativeAssetPath),
        path.join(__dirname, '..', relativeAssetPath),
    ];
}

function resolveRendererEntryPath() {
    return path.join(__dirname, '../dist-renderer/index.html');
}

function resolveAppIconPath() {
    return resolveExistingPath(resolveBuildAssetCandidates(path.join('build', 'icon.ico')));
}

function pathExists(targetPath) {
    try {
        return fs.existsSync(targetPath);
    } catch {
        return false;
    }
}

module.exports = {
    pathExists,
    resolveBuildAssetCandidates,
    resolveAppIconPath,
    resolveRendererEntryPath,
};
