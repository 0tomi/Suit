const EMPTY_TIMELINE = [];

/**
 * Muestra la actividad operativa de los últimos meses sin depender de librerías
 * de gráficos. El tooltip nativo conserva el detalle por bucket.
 */
export function ReportsActivityChart({ timeline = EMPTY_TIMELINE, peakValue = 1 }) {
  return (
    <div className="relative overflow-hidden rounded-[32px] border border-(--border-default) bg-(--bg-card) p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_20px_50px_rgba(0,0,0,0.08)] group">
      <div className="flex items-center justify-between gap-4">
        <div className="space-y-1">
          <h2 className="text-xl font-bold text-(--text-primary) tracking-tight">Ritmo de actividad</h2>
          <p className="text-sm text-(--text-secondary) font-medium opacity-80">
            Eventos y altas registradas durante los últimos 12 meses.
          </p>
        </div>
        <div className="rounded-2xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-2 text-right shadow-sm group-hover:bg-white dark:group-hover:bg-slate-800 transition-colors">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--text-tertiary)">Pico histórico</p>
          <p className="text-xl font-bold text-(--text-primary) leading-none mt-1">{peakValue}</p>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-12 items-end gap-3 h-[180px]">
        {timeline.map((bucket) => {
          const effectivePeak = Math.max(1, peakValue);
          const height = bucket.total > 0 ? Math.max(12, Math.round((bucket.total / effectivePeak) * 140)) : 0;
          const tooltip = `${bucket.monthLabel}: ${bucket.total} movimientos (${bucket.events} eventos, ${bucket.cases} casos, ${bucket.clients} clientes)`;

          return (
            <div key={bucket.key} className="group/bar relative flex flex-col items-center gap-3 h-full justify-end">
              <div className="absolute -top-7 opacity-0 transition-all group-hover/bar:opacity-100 group-hover/bar:-top-9 z-10">
                <span className="rounded-lg bg-slate-900 px-2.5 py-1 text-[10px] font-bold text-white shadow-xl italic whitespace-nowrap">
                  {bucket.total} movs
                </span>
              </div>
              
              <div
                title={tooltip}
                className="w-full min-w-[14px] rounded-t-xl bg-gradient-to-t from-slate-950 via-blue-900 to-blue-500 transition-all duration-500 ease-out hover:to-blue-400 hover:scale-x-110 shadow-[0_4px_12px_-4px_rgba(37,99,235,0.4)]"
                style={{ height: `${height}px` }}
              />
              
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-(--text-tertiary) group-hover/bar:text-(--text-primary) transition-colors">
                {bucket.label}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default ReportsActivityChart;
