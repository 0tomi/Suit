/**
 * Construye fila de caché para la tabla `gasto_suit_cases`.
 * `client_ids` es array en la API; se serializa como JSON en SQLite.
 * Extraído de useGastosCaso para reutilización en caseSyncDownService.
 */
export function buildGastoCacheRow(gasto) {
    return {
        id: gasto.id,
        gasto_id: gasto.gasto_id || null,
        suit_case_id: gasto.suit_case_id,
        monto: gasto.monto ?? null,
        client_ids: gasto.client_ids ? JSON.stringify(gasto.client_ids) : null,
        data_json: JSON.stringify(gasto),
        synced_at: new Date().toISOString(),
    };
}
