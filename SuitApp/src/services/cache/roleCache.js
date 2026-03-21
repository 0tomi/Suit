function getElectronBridge() {
    return window.electronAPI;
}

export function extractRoleFromMutation(payload, fallback = {}) {
    const candidate = payload?.data ?? payload?.role ?? payload;
    if (!candidate || typeof candidate !== 'object') {
        return fallback.id ? fallback : null;
    }

    const normalized = {
        ...fallback,
        ...candidate,
        id: candidate.id ?? fallback.id ?? null,
        titulo: candidate.titulo ?? fallback.titulo ?? '',
    };

    return normalized.id ? normalized : null;
}

/**
 * Normaliza la fila local de roles para mantener alineados contexto y SQLite.
 */
export function buildRoleCacheRow(role) {
    return {
        id: role.id,
        titulo: role.titulo,
        data_json: JSON.stringify(role),
        synced_at: new Date().toISOString(),
    };
}

export async function persistRoleLocally(role) {
    if (!role?.id) return;

    const electronAPI = getElectronBridge();
    if (!electronAPI?.db) return;

    await electronAPI.db.upsertMany('roles', [buildRoleCacheRow(role)]);
}

export async function removeRoleLocally(roleId) {
    const electronAPI = getElectronBridge();
    if (!electronAPI?.db) return;

    await electronAPI.db.deleteById('roles', roleId);
}

/**
 * Fuerza un full re-fetch en el próximo sync para converger con el backend
 * incluso si la rehidratación inmediata falla por red o startup.
 */
export async function invalidateRolesSyncMeta() {
    const electronAPI = getElectronBridge();
    if (!electronAPI?.sync) return;

    await electronAPI.sync.setMeta('roles', null, null);
}
