import { createElement } from 'react';
import { AnimatedFilterContent } from './AnimatedFilterContent';

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
}) => {
    return (
        <div className={`${maxWidthClass} mx-auto`}>
            {title && (
                <div className="mb-6">
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

            <div className="flex gap-5">
                <nav className="w-52 shrink-0 space-y-1">
                    {sections.map((section) => {
                        const isActive = activeSection === section.id;
                        return (
                            <button
                                key={section.id}
                                id={`${sectionIdPrefix}-${section.id}`}
                                data-testid={section.testId}
                                onClick={() => onSectionChange(section.id)}
                                className={`flex items-center gap-2.5 w-full px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${isActive
                                    ? 'bg-blue-600 text-white'
                                    : 'text-(--text-secondary) hover:bg-(--bg-card-hover) hover:text-(--text-primary)'
                                    }`}
                            >
                                {section.icon ? createElement(section.icon, { className: 'h-4 w-4 shrink-0' }) : null}
                                {section.label}
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

                <div className="flex-1 bg-(--bg-card) rounded-xl border border-(--border-default) p-4 shadow-sm min-h-[420px]">
                    <AnimatedFilterContent trigger={activeSection}>
                        {children}
                    </AnimatedFilterContent>
                </div>
            </div>
        </div>
    );
};

export default SideMenuPageLayout;
