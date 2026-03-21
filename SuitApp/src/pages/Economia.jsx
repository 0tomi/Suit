import { useState } from 'react';
import { Landmark, PiggyBank, ShoppingCart } from 'lucide-react';
import SideMenuPageLayout from '../components/ui/SideMenuPageLayout.jsx';

import HonorariosTab from '../components/economia/HonorariosTab.jsx';
import GastosTab from '../components/economia/GastosTab.jsx';

const TABS = [
    { id: 'honorarios', label: 'Honorarios', icon: PiggyBank },
    { id: 'gastos', label: 'Gastos', icon: ShoppingCart },
];

const Economia = () => {
    const [activeTab, setActiveTab] = useState('honorarios');
    const contentByTab = {
        honorarios: <HonorariosTab />,
        gastos: <GastosTab />,
    };

    return (
        <SideMenuPageLayout
            title="Economía"
            titleTestId="page-economia-title"
            description="Gestión operativa de honorarios, entregas y gastos por caso."
            icon={Landmark}
            sections={TABS}
            activeSection={activeTab}
            onSectionChange={setActiveTab}
            sectionIdPrefix="economia-tab"
            maxWidthClass="max-w-full"
        >
            {contentByTab[activeTab] || null}
        </SideMenuPageLayout>
    );
};

export default Economia;
