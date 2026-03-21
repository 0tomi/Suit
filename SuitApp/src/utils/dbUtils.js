/**
 * Los datos de cases/clients/documents/events tienen un campo data_json
 * con el objeto completo original de la API. Parsearlo para que los
 * componentes que acceden a campos anidados funcionen correctamente.
 */
import { createLogger } from '../services/logService.js';
const logger = createLogger('util:db-utils');


export const parseJsonRows = (rows) => rows.map(row => {
    if (row.data_json) {
        try {
            const full = JSON.parse(row.data_json);
            return { ...row, ...full }; // data_json prevalece para campos anidados
        } catch (err) {
            void logger.warn('error parseando data_json de la fila', { rowId: row.id, error: err });
            return row;
        }
    }
    return row;
});
