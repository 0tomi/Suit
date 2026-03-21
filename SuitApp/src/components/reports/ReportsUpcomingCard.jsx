import { ArrowRight } from 'lucide-react';
import { Link } from 'react-router-dom';

/**
 * Card reutilizable para destacar el proximo item operativo de una categoria.
 * Soporta estado vacio y CTA contextual hacia la seccion correspondiente.
 */
export function ReportsUpcomingCard({
    icon,
    label,
    title = '',
    timestamp = '',
    description = '',
    href = null,
    ctaLabel = 'Abrir',
    accentClassName = 'from-slate-500/10',
    emptyTitle = 'Sin novedades',
    emptyDescription = 'No hay elementos proximos para mostrar.',
    testId,
}) {
    const Icon = icon;
    const hasContent = Boolean(title);

    return (
        <article
            data-testid={testId}
            className={`rounded-3xl border border-(--border-default) bg-(--bg-card) bg-gradient-to-br ${accentClassName} p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.5)]`}
        >
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary)">{label}</p>
                    <h2 className="text-2xl font-semibold leading-tight text-(--text-primary)">
                        {hasContent ? title : emptyTitle}
                    </h2>
                </div>
                <div className="rounded-2xl border border-(--border-default) bg-(--bg-card-hover) p-3 text-(--text-secondary) shadow-sm">
                    <Icon className="h-5 w-5" />
                </div>
            </div>

            <div className="mt-4 min-h-[84px] space-y-2">
                {timestamp ? (
                    <p className="text-sm font-medium text-(--text-primary)">{timestamp}</p>
                ) : null}
                <p className="text-sm leading-6 text-(--text-secondary)">
                    {hasContent ? (description || 'Sin detalle adicional.') : emptyDescription}
                </p>
            </div>

            {href ? (
                <Link
                    to={href}
                    className="mt-5 inline-flex items-center gap-2 text-sm font-semibold text-(--text-primary) transition-colors hover:text-blue-600"
                >
                    <span>{ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                </Link>
            ) : null}
        </article>
    );
}

export default ReportsUpcomingCard;
