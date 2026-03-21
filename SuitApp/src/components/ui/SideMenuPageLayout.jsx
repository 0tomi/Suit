import { createElement } from 'react';

const SideMenuPageLayout = ({
    title,
    titleTestId,
    description,
    icon,
    sections,
    activeSection,
    onSectionChange,
    sectionIdPrefix,
    children,
    maxWidthClass = 'max-w-5xl',
}) => {
    return (
        <div className={`p-8 ${maxWidthClass} mx-auto`}>
            <div className="mb-8">
                <h1
                    data-testid={titleTestId}
                    className="text-3xl font-bold text-(--text-primary) flex items-center gap-3"
                >
                    {icon ? createElement(icon, { className: 'h-8 w-8 text-blue-500' }) : null}
                    {title}
                </h1>
                {description && (
                    <p className="text-(--text-secondary) mt-2">{description}</p>
                )}
            </div>

            <div className="flex gap-8">
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
                            </button>
                        );
                    })}
                </nav>

                <div className="flex-1 bg-(--bg-card) rounded-xl border border-(--border-default) p-6 shadow-sm min-h-[420px]">
                    {children}
                </div>
            </div>
        </div>
    );
};

export default SideMenuPageLayout;
