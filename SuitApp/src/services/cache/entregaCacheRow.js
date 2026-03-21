/**
 * Construye fila de caché para la tabla `entregas`.
 * Extraído de useEntregas para reutilización en caseSyncDownService.
 */
export function buildEntregaCacheRow(entrega) {
    return {
        id: entrega.id,
        honorario_id: entrega.honorario_id,
        tipo_pago_id: entrega.tipo_pago_id || null,
        monto: entrega.monto ?? null,
        nota: entrega.nota || null,
        data_json: JSON.stringify(entrega),
        synced_at: new Date().toISOString(),
    };
}
