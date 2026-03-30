import { Badge } from '../ui/Badge';

function renderFieldValue(field) {
    if (field.render) return field.render(field.value);
    return field.value || '—';
}

function FieldRow({ field }) {
    const Icon = field.icon;
    return (
        <div className={field.fullWidth ? 'sm:col-span-2' : ''}>
            <span className="text-[11px] text-(--text-tertiary) uppercase font-bold tracking-[0.16em] block mb-1.5">
                {field.label}
            </span>
            <div className="flex items-center gap-2 text-(--text-primary) font-medium">
                {Icon ? <Icon size={16} className="text-(--text-secondary) shrink-0" /> : null}
                <span className="min-w-0 break-words">{renderFieldValue(field)}</span>
            </div>
        </div>
    );
}

export function PersonProfileCard({
    fullName,
    sections,
    notes,
    badges = [],
    notesTitle = 'Notas internas',
    notesPlaceholder = 'Sin notas registradas.',
    sidebarContent,
}) {
    return (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300 h-full">
            <div className="md:col-span-2 bg-(--bg-card) p-6 rounded-xl shadow-sm border border-(--border-subtle) space-y-6 flex flex-col h-full">
                <div className="flex flex-col gap-4 border-b border-(--border-subtle) pb-4 md:flex-row md:items-start md:justify-between">
                    <div className="min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-[0.18em] text-(--text-tertiary)">Ficha personal</span>
                        <h3 className="mt-2 text-2xl font-semibold text-(--text-primary)">{fullName}</h3>
                    </div>
                    {badges.length > 0 ? (
                        <div className="flex flex-wrap gap-2">
                            {badges.map((badge) => (
                                <Badge key={`${badge.label}-${badge.value}`} variant={badge.variant || 'default'}>
                                    {badge.label}: {badge.value}
                                </Badge>
                            ))}
                        </div>
                    ) : null}
                </div>

                <div className="flex-1 space-y-6">
                    {sections.map((section) => (
                        <section key={section.title} className="space-y-4">
                            <h4 className="text-lg font-semibold text-(--text-primary) border-b border-(--border-subtle) pb-2 flex items-center gap-2">
                                {section.title}
                            </h4>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                                {section.fields.map((field) => (
                                    <FieldRow key={field.label} field={field} />
                                ))}
                            </div>
                        </section>
                    ))}
                </div>
            </div>

            <div className="flex flex-col gap-6 lg:sticky lg:top-4 h-full">
                <div className="bg-(--bg-card) p-6 rounded-xl shadow-sm border border-(--border-subtle)">
                    <h3 className="text-lg font-semibold text-(--text-primary) mb-4">{notesTitle}</h3>
                    <textarea
                        className="w-full bg-amber-900/10 dark:bg-amber-900/20 text-(--text-primary) border border-amber-700/30 p-3 rounded-lg text-sm min-h-[180px] focus:ring-2 focus:ring-amber-400 outline-none resize-none"
                        value={notes || notesPlaceholder}
                        readOnly
                    />
                </div>
                {sidebarContent}
            </div>
        </div>
    );
}

export default PersonProfileCard;
