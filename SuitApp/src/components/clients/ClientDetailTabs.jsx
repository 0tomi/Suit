import { User, FileText } from 'lucide-react';

const TABS = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'documents', label: 'Documentación', icon: FileText },
];

const ClientDetailTabs = ({ activeTab, onTabChange, disabledTabs = [] }) => (
    <div className="border-b border-(--border-subtle)">
        <nav className="flex space-x-4" aria-label="Tabs">
            {TABS.map((tab) => {
                const isDisabled = disabledTabs.includes(tab.id);
                return (
                <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                        if (!isDisabled) {
                            onTabChange(tab.id);
                        }
                    }}
                    disabled={isDisabled}
                    className={`
                        group inline-flex items-center justify-center py-4 px-8 border-b-2 font-medium text-sm transition-all duration-200 min-w-[11.5rem]
                        ${isDisabled
                            ? 'cursor-not-allowed border-transparent text-(--text-tertiary) opacity-60'
                            : activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-(--text-secondary) hover:text-(--text-primary) hover:border-(--border-default)'
                        }
                    `}
                    title={isDisabled ? 'Esta sección no está disponible sin conexión.' : undefined}
                >
                    <tab.icon className={`
                        -ml-0.5 mr-2 h-5 w-5
                        ${isDisabled
                            ? 'text-(--text-tertiary)'
                            : activeTab === tab.id ? 'text-blue-600' : 'text-(--text-tertiary) group-hover:text-(--text-secondary)'
                        }
                    `} />
                    {tab.label}
                </button>
                );
            })}
        </nav>
    </div>
);

export default ClientDetailTabs;
