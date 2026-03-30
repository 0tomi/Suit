import { createElement } from 'react';
import { AnimatedFilterContent } from './AnimatedFilterContent';
import { ChevronRight } from 'lucide-react';

const SideMenuPageLayout = ({
    title,
    titleTestId,
    description,
    icon,
    titleAction = null,
    sections,
    activeSection,
    onSectionChange,
    sectionIdPrefix,
    children,
    maxWidthClass = 'max-w-5xl',
    contentClassName = 'p-6',
}) => {
    return (
        <div className={`h-full min-h-0 w-full ${maxWidthClass} mx-auto flex flex-col`}>
            {title && (
                <div className="mb-6 shrink-0">
                    <h1
                        data-testid={titleTestId}
                        className="text-3xl font-bold text-(--text-primary) flex items-center gap-3"
                    >
                        {icon ? createElement(icon, { className: 'h-7 w-7 text-blue-500' }) : null}
                        {title}
                        {titleAction}
                    </h1>
                    {description && (
                        <p className="text-(--text-secondary) mt-1">{description}</p>
                    )}
                </div>
            )}

            <div className="flex w-full min-w-0 flex-1 gap-5 min-h-0">
                <nav className="w-52 shrink-0 min-h-0 overflow-y-auto pr-1 space-y-1">
                    {sections.map((section, idx) => {
                        if (section.type === 'header') {
                            const isCollapsible = !!section.onToggle;
                            const isExpanded = section.isExpanded !== false;
                            
                            return (
                                <div
                                    key={`header-${idx}`}
                                    className={`group flex items-center justify-between px-3 pt-4 pb-2 text-[11px] font-bold uppercase tracking-wider text-(--text-secondary) opacity-70 ${idx === 0 ? 'pt-0' : ''}`}
                                >
                                    <span>{section.label}</span>
                                    {isCollapsible && (
                                        <button
                                            key={`toggle-${idx}`}
                                            onClick={section.onToggle}
                                            className={`ml-auto rounded p-0.5 hover:bg-(--bg-card-hover) transition-transform duration-200 ${isExpanded ? 'rotate-90' : 'rotate-0'}`}
                                        >
                                            <ChevronRight className="h-3 w-3" />
                                        </button>
                                    )}
                                </div>
                            );
                        }

                        if (section.type === 'divider') {
                            return <div key={`divider-${idx}`} className="my-1.5 h-px bg-(--border-subtle) mx-3" />;
                        }

                        if (!section || !section.id) return null;

                        const isActive = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                id={sectionIdPrefix ? `${sectionIdPrefix}-${section.id}` : section.id}
                                data-testid={section.testId}
                                onClick={() => onSectionChange(section.id)}
                                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 group ${isActive
                                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-500/20 translate-x-0.5'
                                    : 'text-(--text-secondary) hover:bg-(--bg-card-hover) hover:text-(--text-primary) hover:translate-x-0.5'
                                    }`}
                            >
                                {section.icon ? createElement(section.icon, { 
                                    className: `h-4 w-4 shrink-0 transition-transform ${isActive ? 'scale-110' : 'group-hover:scale-110'}` 
                                }) : null}
                                <span className="truncate">{section.label}</span>
                                {section.hasBadge && (
                                    <span className="ml-1.5 w-2 h-2 rounded-full bg-red-400 border border-white/20 shadow-sm" />
                                )}
                                {section.badgeColor && (
                                    <span
                                        className="ml-auto w-2 h-2 rounded-full border border-white/20 shadow-sm"
                                        style={{ backgroundColor: section.badgeColor === 'red' ? '#ef4444' : '#eab308' }}
                                    />
                                )}
                            </button>
                        );
                    })}
                </nav>

                <div className={`min-w-0 flex-1 bg-(--bg-card) rounded-xl border border-(--border-default) shadow-sm min-h-[520px] overflow-y-auto overflow-x-hidden flex flex-col ${contentClassName}`}>
                    <AnimatedFilterContent trigger={activeSection} className="min-h-full min-w-0 flex flex-col">
                        {children}
                    </AnimatedFilterContent>
                </div>
            </div>
        </div>
    );
};

export default SideMenuPageLayout;
