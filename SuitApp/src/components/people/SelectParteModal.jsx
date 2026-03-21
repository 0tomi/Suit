import { useMemo } from 'react';
import { usePartes } from '../../context/PartesContext';
import { useModal } from '../../context/ModalContext';
import { NewParteModal } from './NewParteModal';
import { UserPlus } from 'lucide-react';
import AddCasePersonModal from '../cases/AddCasePersonModal.jsx';

const EMPTY_LINKED_PARTE_IDS = [];

/**
 * Especialización de AddCasePersonModal para seleccionar partes (participantes).
 */
export function SelectParteModal({ closeModal, modalId, onParteSelected, linkedParteIds = EMPTY_LINKED_PARTE_IDS }) {
    const { partes = [] } = usePartes();
    const { openModal, closeModal: closeModalById } = useModal();

    const parteItems = useMemo(() => {
        const linkedIds = new Set((linkedParteIds || []).map((id) => String(id)));
        
        return partes
            .filter((p) => !linkedIds.has(String(p.id)))
            .map((p) => ({
                id: p.id,
                label: `${p.nombre || ''} ${p.apellido || ''}`.trim() || 'Sin nombre',
                sublabel: p.email || (p.rol?.titulo || 'Sin rol definido'),
                data: p
            }));
    }, [partes, linkedParteIds]);

    const handleSelect = (parte) => {
        onParteSelected(parte);
        closeModal();
    };

    const handleCreateNew = () => {
        const selectionModalId = modalId;
        openModal(NewParteModal, {
            onParteCreated: (newParte) => {
                onParteSelected(newParte);
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
            title="Seleccionar Parte"
            subtitle="Elegí una parte existente o cargá una nueva sin salir del flujo actual."
            items={parteItems}
            onSelect={handleSelect}
            onCreateNew={handleCreateNew}
            createNewText="Crear nueva parte"
            createNewIcon={UserPlus}
            placeholder="Buscar por nombre..."
            emptyMessage="No hay partes disponibles para vincular."
            noOverlay={true}
            multiSelect={true}
        />
    );
}
