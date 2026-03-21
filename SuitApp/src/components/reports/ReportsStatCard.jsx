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
    <article className={`rounded-3xl border border-(--border-default) bg-(--bg-card) bg-gradient-to-br ${accentClassName} p-5 shadow-[0_18px_45px_-35px_rgba(15,23,42,0.5)] transition-all hover:shadow-[0_22px_50px_-30px_rgba(15,23,42,0.6)]`}>
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-(--text-secondary)">{label}</p>
          <p className={`${isCurrency ? 'text-xl' : 'text-4xl'} font-semibold leading-none tracking-tight ${valueClassName}`}>{displayValue}</p>
        </div>
        <div className="rounded-2xl border border-(--border-default) bg-(--bg-card-hover) p-3 text-(--text-secondary) shadow-sm transition-transform group-hover:scale-110">
          <Icon className="h-5 w-5" />
        </div>
      </div>

      {helper ? (
        <p className="mt-4 text-sm leading-6 text-(--text-secondary) font-medium">{helper}</p>
      ) : null}

      {delta ? (
        <div className={`mt-4 flex items-center gap-2 text-xs font-medium ${delta.tone}`}>
          <delta.Icon className="h-3.5 w-3.5" />
          <span>{delta.label}</span>
        </div>
      ) : null}
    </article>
  );
}

export default ReportsStatCard;
