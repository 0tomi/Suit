import { createElement, useState, useMemo } from 'react';
import SideMenuPageLayout from '../components/ui/SideMenuPageLayout.jsx';
import CategoriesCatalogSection from '../components/categories/CategoriesCatalogSection.jsx';
import { useCategoriesCatalogs } from '../hooks/useCategoriesCatalogs.js';
import { SectionTutorialTrigger } from '../components/ui/SectionTutorialTrigger.jsx';
import { categoriasSteps } from '../constants/tutorialSteps.js';

/**
 * Punto central para todos los catálogos funcionales de la aplicación.
 * Rediseñado a un layout de navegación lateral (SideMenuPageLayout) para maximizar el espacio
 * y unificar la experiencia de usuario.
 */
export default function Categories() {
    const { groups, isAdmin } = useCategoriesCatalogs();
    
    // El estado ahora es simplemente el catálogo activo en toda la sección.
    // Inicializamos con el primero disponible.
    const [activeCatalogId, setActiveCatalogId] = useState('fueros');
    
    // Tracking expanded state for EACH group index.
    const [expandedGroups, setExpandedGroups] = useState(() => {
        const initial = {};
        groups.forEach((_, idx) => { initial[idx] = true; });
        return initial;
    });

    const toggleGroup = (idx) => {
        setExpandedGroups(prev => ({ ...prev, [idx]: !prev[idx] }));
    };
    const sidebarSections = useMemo(() => {
        const sections = [];
        groups.forEach((group, groupIdx) => {
            const isExpanded = expandedGroups[groupIdx];
            
            // Agregamos el header del grupo
            sections.push({
                type: 'header',
                id: `group-${groupIdx}`,
                label: group.label,
                testId: `categories-group-${group.testId}`,
                isExpanded,
                onToggle: () => toggleGroup(groupIdx),
            });

            // Agregamos cada catálogo del grupo SOLO si está expandido
            if (isExpanded) {
                group.catalogs.forEach((catalog) => {
                    sections.push({
                        id: catalog.id,
                        label: catalog.label,
                        icon: catalog.emptyIcon,
                        testId: `categories-catalog-${catalog.testId}`,
                    });
                });
            }

            // Agregamos un divisor si no es el último grupo
            if (groupIdx < groups.length - 1) {
                sections.push({ type: 'divider' });
            }
        });
        return sections;
    }, [groups, expandedGroups]);

    // Encontramos el catálogo activo buscando en todos los grupos.
    const activeCatalog = useMemo(() => {
        for (const group of groups) {
            const found = group.catalogs.find((cat) => cat.id === activeCatalogId);
            if (found) return found;
        }
        return groups[0]?.catalogs[0];
    }, [groups, activeCatalogId]);

    return (
        <SideMenuPageLayout
            title="Categorías"
            titleTestId="page-categorias-title"
            description="Administra los catálogos y clasificaciones globales del sistema."
            maxWidthClass="max-w-full"
            contentClassName="p-0 bg-transparent border-none shadow-none"
            sections={sidebarSections}
            activeSection={activeCatalogId}
            onSectionChange={setActiveCatalogId}
            titleAction={
                <SectionTutorialTrigger
                    steps={categoriasSteps}
                    ariaLabel="Ver tutorial de la sección"
                    testId="categories-tutorial-trigger"
                />
            }
        >
            <div className="flex-1 flex flex-col min-h-0 min-w-0">
                {activeCatalog ? (
                    <div className="animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-both">

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
                    </div>
                ) : (
                    <div className="flex h-64 items-center justify-center rounded-2xl border-2 border-dashed border-(--border-default)">
                        <span className="text-(--text-secondary)">Seleccioná un catálogo para comenzar</span>
                    </div>
                )}
            </div>
        </SideMenuPageLayout>
    );
}
