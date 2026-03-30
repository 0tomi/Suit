import PersonProfileCard from '../people/PersonProfileCard.jsx';
import StatusExplanationCard from '../people/StatusExplanationCard.jsx';
import { buildContactSection, buildDateFields, normalizeGender } from '../people/personProfileSections.js';

function normalizeClientTypeLabel(type) {
    if (type === 'company') return 'Empresa / Persona jurídica';
    if (type === 'person') return 'Persona física';
    return type || '—';
}

const ClientProfileTab = ({ clientData, fullName }) => (
    <div className="flex-1 h-full min-h-0">
        <PersonProfileCard
            fullName={fullName}
            badges={[]}
            sections={[
                {
                    title: 'Información personal',
                    fields: [
                        { label: 'Nombre completo', value: fullName },
                        { label: 'Identificación', value: clientData.identification_number },
                        { label: 'Tipo', value: normalizeClientTypeLabel(clientData.type) },
                        { label: 'Género', value: normalizeGender(clientData.gender) },
                        ...buildDateFields(clientData),
                    ],
                },
                buildContactSection(clientData),
            ]}
            notes={clientData.notes}
            sidebarContent={
                <StatusExplanationCard
                    status={clientData.status}
                    financialStatus={clientData.financial_status}
                />
            }
        />
    </div>
);

export default ClientProfileTab;
