import { Modal } from '../ui/Modal';
import PersonProfileCard from './PersonProfileCard.jsx';
import StatusExplanationCard from './StatusExplanationCard.jsx';
import { buildContactSection, buildDateFields, normalizeGender } from './personProfileSections.js';

export function ParteDetailModal({ open = false, onClose, parte, roleTitle }) {
    if (!parte) return null;

    const fullName = `${parte.nombre || ''} ${parte.apellido || ''}`.trim() || 'Sin nombre';

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Detalle de parte"
            subtitle={`${fullName} · Parte #${parte.id}`}
            maxWidth="max-w-5xl"
            bodyClassName="p-0"
        >
            <PersonProfileCard
                fullName={fullName}
                badges={roleTitle ? [{ label: 'Rol', value: roleTitle, variant: 'info' }] : []}
                sections={[
                    {
                        title: 'Información personal',
                        fields: [
                            { label: 'Nombre completo', value: fullName },
                            { label: 'Identificación', value: parte.identificacion },
                            { label: 'Género', value: normalizeGender(parte.genero) },
                            ...buildDateFields(parte),
                        ],
                    },
                    buildContactSection(parte),
                ]}
                notes={parte.notas}
                sidebarContent={
                    <StatusExplanationCard
                        status={parte.estado}
                    />
                }
            />
        </Modal>
    );
}

export default ParteDetailModal;
