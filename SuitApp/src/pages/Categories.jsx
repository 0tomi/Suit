import { createElement, useState } from 'react';
import CategoriesGroupPanel from '../components/categories/CategoriesGroupPanel.jsx';
import CategoriesCatalogSection from '../components/categories/CategoriesCatalogSection.jsx';
import { useCategoriesCatalogs } from '../hooks/useCategoriesCatalogs.js';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
import { categoriasSteps } from '../constants/tutorialSteps.js';

/**
 * Punto central para todos los catálogos funcionales de la aplicación.
 * Mantiene una navegación en dos niveles dentro de una única página.
 * Refactorizado a diseño horizontal para maximizar el espacio de trabajo.
 */
export default function Categories() {
    const { groups, isAdmin } = useCategoriesCatalogs();
    const [activeGroupId, setActiveGroupId] = useState('casos');
    const [activeCatalogByGroup, setActiveCatalogByGroup] = useState({
        casos: 'fueros',
        agenda: 'tipos-evento',
        economia: 'tipos-gasto',
    });

    const activeGroup = groups.find((group) => group.id === activeGroupId) || groups[0];
    const activeCatalogId = activeCatalogByGroup[activeGroup?.id];
    const activeCatalog = activeGroup?.catalogs.find((catalog) => catalog.id === activeCatalogId) || activeGroup?.catalogs[0];

    const handleCatalogChange = (groupId, catalogId) => {
        setActiveCatalogByGroup((current) => ({ ...current, [groupId]: catalogId }));
    };

    return (
        <div className="mx-auto max-w-[1920px] p-8">
            <header className="mb-10 flex flex-col items-center justify-between gap-6 overflow-hidden sm:flex-row">
                <h1
                    data-testid="page-categorias-title"
                    className="flex shrink-0 items-center gap-4 text-3xl font-bold tracking-tight text-(--text-primary)"
                >
                    <span>Categorías</span>
                    <SectionTutorialTrigger
                        steps={categoriasSteps}
                        ariaLabel="Ver tutorial de la sección"
                        testId="categories-tutorial-trigger"
                    />
                </h1>

                {/* Navegación horizontal de Niveles Superiores (Grupos) */}
                <nav className="flex items-center gap-1 rounded-2xl bg-(--bg-card-hover) p-1.5 shadow-sm border border-(--border-subtle)">
                    {groups.map((group) => {
                        const isActive = activeGroupId === group.id;
                        return (
                            <button
                                key={group.id}
                                onClick={() => setActiveGroupId(group.id)}
                                data-testid={`categories-group-${group.testId}`}
                                className={`
                                    relative flex items-center gap-2.5 px-6 py-2.5 rounded-xl text-sm font-bold transition-all duration-300
                                    ${isActive
                                        ? 'bg-(--bg-card) text-blue-600 shadow-[0_2px_8px_rgba(37,99,235,0.12)] border border-blue-500/20'
                                        : 'text-(--text-secondary) hover:text-(--text-primary) hover:bg-(--bg-card)/50 border border-transparent'
                                    }
                                `}
                            >
                                {group.icon && createElement(group.icon, {
                                    className: `h-4 w-4 transition-transform duration-300 ${isActive ? 'scale-110' : ''}`
                                })}
                                {group.label}
                                {isActive && (
                                    <span className="absolute -bottom-[1px] inset-x-4 h-[2px] bg-blue-500 rounded-full" />
                                )}
                            </button>
                        );
                    })}
                </nav>
            </header>

            <main className="min-h-[600px] animate-in fade-in duration-500 fill-mode-both">
                {activeGroup && activeCatalog ? (
                    <CategoriesGroupPanel
                        title={activeGroup.label}
                        description={activeGroup.description}
                        sections={activeGroup.catalogs.map((catalog) => ({
                            id: catalog.id,
                            label: catalog.label,
                            icon: catalog.emptyIcon,
                            testId: catalog.testId,
                        }))}
                        activeSection={activeCatalog.id}
                        onSectionChange={(catalogId) => handleCatalogChange(activeGroup.id, catalogId)}
                    >
                        {activeCatalog.component ? (
                            createElement(activeCatalog.component, {
                                key: activeCatalog.id,
                                canEdit: activeCatalog.canEdit,
                                isAdmin: isAdmin,
                                catalog: activeCatalog,
                            })
                        ) : (
                            <CategoriesCatalogSection
                                key={activeCatalog.id}
                                catalog={activeCatalog}
                                canEdit={activeCatalog.canEdit}
                                isAdmin={isAdmin}
                            />
                        )}
                    </CategoriesGroupPanel>
                ) : (
                    <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-(--border-default)">
                        <span className="text-(--text-secondary)">Selecciona un grupo para comenzar</span>
                    </div>
                )}
            </main>
        </div>
    );
}
