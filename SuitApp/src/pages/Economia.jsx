import { useState, useEffect } from 'react';
import { Landmark, PiggyBank, ShoppingCart } from 'lucide-react';
import SideMenuPageLayout from '../components/ui/SideMenuPageLayout.jsx';

import HonorariosTab from '../components/economia/HonorariosTab.jsx';
import GastosTab from '../components/economia/GastosTab.jsx';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
import { economiaSteps } from '../constants/tutorialSteps.js';

const TABS = [
    { id: 'honorarios', label: 'Honorarios', icon: PiggyBank },
    { id: 'gastos', label: 'Gastos', icon: ShoppingCart },
];

const Economia = () => {
    const [activeTab, setActiveTab] = useState('honorarios');
    
    // Soporte para atajos de salto de pestañas
    useEffect(() => {
        const handler = (e) => {
            const tabs = ['honorarios', 'gastos'];
            if (tabs[e.detail.index]) {
                setActiveTab(tabs[e.detail.index]);
            }
        };
        window.addEventListener('app:tab-change', handler);
        return () => window.removeEventListener('app:tab-change', handler);
    }, []);
    const contentByTab = {
        honorarios: <HonorariosTab />,
        gastos: <GastosTab />,
    };

    return (
        <SideMenuPageLayout
            title={(
                <div className="flex items-center gap-2">
                    <span>Economía</span>
                    <SectionTutorialTrigger
                        steps={economiaSteps}
                        ariaLabel="Ver tutorial de la sección"
                        testId="economia-tutorial-trigger"
                    />
                </div>
            )}
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
