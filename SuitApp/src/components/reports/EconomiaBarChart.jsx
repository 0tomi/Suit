/**
 * EconomiaBarChart — Gráfico mensual para un único metric económico.
 * Soporta dos modos de visualización (barras / línea) toggeables con un botón.
 *
 * Props:
 *   title        — Título del gráfico (ej. "Honorarios")
 *   helper       — Subtítulo descriptivo
 *   data         — Array de 12 buckets { key, shortLabel, monthLabel, value }
 *   gradientFrom — Clase Tailwind de color inicial del gradiente
 *   gradientVia  — Clase Tailwind de color medio del gradiente
 *   gradientTo   — Clase Tailwind de color final del gradiente
 *   lineColor    — Color hex de la línea (modo línea). Ej: '#6366f1'
 */

import { useState } from 'react';
import { BarChart2, LineChart } from 'lucide-react';

const EMPTY = [];
const CHART_W = 120;
const CHART_H = 80;

/** Formatea un número como moneda ARS sin decimales. */
function formatCurrency(value) {
    return new Intl.NumberFormat('es-AR', {
        style: 'currency',
        currency: 'ARS',
        maximumFractionDigits: 0,
    }).format(value);
}

/** Vista de barras CSS. */
function BarsView({ data, peakValue, gradientFrom, gradientVia, gradientTo, gradientHoverTo }) {
    return (
        <div className="mt-6 grid grid-cols-12 items-end gap-2 h-[160px]">
            {data.map((bucket) => {
                const height = Math.max(10, Math.round((bucket.value / peakValue) * 130));
                return (
                    <div key={bucket.key} className="group relative flex flex-col items-center gap-2 h-full justify-end">
                        <div className="absolute -top-6 opacity-0 transition-all group-hover:opacity-100 group-hover:-top-8 z-10 pointer-events-none">
                            <span className="whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[10px] font-bold text-white shadow-xl italic">
                                {formatCurrency(bucket.value)}
                            </span>
                        </div>
                        <div
                            title={`${bucket.monthLabel}: ${formatCurrency(bucket.value)}`}
                            className={`w-full min-w-[10px] rounded-t-xl bg-gradient-to-t ${gradientFrom} ${gradientVia} ${gradientTo} transition-all duration-500 ease-out ${gradientHoverTo} hover:scale-x-110 shadow-[0_4px_12px_-4px_rgba(15,23,42,0.4)]`}
                            style={{ height: `${height}px` }}
                        />
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 group-hover:text-slate-900 transition-colors">
                            {bucket.shortLabel}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Vista de línea SVG. */
function LineView({ data, peakValue, lineColor }) {
    if (!data.length) return null;

    const stepX = CHART_W / data.length;
    // Los puntos se posicionan en el centro horizontal de cada columna
    const points = data.map((bucket, i) => ({
        x: (i + 0.5) * stepX,
        // Y invertido: 0 = arriba. Dejamos margen de 8 arriba y 8 abajo.
        y: CHART_H - 8 - Math.max(0, (bucket.value / peakValue) * (CHART_H - 16)),
        bucket,
    }));

    const polyline = points.map((p) => `${p.x},${p.y}`).join(' ');
    // Área de relleno: cierra el polígono por abajo
    const area = `${points[0].x},${CHART_H} ${polyline} ${points[points.length - 1].x},${CHART_H}`;
    const areaId = `area-${lineColor.replace('#', '')}`;

    return (
        <div className="mt-6">
            <svg
                viewBox={`0 0 ${CHART_W} ${CHART_H}`}
                preserveAspectRatio="none"
                className="w-full h-[130px]"
            >
                <defs>
                    <linearGradient id={areaId} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor={lineColor} stopOpacity="0.25" />
                        <stop offset="100%" stopColor={lineColor} stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                {/* Área de relleno bajo la línea */}
                <polygon points={area} fill={`url(#${areaId})`} />

                {/* Línea principal */}
                <polyline
                    points={polyline}
                    fill="none"
                    stroke={lineColor}
                    strokeWidth="1.4"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                />

                {/* Puntos con tooltip */}
                {points.map((p) => (
                    <g key={p.bucket.key}>
                        <circle cx={p.x} cy={p.y} r="2" fill={lineColor} />
                        <title>{`${p.bucket.monthLabel}: ${formatCurrency(p.bucket.value)}`}</title>
                    </g>
                ))}
            </svg>

            {/* Labels del eje X */}
            <div className="grid grid-cols-12 gap-2 mt-1">
                {data.map((bucket) => (
                    <div key={bucket.key} className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 text-center">
                        {bucket.shortLabel}
                    </div>
                ))}
            </div>
        </div>
    );
}

export function EconomiaBarChart({
    title,
    helper,
    data = EMPTY,
    gradientFrom = 'from-slate-950',
    gradientVia = 'via-slate-800',
    gradientTo = 'to-indigo-500',
    gradientHoverTo = 'hover:to-indigo-400',
    lineColor = '#6366f1',
}) {
    const [chartType, setChartType] = useState('bars');
    const peakValue = Math.max(1, ...data.map((b) => b.value));
    const isBars = chartType === 'bars';

    return (
        <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">{title}</h2>
                    <p className="mt-1 text-sm text-slate-500 font-medium">{helper}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-right shadow-inner">
                        <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">Pico</p>
                        <p className="text-sm font-bold text-slate-900 leading-none mt-1">{formatCurrency(peakValue)}</p>
                    </div>
                    {/* Botón de rotación — mismo tamaño que el recuadro Pico */}
                    <button
                        onClick={() => setChartType(isBars ? 'line' : 'bars')}
                        title={isBars ? 'Cambiar a línea' : 'Cambiar a barras'}
                        className="self-stretch rounded-2xl border border-slate-200 bg-slate-50/50 px-3 shadow-inner text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
                    >
                        {isBars ? <LineChart className="h-4 w-4" /> : <BarChart2 className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {isBars ? (
                <BarsView
                    data={data}
                    peakValue={peakValue}
                    gradientFrom={gradientFrom}
                    gradientVia={gradientVia}
                    gradientTo={gradientTo}
                    gradientHoverTo={gradientHoverTo}
                />
            ) : (
                <LineView data={data} peakValue={peakValue} lineColor={lineColor} />
            )}
        </div>
    );
}

export default EconomiaBarChart;
