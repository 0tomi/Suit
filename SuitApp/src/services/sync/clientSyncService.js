import { createLogger } from '../logService.js';
import { normalizeClientGender } from '../../constants/clientGender.js';

const logger = createLogger('sync:clients');

export function buildClientCacheRow(client) {
    return {
        id: client.id,
        first_name: client.first_name,
        last_name: client.last_name,
        identification_number: client.identification_number,
        email: client.email,
        phone: client.phone,
        address: client.address,
        type: client.type,
        gender: normalizeClientGender(client.gender),
        status: client.status,
        notes: client.notes,
        data_json: JSON.stringify(client),
        synced_at: new Date().toISOString(),
    };
}

export async function syncClients() {
    const clientsApi = window.electronAPI?.clients;
    if (!clientsApi?.sync) {
        const error = new Error('El backend interno de clientes no está disponible para sincronizar.');
        logger.error('clients sync backend unavailable');
        throw error;
    }

    const result = await clientsApi.sync();
    if (!result?.ok) {
        logger.error('clients backend sync failed', result);
        throw new Error(result?.error || 'No se pudo sincronizar clientes.');
    }

    logger.info('clients backend sync completed', {
        changed: result.changed,
        strategy: result.strategy,
        count: result.count,
        lastServer: result.lastServer,
    });

    return Boolean(result.changed);
}

export default { syncClients };
