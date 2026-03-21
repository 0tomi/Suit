import { useMemo } from 'react';
import { useClients } from '../../context/ClientsContext';
import { useModal } from '../../context/ModalContext';
import { NewClientModal } from '../clients/NewClientModal';
import { UserPlus } from 'lucide-react';
import AddCasePersonModal from '../cases/AddCasePersonModal.jsx';

const EMPTY_LINKED_CLIENT_IDS = [];

/**
 * Especialización de AddCasePersonModal para seleccionar clientes.
 */
export function SelectClientModal({ closeModal, modalId, onClientSelected, linkedClientIds = EMPTY_LINKED_CLIENT_IDS }) {
    const { clients = [] } = useClients();
    const { openModal, closeModal: closeModalById } = useModal();

    const clientItems = useMemo(() => {
        const linkedIds = new Set((linkedClientIds || []).map((id) => String(id)));
        
        return clients
            .filter((c) => !linkedIds.has(String(c.id)))
            .map((c) => ({
                id: c.id,
                label: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Sin nombre',
                sublabel: c.email || 'Sin email',
                data: c
            }));
    }, [clients, linkedClientIds]);

    const handleSelect = (client) => {
        onClientSelected(client);
        closeModal();
    };

    const handleCreateNew = () => {
        const selectionModalId = modalId;
        openModal(NewClientModal, {
            onSuccess: (newClient) => {
                onClientSelected(newClient);
                if (selectionModalId) {
                    closeModalById(selectionModalId);
                } else {
                    closeModal();
                }
            }
        });
    };

    return (
        <AddCasePersonModal
            open={true}
            onClose={closeModal}
            title="Seleccionar Cliente"
            subtitle="Elegí un cliente existente o cargá uno nuevo sin salir del flujo actual."
            items={clientItems}
            onSelect={handleSelect}
            onCreateNew={handleCreateNew}
            createNewText="Crear nuevo cliente"
            createNewIcon={UserPlus}
            placeholder="Buscar por nombre..."
            emptyMessage="No hay clientes disponibles para vincular."
            noOverlay={true}
            multiSelect={true}
        />
    );
}
