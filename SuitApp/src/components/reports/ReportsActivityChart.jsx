const EMPTY_TIMELINE = [];

/**
 * Muestra la actividad operativa de los últimos meses sin depender de librerías
 * de gráficos. El tooltip nativo conserva el detalle por bucket.
 */
export function ReportsActivityChart({ timeline = EMPTY_TIMELINE, peakValue = 1 }) {
  return (
    <div className="rounded-[32px] border border-(--border-default) bg-(--bg-card) p-6 shadow-sm ring-1 ring-black/5">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-(--text-primary) tracking-tight">Ritmo de actividad</h2>
          <p className="mt-1 text-sm text-(--text-secondary) font-medium">
            Eventos y altas registradas durante los últimos 12 meses.
          </p>
        </div>
        <div className="rounded-2xl border border-(--border-default) bg-(--bg-card-hover) px-4 py-2 text-right shadow-inner">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-(--text-tertiary)">Pico histórico</p>
          <p className="text-xl font-bold text-(--text-primary) leading-none mt-1">{peakValue}</p>
        </div>
      </div>

      <div className="mt-10 grid grid-cols-12 items-end gap-3 h-[220px]">
        {timeline.map((bucket) => {
          const height = Math.max(12, Math.round((bucket.total / peakValue) * 180));
          const tooltip = `${bucket.monthLabel}: ${bucket.total} movimientos (${bucket.events} eventos, ${bucket.cases} casos, ${bucket.clients} clientes)`;

          return (
            <div key={bucket.key} className="group relative flex flex-col items-center gap-3 h-full justify-end">
              <div className="absolute -top-6 opacity-0 transition-all group-hover:opacity-100 group-hover:-top-8">
                <span className="rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-xl italic">
                  {bucket.total}
                </span>
              </div>
              
              <div
                title={tooltip}
                className="w-full min-w-[14px] rounded-t-xl bg-gradient-to-t from-slate-950 via-slate-800 to-sky-500 transition-all duration-500 ease-out hover:to-sky-400 hover:scale-x-110 shadow-[0_4px_12px_-4px_rgba(15,23,42,0.4)]"
                style={{ height: `${height}px` }}
              />
              
              <div className="text-[10px] font-bold uppercase tracking-[0.15em] text-(--text-tertiary) group-hover:text-(--text-primary) transition-colors">
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
