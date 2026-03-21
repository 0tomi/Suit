import { User, FileText } from 'lucide-react';

const TABS = [
    { id: 'profile', label: 'Perfil', icon: User },
    { id: 'documents', label: 'Documentación', icon: FileText },
];

const ClientDetailTabs = ({ activeTab, onTabChange }) => (
    <div className="border-b border-(--border-subtle)">
        <nav className="flex space-x-8" aria-label="Tabs">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`
                        group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200
                        ${activeTab === tab.id
                            ? 'border-blue-600 text-blue-600'
                            : 'border-transparent text-(--text-secondary) hover:text-(--text-primary) hover:border-(--border-default)'
                        }
                    `}
                >
                    <tab.icon className={`
                        -ml-0.5 mr-2 h-5 w-5
                        ${activeTab === tab.id ? 'text-blue-600' : 'text-(--text-tertiary) group-hover:text-(--text-secondary)'}
                    `} />
                    {tab.label}
                </button>
            ))}
        </nav>
    </div>
);

export default ClientDetailTabs;
