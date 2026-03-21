/**
 * Construye una fila de caché para la tabla `honorarios` a partir de un objeto de la API.
 * Extraído de useHonorarios para reutilización en caseSyncDownService.
 */
export function buildHonorarioCacheRow(honorario) {
    return {
        id: honorario.id,
        suit_case_id: honorario.suit_case_id,
        client_id: honorario.client_id || null,
        monto: honorario.monto ?? null,
        detalles: honorario.detalles || null,
        // pagado es boolean en la API; SQLite lo guarda como 0/1
        pagado: honorario.pagado ? 1 : 0,
        total_entregas: honorario.total_entregas ?? 0,
        data_json: JSON.stringify(honorario),
        synced_at: new Date().toISOString(),
    };
}
