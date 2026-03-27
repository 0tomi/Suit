import { Users, Lock, Activity, Landmark, Library, CalendarRange } from 'lucide-react';
import { CASE_DETAIL_TAB_IDS } from './caseDetailTabsConfig.js';
import { useCaseDeadlineBadge } from '../../hooks/useDeadlineBadge';

const TABS = [
    { id: 'overview', label: 'Resumen', icon: Activity },
    { id: 'cronograma', label: 'Cronograma', icon: CalendarRange },
    { id: 'biblioteca', label: 'Biblioteca', icon: Library },
    { id: 'parties', label: 'Partes', icon: Users },
    { id: 'economia', label: 'Economía', icon: Landmark },
    { id: 'permissions', label: 'Permisos', icon: Lock },
];

const CaseDetailTabs = ({ activeTab, onTabChange, caseId, newItemsByEntity }) => {
    const { badgeColor } = useCaseDeadlineBadge(caseId);

    const hasNewCronograma = newItemsByEntity?.events?.size > 0;
    const hasNewBiblioteca = (newItemsByEntity?.documents?.size ?? 0) > 0 ||
        (newItemsByEntity?.multimedia?.size ?? 0) > 0 ||
        (newItemsByEntity?.archivos?.size ?? 0) > 0;

    return (
        <div className="border-b border-(--border-default)">
            <nav className="flex space-x-8 overflow-x-auto" aria-label="Tabs">
                {TABS.map((tab) => (
                    <button
                        key={tab.id}
                        onClick={() => onTabChange(tab.id)}
                        className={`
                            relative group inline-flex items-center py-4 px-1 border-b-2 font-medium text-sm transition-all duration-200 whitespace-nowrap
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
                        {tab.id === 'cronograma' && activeTab !== 'cronograma' && badgeColor && (
                            <span
                                className="absolute top-3.5 -right-1 w-2.5 h-2.5 rounded-full border-2 border-white shadow-sm"
                                style={{ backgroundColor: badgeColor === 'red' ? '#ef4444' : '#eab308' }}
                                title={badgeColor === 'red' ? 'Hay vencimientos vencidos' : 'Hay vencimientos urgentes'}
                            />
                        )}
                        {/* Indicador de "Nuevo" (Punto rojo chico) */}
                        {tab.id === 'cronograma' && activeTab !== 'cronograma' && !badgeColor && hasNewCronograma && (
                            <span className="absolute top-3.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-white shadow-sm" />
                        )}
                        {tab.id === 'biblioteca' && activeTab !== 'biblioteca' && hasNewBiblioteca && (
                            <span className="absolute top-3.5 -right-0.5 w-2 h-2 rounded-full bg-red-500 border border-white shadow-sm" />
                        )}
                    </button>
                ))}
            </nav>
        </div>
    );
};

export default CaseDetailTabs;
