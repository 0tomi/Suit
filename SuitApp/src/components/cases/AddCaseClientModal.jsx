import { useMemo, useState, useCallback } from 'react';
import { UserPlus } from 'lucide-react';
import { useClients } from '../../context/ClientsContext.jsx';
import { linkClientsToCase } from '../../services/caseService.js';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { getApiErrorMessage } from '../../utils/apiErrorMessage.js';
import { getClientDisplayName } from '../../utils/clientDisplayName.js';
import { useModal } from '../../context/ModalContext.jsx';
import { NewClientModal } from '../clients/NewClientModal.jsx';
import AddCasePersonModal from './AddCasePersonModal.jsx';

const EMPTY_LINKED_CLIENT_IDS = [];

/**
 * Especialización de AddCasePersonModal para vincular clientes existentes.
 */
export default function AddCaseClientModal({
    open,
    caseId,
    linkedClientIds = EMPTY_LINKED_CLIENT_IDS,
    onClose,
    onSuccess,
}) {
    const { clients = [] } = useClients();
    const { openModal } = useModal();
    const [linkingId, setLinkingId] = useState(null);

    const clientItems = useMemo(() => {
        const linkedIds = new Set((linkedClientIds || []).map((id) => String(id)));
        
        return clients
            .filter((client) => !linkedIds.has(String(client.id)))
            .map((client) => ({
                id: client.id,
                label: getClientDisplayName(client),
                sublabel: client.identification_number ? `DNI/CUIT: ${client.identification_number}` : 'Sin identificación',
                data: client
            }));
    }, [clients, linkedClientIds]);

    const handleSelect = useCallback(async (client) => {
        if (linkingId) return;
        setLinkingId(client.id);
        try {
            const result = await linkClientsToCase(caseId, [Number(client.id)]);
            if (!result.ok) throw new Error(getApiErrorMessage(result, 'No se pudo vincular el cliente.'));
            
            showAppToast({
                title: 'Cliente vinculado',
                description: 'El cliente quedó asociado al expediente.',
                variant: 'success',
            });
            
            onSuccess?.(client);
            onClose?.();
        } catch (error) {
            showAppToast({ title: 'Error', description: error.message, variant: 'danger' });
        } finally {
            setLinkingId(null);
        }
    }, [caseId, linkingId, onClose, onSuccess]);

    const handleCreateNew = () => {
        openModal(NewClientModal, {
            onSuccess: (newClient) => {
                if (newClient?.id) handleSelect(newClient);
            }
        });
    };

    return (
        <AddCasePersonModal
            open={open}
            onClose={onClose}
            title="Vincular Cliente"
            subtitle="Elegí un cliente existente para asociarlo al expediente actual."
            items={clientItems}
            onSelect={handleSelect}
            linkingId={linkingId}
            onCreateNew={handleCreateNew}
            createNewText="Crear nuevo cliente"
            createNewIcon={UserPlus}
            placeholder="Buscar por nombre, razón social o DNI/CUIT..."
            emptyMessage="No se encontraron clientes disponibles."
        />
    );
}
