import { useEffect, useMemo, useState } from 'react';
import { getCaseClients } from '../services/caseService.js';
import { createLogger } from '../services/logService.js';

const logger = createLogger('hook:use-case-clients-options');

/**
 * Carga los clientes disponibles para el caso seleccionado en formularios que
 * necesitan filtrar opciones por expediente.
 */
export function useCaseClientsOptions(selectedCaseId) {
    const [clients, setClients] = useState([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;

        async function loadCaseClients() {
            if (!selectedCaseId) {
                setClients([]);
                setLoading(false);
                setError('');
                return;
            }

            setLoading(true);
            setError('');

            try {
                const nextClients = await getCaseClients(selectedCaseId);
                if (cancelled) return;
                setClients(Array.isArray(nextClients) ? nextClients : []);
            } catch (loadError) {
                if (cancelled) return;
                void logger.warn('No se pudieron cargar los clientes del caso para el formulario económico', {
                    caseId: selectedCaseId,
                    error: loadError?.message,
                });
                setClients([]);
                setError('No se pudieron cargar los clientes del caso seleccionado.');
            } finally {
                if (!cancelled) {
                    setLoading(false);
                }
            }
        }

        void loadCaseClients();

        return () => {
            cancelled = true;
        };
    }, [selectedCaseId]);

    return useMemo(() => ({
        clients,
        loading,
        error,
    }), [clients, loading, error]);
}
