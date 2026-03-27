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
    metadataLabel = '',
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
            className={`relative overflow-hidden rounded-[32px] border border-(--border-default) bg-(--bg-card) p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] hover:-translate-y-1 group`}
        >
            {/* Background glass effect and gradient */}
            <div className={`absolute inset-0 bg-gradient-to-br ${accentClassName} opacity-[0.08] group-hover:opacity-[0.12] transition-opacity`} />
            <div className="absolute inset-0 backdrop-blur-[2px]" />

            <div className="relative flex items-start justify-between gap-4">
                <div className="space-y-1.5">
                    <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--text-tertiary)">{label}</p>
                    <h2 className="text-2xl font-semibold tracking-tight text-(--text-primary)">
                        {hasContent ? title : emptyTitle}
                    </h2>
                </div>
                <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-3 text-(--text-secondary) shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white dark:group-hover:bg-slate-800 group-hover:shadow-md">
                    <Icon className="h-5 w-5" />
                </div>
            </div>

            <div className="relative mt-5 min-h-[80px] space-y-2.5">
                {hasContent && metadataLabel ? (
                    <div className="flex w-fit items-center rounded-full bg-slate-500/10 px-2.5 py-1 text-[11px] font-semibold tracking-wide text-slate-600">
                        {metadataLabel}
                    </div>
                ) : null}
                {timestamp ? (
                    <div className="flex w-fit items-center gap-2 rounded-lg bg-blue-500/10 px-2.5 py-1 text-[13px] font-semibold text-blue-600 dark:text-blue-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-blue-500 animate-pulse" />
                        {timestamp}
                    </div>
                ) : null}
                <p className="text-[14px] leading-relaxed text-(--text-secondary) font-medium opacity-80">
                    {hasContent ? (description || 'Sin detalle adicional.') : emptyDescription}
                </p>
            </div>

            {href ? (
                <Link
                    to={href}
                    className="relative mt-6 inline-flex items-center gap-2 text-sm font-bold text-blue-600 dark:text-blue-400 transition-all hover:gap-3"
                >
                    <span>{ctaLabel}</span>
                    <ArrowRight className="h-4 w-4" />
                </Link>
            ) : null}
        </article>
    );
}

export default ReportsUpcomingCard;
