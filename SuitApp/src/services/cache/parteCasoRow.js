/**
 * Construye fila de caché para la tabla `partes` (directorio global de partes).
 * Extraído de usePartesCaso para reutilización en caseSyncDownService.
 */
export function buildParteCacheRow(parte) {
    return {
        id: parte.id,
        nombre: parte.nombre || null,
        apellido: parte.apellido || null,
        email: parte.email || null,
        telefono: parte.telefono || null,
        rol_id: parte.rol_id || null,
        data_json: JSON.stringify(parte),
        synced_at: new Date().toISOString(),
    };
}

/**
 * Construye fila pivot para la tabla `parte_caso`.
 * Extraído de usePartesCaso para reutilización en caseSyncDownService.
 */
export function buildParteCasoRow(parteId, caseId) {
    return {
        parte_id: parteId,
        suit_case_id: caseId,
    };
}
