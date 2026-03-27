import { LayoutGrid, Pin, PinOff, ExternalLink } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { useTabs } from '../../context/TabsContext';
import { SECTIONS_REGISTRY } from '../../constants/sectionsRegistry.js';
import { Button } from '../ui/Button.jsx';
import { SectionTutorialTrigger } from '../ui/SectionTutorialTrigger.jsx';
import { ContextMenu, useContextMenu } from '../ui/ContextMenu.jsx';

/**
 * Card individual de sección. La zona superior navega (en la pestaña activa)
 * y el botón inferior gestiona el pin del sidebar.
 * Right-click abre menú contextual con "Abrir en nueva pestaña".
 */
function SectionCard({ section, isPinned, onTogglePin, showPinButtons = true, dense = false }) {
    const Icon = section.icon;
    const { openTab, openInNewTab } = useTabs();
    const { contextMenuState, openContextMenu, closeContextMenu } = useContextMenu();

    const contextItems = [
        {
            label: 'Abrir en nueva pestaña',
            icon: ExternalLink,
            onClick: () => openInNewTab(section.path),
        },
    ];

    const CardContent = dense ? (
        <div className="flex items-center gap-3 p-4 text-left">
            <Icon className="h-5 w-5 text-blue-500 shrink-0" />
            <h2 className="font-bold text-(--text-primary) text-base truncate flex-1 leading-tight">
                {section.label}
            </h2>
        </div>
    ) : (
        <div className="flex items-start gap-4 p-5.5 text-left">
            <div className="p-2.5 rounded-xl bg-blue-500/10 flex-shrink-0 mt-0.5">
                <Icon className="h-6 w-6 text-blue-500" />
            </div>
            <div className="flex-1 min-w-0">
                <h2 className="font-bold text-(--text-primary) text-lg leading-snug">
                    {section.label}
                </h2>
                <p className="text-sm mt-1.5 text-(--text-secondary) leading-relaxed">
                    {section.description}
                </p>
            </div>
        </div>
    );

    return (
        <>
            <div className={`bg-(--bg-card) border border-(--border-default) rounded-2xl overflow-hidden flex flex-col shadow-sm transition-all ${dense ? '' : 'hover:shadow-lg hover:-translate-y-0.5 hover:border-blue-500/30'}`}>
                {!dense ? (
                    <button
                        type="button"
                        className="hover:bg-(--bg-hover) transition-colors cursor-pointer flex-1 text-left"
                        onClick={() => openTab(section.path)}
                        onContextMenu={(e) => openContextMenu(e, contextItems)}
                        data-testid={`sections-card-link-${section.key}`}
                    >
                        {CardContent}
                    </button>
                ) : (
                    <div className="flex-1">
                        {CardContent}
                    </div>
                )}

                {showPinButtons && (
                    <div className={`px-4 ${dense ? 'pb-4' : 'pb-6 px-5.5'}`}>
                        <Button
                            variant={isPinned ? 'outline' : 'primary'}
                            size={dense ? 'sm' : 'md'}
                            icon={isPinned ? PinOff : Pin}
                            onClick={onTogglePin}
                            data-testid={`sections-pin-btn-${section.key}`}
                            className="w-full"
                        >
                            {isPinned ? 'No mostrar en el sidebar' : 'Mostrar en sidebar'}
                        </Button>
                    </div>
                )}
            </div>

            {contextMenuState.visible && (
                <ContextMenu
                    x={contextMenuState.x}
                    y={contextMenuState.y}
                    items={contextMenuState.items}
                    onClose={closeContextMenu}
                />
            )}
        </>
    );
}

/**
 * Panel reutilizable para descubrir secciones y anclarlas/desanclarlas del
 * sidebar desde distintos puntos de la aplicación.
 */
function SectionsPanel({
    containerClassName = '',
    headingTag = 'h1',
    titleClassName = 'text-3xl font-bold text-(--text-primary)',
    descriptionClassName = 'text-(--text-secondary) mt-1 mb-8',
    headerClassName = 'mb-1',
    showPinButtons = true,
    description = 'Elegí qué secciones querés tener disponibles en el menú lateral.',
    dense = false,
    tutorialSteps = [],
}) {
    const HeadingTag = headingTag;
    const { user } = useAuth();
    const { pinnedSections, togglePinnedSection } = useSettings();

    const visibleSections = SECTIONS_REGISTRY.filter(
        (section) => !section.adminOnly || user?.role === 'admin',
    );

    return (
        <div className={containerClassName}>
            <HeadingTag
                data-testid="page-sections-title"
                className={`flex items-center gap-3 ${titleClassName} ${headerClassName}`}
            >
                <div className="flex items-center gap-2">
                    <LayoutGrid className={`${dense ? 'h-7 w-7' : 'h-8 w-8'} text-blue-500 shrink-0`} />
                    <span>Secciones</span>
                    <SectionTutorialTrigger
                        steps={tutorialSteps}
                        ariaLabel="Ver tutorial de la sección"
                        testId="sections-tutorial-trigger"
                        iconSize={dense ? 20 : 26}
                    />
                </div>
            </HeadingTag>
            <p className={descriptionClassName}>
                {description}
            </p>

            <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 ${dense ? 'gap-4' : 'gap-5'}`}>
                {visibleSections.map((section) => (
                    <SectionCard
                        key={section.key}
                        section={section}
                        isPinned={pinnedSections.includes(section.key)}
                        onTogglePin={() => togglePinnedSection(section.key)}
                        showPinButtons={showPinButtons}
                        dense={dense}
                    />
                ))}
            </div>
        </div>
    );
}

export default SectionsPanel;
