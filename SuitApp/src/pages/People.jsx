import { useState } from 'react';
import { Users, UserCheck } from 'lucide-react';
import SideMenuPageLayout from '../components/ui/SideMenuPageLayout.jsx';
import ClientsTab from '../components/people/ClientsTab.jsx';
import PartesTab from '../components/people/PartesTab.jsx';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
import { personasSteps } from '../constants/tutorialSteps.js';

const TABS = [
    { id: 'clients', label: 'Clientes', icon: UserCheck },
    { id: 'partes', label: 'Partes', icon: Users },
];

const People = () => {
    const [activeTab, setActiveTab] = useState('clients');

    const contentByTab = {
        clients: <ClientsTab />,
        partes: <PartesTab />,
    };

    return (
        <SideMenuPageLayout
            title={(
                <div className="flex items-center gap-2">
                    <span>Personas</span>
                    <SectionTutorialTrigger
                        steps={personasSteps}
                        ariaLabel="Ver tutorial de la sección"
                        testId="people-tutorial-trigger"
                    />
                </div>
            )}
            titleTestId="page-people-title"
            description="Gestiona clientes y partes vinculadas a los casos."
            icon={Users}
            sections={TABS}
            activeSection={activeTab}
            onSectionChange={setActiveTab}
            sectionIdPrefix="people-tab"
            maxWidthClass="max-w-full" // Use full width for tables
        >
            {contentByTab[activeTab] || null}
        </SideMenuPageLayout>
    );
};

export default People;
