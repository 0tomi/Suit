import { ArrowRight, Minus } from 'lucide-react';

function formatDelta(currentValue, previousValue) {
  if (!Number.isFinite(currentValue) || !Number.isFinite(previousValue)) {
    return null;
  }

  const diff = currentValue - previousValue;
  if (diff === 0) {
    return {
      label: 'Sin variación',
      tone: 'text-slate-500',
      Icon: Minus,
    };
  }

  return {
    label: `${diff > 0 ? '+' : ''}${diff} vs período anterior`,
    tone: diff > 0 ? 'text-emerald-600' : 'text-amber-600',
    Icon: ArrowRight,
  };
}

/**
 * Formatea un valor numérico como moneda (ARS/USD genérico).
 */
function formatCurrency(value) {
  return new Intl.NumberFormat('es-AR', {
    style: 'currency',
    currency: 'ARS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(value);
}

/**
 * Card base para KPIs y resúmenes de actividad.
 * Mantiene una estructura consistente para toda la página de reportes.
 */
export function ReportsStatCard({
  icon,
  label,
  value,
  helper,
  accentClassName = 'from-blue-500/15',
  valueClassName = 'text-(--text-primary)',
  previousValue = null,
  isCurrency = false,
}) {
  const Icon = icon;
  const delta = formatDelta(value, previousValue);

  const displayValue = isCurrency && typeof value === 'number'
    ? formatCurrency(value)
    : value;

  return (
    <article className={`relative overflow-hidden rounded-[32px] border border-(--border-default) bg-(--bg-card) p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.1)] hover:-translate-y-1 group`}>
      {/* Background glass effect and gradient */}
      <div className={`absolute inset-0 bg-gradient-to-br ${accentClassName} opacity-[0.08] group-hover:opacity-[0.12] transition-opacity`} />
      <div className="absolute inset-0 backdrop-blur-[2px]" />

      <div className="relative flex items-start justify-between gap-4">
        <div className="space-y-1.5">
          <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-(--text-tertiary)">
            {label}
          </p>
          <p className={`font-semibold tracking-tight ${isCurrency ? 'text-2xl' : 'text-4xl'} ${valueClassName}`}>
            {displayValue}
          </p>
        </div>
        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-card) p-3 text-(--text-secondary) shadow-sm transition-all duration-300 group-hover:scale-110 group-hover:bg-white dark:group-hover:bg-slate-800 group-hover:shadow-md">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {helper && (
        <p className="relative mt-4 text-[13px] leading-relaxed text-(--text-secondary) font-medium opacity-80">
          {helper}
        </p>
      )}

      {delta && (
        <div className={`relative mt-5 flex items-center gap-1.5 text-xs font-bold ${delta.tone} bg-white/40 dark:bg-black/20 w-fit px-2.5 py-1 rounded-full border border-current/10 shadow-sm`}>
          <delta.Icon className={`h-3.5 w-3.5 ${delta.tone === 'text-emerald-600' ? '' : 'rotate-180'}`} />
          <span>{delta.label}</span>
        </div>
      )}
    </article>
  );
}

export default ReportsStatCard;
