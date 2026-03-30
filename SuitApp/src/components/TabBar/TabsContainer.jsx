import { useTabs } from '../../context/TabsContext';
import { TabContent } from './TabContent';

/**
 * Renderiza todos los tabs simultáneamente.
 * Los inactivos usan display:none (en TabContent) para mantenerse montados
 * sin ocupar espacio visual — equivalente al keep-alive del sistema anterior.
 */
export function TabsContainer() {
    const { tabs, activeTabId } = useTabs();

    return (
        <div className="flex-1 min-h-0 flex flex-col overflow-auto [scrollbar-gutter:stable]">
            {tabs.map(tab => (
                <TabContent
                    key={tab.id}
                    tab={tab}
                    isActive={tab.id === activeTabId}
                />
            ))}
        </div>
    );
}
