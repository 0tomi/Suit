/**
 * HonorariosVsGastosChart — Comparación mensual Honorarios vs Gastos.
 * Soporta modo barras (dos barras por mes) y modo línea (dos líneas SVG).
 *
 * Props:
 *   data — Array de 12 buckets { key, shortLabel, monthLabel, honorarios, gastos }
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

/** Vista de barras duales. */
function BarsView({ data, peakValue }) {
    return (
        <div className="mt-6 grid grid-cols-12 items-end gap-2 h-[160px]">
            {data.map((bucket) => {
                const hHeight = Math.max(10, Math.round((bucket.honorarios / peakValue) * 130));
                const gHeight = Math.max(10, Math.round((bucket.gastos / peakValue) * 130));
                return (
                    <div
                        key={bucket.key}
                        className="group relative flex flex-col items-center gap-2 h-full justify-end"
                        title={`${bucket.monthLabel}: Hon. ${formatCurrency(bucket.honorarios)} / Gastos ${formatCurrency(bucket.gastos)}`}
                    >
                        <div className="absolute -top-6 opacity-0 transition-all group-hover:opacity-100 group-hover:-top-8 z-10 pointer-events-none w-max">
                            <span className="whitespace-nowrap rounded-lg bg-slate-900 px-2 py-1 text-[9px] font-bold text-white shadow-xl italic">
                                {formatCurrency(bucket.honorarios)} / {formatCurrency(bucket.gastos)}
                            </span>
                        </div>
                        <div className="flex items-end gap-[2px] w-full h-[130px]">
                            <div
                                className="flex-1 rounded-t-lg bg-gradient-to-t from-indigo-950 via-indigo-700 to-indigo-400 transition-all duration-500 ease-out hover:to-indigo-300 shadow-[0_4px_12px_-4px_rgba(99,102,241,0.4)]"
                                style={{ height: `${hHeight}px` }}
                            />
                            <div
                                className="flex-1 rounded-t-lg bg-gradient-to-t from-rose-950 via-rose-700 to-rose-400 transition-all duration-500 ease-out hover:to-rose-300 shadow-[0_4px_12px_-4px_rgba(244,63,94,0.4)]"
                                style={{ height: `${gHeight}px` }}
                            />
                        </div>
                        <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-400 group-hover:text-slate-900 transition-colors">
                            {bucket.shortLabel}
                        </div>
                    </div>
                );
            })}
        </div>
    );
}

/** Construye los puntos SVG para una serie de valores. */
function buildSvgPoints(data, field, peakValue) {
    const stepX = CHART_W / data.length;
    return data.map((bucket, i) => ({
        x: (i + 0.5) * stepX,
        y: CHART_H - 8 - Math.max(0, (bucket[field] / peakValue) * (CHART_H - 16)),
        bucket,
    }));
}

/** Vista de dos líneas SVG. */
function LineView({ data, peakValue }) {
    if (!data.length) return null;

    const hPoints = buildSvgPoints(data, 'honorarios', peakValue);
    const gPoints = buildSvgPoints(data, 'gastos', peakValue);

    const hPolyline = hPoints.map((p) => `${p.x},${p.y}`).join(' ');
    const gPolyline = gPoints.map((p) => `${p.x},${p.y}`).join(' ');

    const hArea = `${hPoints[0].x},${CHART_H} ${hPolyline} ${hPoints[hPoints.length - 1].x},${CHART_H}`;
    const gArea = `${gPoints[0].x},${CHART_H} ${gPolyline} ${gPoints[gPoints.length - 1].x},${CHART_H}`;

    return (
        <div className="mt-6">
            <svg viewBox={`0 0 ${CHART_W} ${CHART_H}`} preserveAspectRatio="none" className="w-full h-[130px]">
                <defs>
                    <linearGradient id="hvg-h-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#6366f1" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#6366f1" stopOpacity="0.02" />
                    </linearGradient>
                    <linearGradient id="hvg-g-area" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#f43f5e" stopOpacity="0.2" />
                        <stop offset="100%" stopColor="#f43f5e" stopOpacity="0.02" />
                    </linearGradient>
                </defs>

                <polygon points={hArea} fill="url(#hvg-h-area)" />
                <polygon points={gArea} fill="url(#hvg-g-area)" />

                <polyline points={hPolyline} fill="none" stroke="#6366f1" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />
                <polyline points={gPolyline} fill="none" stroke="#f43f5e" strokeWidth="1.4" strokeLinejoin="round" strokeLinecap="round" />

                {hPoints.map((p) => (
                    <g key={`h-${p.bucket.key}`}>
                        <circle cx={p.x} cy={p.y} r="2" fill="#6366f1" />
                        <title>{`${p.bucket.monthLabel} — Hon.: ${formatCurrency(p.bucket.honorarios)}`}</title>
                    </g>
                ))}
                {gPoints.map((p) => (
                    <g key={`g-${p.bucket.key}`}>
                        <circle cx={p.x} cy={p.y} r="2" fill="#f43f5e" />
                        <title>{`${p.bucket.monthLabel} — Gastos: ${formatCurrency(p.bucket.gastos)}`}</title>
                    </g>
                ))}
            </svg>

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

export function HonorariosVsGastosChart({ data = EMPTY }) {
    const [chartType, setChartType] = useState('bars');
    const isBars = chartType === 'bars';
    const peakValue = Math.max(1, ...data.map((b) => b.honorarios), ...data.map((b) => b.gastos));

    return (
        <div className="rounded-[32px] border border-slate-200/80 bg-white p-6 shadow-sm ring-1 ring-slate-900/5">
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h2 className="text-xl font-bold text-slate-900 tracking-tight">Honorarios vs Gastos</h2>
                    <p className="mt-1 text-sm text-slate-500 font-medium">
                        Comparativa mensual entre lo facturado y los gastos registrados.
                    </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                    {/* Leyenda */}
                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-sm bg-indigo-500" />
                            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Hon.</span>
                        </div>
                        <div className="flex items-center gap-1.5">
                            <span className="inline-block h-2 w-2 rounded-sm bg-rose-500" />
                            <span className="text-[9px] font-semibold uppercase tracking-widest text-slate-500">Gastos</span>
                        </div>
                    </div>
                    {/* Botón de rotación — mismo tamaño visual que el recuadro de leyenda */}
                    <button
                        onClick={() => setChartType(isBars ? 'line' : 'bars')}
                        title={isBars ? 'Cambiar a línea' : 'Cambiar a barras'}
                        className="self-stretch rounded-2xl border border-slate-200 bg-slate-50/50 px-3 shadow-inner text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 flex items-center justify-center"
                    >
                        {isBars ? <LineChart className="h-4 w-4" /> : <BarChart2 className="h-4 w-4" />}
                    </button>
                </div>
            </div>

            {isBars
                ? <BarsView data={data} peakValue={peakValue} />
                : <LineView data={data} peakValue={peakValue} />
            }
        </div>
    );
}

export default HonorariosVsGastosChart;
