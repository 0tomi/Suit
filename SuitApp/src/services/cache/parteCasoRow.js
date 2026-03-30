/**
 * Construye fila de caché para la tabla `partes` (directorio global de partes).
 * Extraído de usePartesCaso para reutilización en caseSyncDownService.
 */
export function buildParteCacheRow(parte) {
    return {
        id: parte.id,
        nombre: parte.nombre || null,
        apellido: parte.apellido || null,
        identificacion: parte.identificacion || null,
        email: parte.email || null,
        telefono: parte.telefono || null,
        direccion: parte.direccion || null,
        genero: parte.genero || null,
        estado: parte.estado || null,
        notas: parte.notas || null,
        rol_id: parte.rol_id || null,
        created_at: parte.created_at || null,
        updated_at: parte.updated_at || null,
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
