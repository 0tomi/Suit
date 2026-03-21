import { User, FileText, Lock, Activity, Calendar, Clock, Landmark, Image, FolderArchive } from 'lucide-react';
import { CASE_DETAIL_TAB_IDS } from './caseDetailTabsConfig.js';

const TABS = [
    { id: CASE_DETAIL_TAB_IDS[0], label: 'Resumen', icon: Activity },
    { id: CASE_DETAIL_TAB_IDS[1], label: 'Partes', icon: User },
    { id: CASE_DETAIL_TAB_IDS[2], label: 'Documentos', icon: FileText },
    { id: CASE_DETAIL_TAB_IDS[3], label: 'Multimedia', icon: Image },
    { id: CASE_DETAIL_TAB_IDS[4], label: 'Archivos', icon: FolderArchive },
    { id: CASE_DETAIL_TAB_IDS[5], label: 'Agenda', icon: Calendar },
    { id: CASE_DETAIL_TAB_IDS[6], label: 'Vencimientos', icon: Clock },
    { id: CASE_DETAIL_TAB_IDS[7], label: 'Economía', icon: Landmark },
    { id: CASE_DETAIL_TAB_IDS[8], label: 'Permisos', icon: Lock },
];

const CaseDetailTabs = ({ activeTab, onTabChange }) => (
    <div className="border-b border-(--border-default)">
        <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
            {TABS.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`
                        group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap
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

export default CaseDetailTabs;
