import { createElement } from 'react';

/**
 * Layout interno para agrupar subcatálogos dentro de Casos, Agenda y Economía.
 * Mantiene una navegación secundaria consistente dentro de la página Categorías.
 */
export default function CategoriesGroupPanel({
    title,
    sections,
    activeSection,
    onSectionChange,
    children,
}) {
    return (
        <div className="grid gap-6 lg:grid-cols-[208px_minmax(0,1fr)]">
            <aside className="rounded-2xl border border-(--border-subtle) bg-(--bg-card-hover) p-4 shadow-sm">
                <div className="mb-4 border-b border-(--border-subtle) pb-4">
                    <h2 className="text-lg font-semibold text-(--text-primary)">{title}</h2>
                </div>

                <nav className="space-y-2">
                    {sections.map((section) => {
                        const isActive = activeSection === section.id;

                        return (
                            <button
                                key={section.id}
                                type="button"
                                data-testid={`categories-catalog-${section.testId}`}
                                onClick={() => onSectionChange(section.id)}
                                className={`flex w-full items-center gap-3 rounded-xl border px-4 py-3 text-left transition-colors ${
                                    isActive
                                        ? 'border-blue-500/30 bg-blue-500/10 text-blue-700'
                                        : 'border-transparent bg-(--bg-card) text-(--text-secondary) hover:border-(--border-default) hover:text-(--text-primary)'
                                }`}
                            >
                                <span className={`rounded-lg p-2 ${isActive ? 'bg-blue-500/15' : 'bg-(--bg-card-hover)'}`}>
                                    {section.icon ? createElement(section.icon, { className: 'h-4 w-4' }) : null}
                                </span>
                                <span className="min-w-0">
                                    <span className="block text-sm font-semibold">{section.label}</span>
                                    {section.description ? (
                                        <span className="mt-1 block text-xs text-inherit/80">{section.description}</span>
                                    ) : null}
                                </span>
                            </button>
                        );
                    })}
                </nav>
            </aside>

            <div className="min-w-0">{children}</div>
        </div>
    );
}
