import { LayoutGrid, Pin, PinOff } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useSettings } from '../../context/SettingsContext';
import { SECTIONS_REGISTRY } from '../../constants/sectionsRegistry.js';
import { Button } from '../ui/Button.jsx';

/**
 * Card individual de sección. La zona superior navega y el botón inferior
 * gestiona el pin del sidebar sin propagar navegación accidental.
 */
function SectionCard({ section, isPinned, onTogglePin, showPinButtons = true }) {
    const Icon = section.icon;
    const navigate = useNavigate();

    return (
        <div className="bg-(--bg-card) border border-(--border-default) rounded-xl overflow-hidden flex flex-col shadow-sm">
            <button
                type="button"
                className="flex items-start gap-3 p-5 text-left hover:bg-(--bg-hover) transition-colors cursor-pointer flex-1"
                onClick={() => navigate(section.path)}
                data-testid={`sections-card-link-${section.key}`}
            >
                <div className="p-2 rounded-lg bg-blue-500/10 flex-shrink-0">
                    <Icon className="h-6 w-6 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-(--text-primary) text-base">{section.label}</h2>
                    <p className="text-sm text-(--text-secondary) mt-1 leading-relaxed">
                        {section.description}
                    </p>
                </div>
            </button>

            {showPinButtons && (
                <div className="px-5 pb-5">
                    <Button
                        variant={isPinned ? 'outline' : 'primary'}
                        size="sm"
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
    );
}

/**
 * Panel reutilizable para descubrir secciones y anclarlas/desanclarlas del
 * sidebar desde distintos puntos de la aplicación.
 */
function SectionsPanel({
    containerClassName = '',
    headingTag = 'h1',
    titleClassName = 'text-2xl font-bold text-(--text-primary)',
    descriptionClassName = 'text-(--text-secondary) mb-8',
    headerClassName = 'mb-2',
    showPinButtons = true,
    description = 'Elegí qué secciones querés tener disponibles en el menú lateral.',
}) {
    const HeadingTag = headingTag;
    const { user } = useAuth();
    const { pinnedSections, togglePinnedSection } = useSettings();

    const visibleSections = SECTIONS_REGISTRY.filter(
        (section) => !section.adminOnly || user?.role === 'admin',
    );

    return (
        <div className={containerClassName}>
            <div className={`flex items-center gap-3 ${headerClassName}`}>
                <LayoutGrid className="h-8 w-8 text-blue-500" />
                <HeadingTag
                    data-testid="page-sections-title"
                    className={titleClassName}
                >
                    Secciones
                </HeadingTag>
            </div>
            <p className={descriptionClassName}>
                {description}
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {visibleSections.map((section) => (
                    <SectionCard
                        key={section.key}
                        section={section}
                        isPinned={pinnedSections.includes(section.key)}
                        onTogglePin={() => togglePinnedSection(section.key)}
                        showPinButtons={showPinButtons}
                    />
                ))}
            </div>
        </div>
    );
}

export default SectionsPanel;
