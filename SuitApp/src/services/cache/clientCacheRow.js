import { formatISO } from 'date-fns';

function toNullableString(value, fallback = null) {
    if (value === undefined) return fallback;
    return value ?? null;
}

export function extractClientPayload(payload) {
    if (!payload || typeof payload !== 'object') return null;

    if (payload.id != null) return payload;
    if (payload.data && typeof payload.data === 'object') return payload.data;
    if (payload.client && typeof payload.client === 'object') return payload.client;

    return null;
}

export function buildClientCacheRow(client, existingClient = null) {
    const normalized = extractClientPayload(client);
    const fallback = extractClientPayload(existingClient) || existingClient || null;
    const clientId = Number(normalized?.id ?? fallback?.id);

    if (!Number.isInteger(clientId) || clientId < 1) return null;

    const merged = {
        ...(fallback || {}),
        ...(normalized || {}),
        id: clientId,
    };

    return {
        id: clientId,
        first_name: toNullableString(merged.first_name),
        last_name: toNullableString(merged.last_name),
        identification_number: toNullableString(merged.identification_number),
        email: toNullableString(merged.email),
        phone: toNullableString(merged.phone),
        address: toNullableString(merged.address),
        type: toNullableString(merged.type, 'person'),
        gender: toNullableString(merged.gender, 'X'),
        status: toNullableString(merged.status, 'active'),
        notes: toNullableString(merged.notes),
        data_json: JSON.stringify(merged),
        synced_at: formatISO(new Date()),
    };
}

export default {
    buildClientCacheRow,
    extractClientPayload,
};
