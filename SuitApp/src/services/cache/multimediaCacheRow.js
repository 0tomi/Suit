/**
 * Construye fila de caché para la tabla `multimedia`.
 * Solo guarda metadatos; el contenido binario se descarga on-demand desde la API.
 */
export function buildMultimediaCacheRow(item) {
    if (!item?.id) return null;
    return {
        id: item.id,
        suit_case_id: item.suit_case_id || null,
        filename: item.filename || item.original_name || null,
        mime_type: item.mime_type || null,
        size: item.size || null,
        deleted_at: item.deleted_at || null,
        updated_at: item.updated_at || null,
        data_json: JSON.stringify(item),
        synced_at: new Date().toISOString(),
    };
}
