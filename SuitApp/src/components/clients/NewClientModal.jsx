import { useMemo } from 'react';
import { useClients } from '../../context/ClientsContext';
import { createClient } from '../../services/clientService';
import { createLogger } from '../../services/logService.js';
import {
    extractEntityFromResponse,
    PERSON_FORM_INITIAL_VALUES,
} from '../../services/personAdapters.js';
import PersonFormModal from '../people/PersonFormModal.jsx';

const logger = createLogger('new-client-modal');

export const NewClientModal = ({ open = false, onClose, closeModal, onSuccess }) => {
    const { refreshClients, loadLocalData } = useClients();
    const initialFormData = useMemo(() => PERSON_FORM_INITIAL_VALUES, []);

    const submitAction = async (formData) => {
        const result = await createClient(formData);
        if (!result.ok) {
            return result;
        }

        const createdClient = extractEntityFromResponse(result.data, ['client']);
        const savedEntity = createdClient
            ? { ...formData, ...createdClient }
            : null;

        try {
            await loadLocalData();
            void refreshClients();
        } catch (cacheError) {
            void logger.warn('Local client refresh failed after create, falling back to refresh', cacheError);
            await refreshClients();
        }

        return {
            ok: true,
            savedEntity,
        };
    };

    return (
        <PersonFormModal
            open={open}
            onClose={onClose}
            closeModal={closeModal}
            title="Nuevo Cliente"
            subtitle="Cargá el cliente sin salir del selector actual."
            submitLabel="Crear Cliente"
            successDescription="Cliente creado correctamente."
            submitAction={submitAction}
            initialFormData={initialFormData}
            onSuccess={onSuccess}
            confirmDialogDescription={(skipEmail, skipPhone) => (
                <span>
                    Estás a punto de guardar el cliente sin completar:
                    {skipEmail && skipPhone ? <> <strong>Email</strong> y <strong>Teléfono</strong></> : skipEmail ? <> <strong>Email</strong></> : <> <strong>Teléfono</strong></>}.
                    {' '}Podrás editarlo más adelante.
                </span>
            )}
        />
    );
};

export default NewClientModal;
