/**
 * Construye un nombre legible de cliente a partir de los campos soportados por la API.
 */
export function getClientDisplayName(client) {
    if (!client) return 'Cliente sin nombre';

    const directName = typeof client.name === 'string' ? client.name.trim() : '';
    const fullName = directName || [
        client.first_name,
        client.last_name,
    ].filter(Boolean).join(' ').trim();

    return fullName || `Cliente #${client.id ?? '—'}`;
}
