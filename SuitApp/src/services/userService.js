import { apiGet } from './api.js';

function extractCollection(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.data)) return payload.data;
    return [];
}

/**
 * Obtiene la lista de todos los usuarios del sistema.
 */
export async function getAllUsers() {
    const result = await apiGet('/users', { dedupe: false });
    return result.ok ? extractCollection(result.data) : [];
}
