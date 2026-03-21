export const normalizeDocumentPayload = (payload) => {
    if (!payload) return null;
    if (payload.data && typeof payload.data === 'object' && payload.data.id) return payload.data;
    return payload;
};
