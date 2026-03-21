import { Calendar, AlertCircle, AlertTriangle, Clock } from 'lucide-react';
import { useMemo } from 'react';
import { format, addDays } from 'date-fns';

/**
 * Cards de resumen de vencimientos.
 * - Vencidos: al hacer click muestra SOLO los vencidos
 * - Hoy / Esta semana / Este mes: muestra todos menos cumplidos, filtrado por rango
 */
export default function DeadlineKPICards({ deadlines, activeFilter, onFilterVencidos, onFilterDate }) {
    const counts = useMemo(() => {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const nextWeekStr = format(addDays(new Date(), 7), 'yyyy-MM-dd');
        const nextMonthStr = format(addDays(new Date(), 30), 'yyyy-MM-dd');

        let vencidos = 0;
        let hoy = 0;
        let semana = 0;
        let mes = 0;

        for (const d of deadlines) {
            if (d.status === 'Cumplido') continue;
            const due = d.due_date?.slice(0, 10);
            if (!due) continue;

            if (d.status === 'Vencido') {
                vencidos++;
            } else if (due === todayStr) {
                hoy++;
            } else if (due > todayStr && due <= nextWeekStr) {
                semana++;
            } else if (due > nextWeekStr && due <= nextMonthStr) {
                mes++;
            }
        }

        // Acumulados para mostrar en la card
        return { vencidos, hoy, semana: semana + hoy, mes: mes + semana + hoy };
    }, [deadlines]);

    const cardBase = 'p-4 rounded-xl border shadow-sm cursor-pointer hover:scale-105 transition-transform group';

    return (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-2">
            <button
                type="button"
                onClick={onFilterVencidos}
                className={`${cardBase} ${activeFilter === 'vencidos' ? 'ring-2 ring-red-500' : ''} bg-(--bg-card) border-red-200 text-left w-full`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-red-600 font-medium">Vencidos</p>
                        <p className="text-2xl font-bold text-red-700">{counts.vencidos}</p>
                    </div>
                    <div className="p-3 bg-red-100 rounded-full group-hover:bg-red-200 transition-colors">
                        <AlertCircle className="w-6 h-6 text-red-600" />
                    </div>
                </div>
            </button>

            <button
                type="button"
                onClick={() => onFilterDate('hoy')}
                className={`${cardBase} ${activeFilter === 'hoy' ? 'ring-2 ring-orange-500' : ''} bg-(--bg-card) border-orange-200 text-left w-full`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-orange-600 font-medium">Hoy</p>
                        <p className="text-2xl font-bold text-orange-700">{counts.hoy}</p>
                    </div>
                    <div className="p-3 bg-orange-100 rounded-full group-hover:bg-orange-200 transition-colors">
                        <AlertTriangle className="w-6 h-6 text-orange-600" />
                    </div>
                </div>
            </button>

            <button
                type="button"
                onClick={() => onFilterDate('semana')}
                className={`${cardBase} ${activeFilter === 'semana' ? 'ring-2 ring-blue-500' : ''} bg-(--bg-card) border-blue-200 text-left w-full`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-blue-600 font-medium">Esta semana</p>
                        <p className="text-2xl font-bold text-blue-700">{counts.semana}</p>
                    </div>
                    <div className="p-3 bg-blue-100 rounded-full group-hover:bg-blue-200 transition-colors">
                        <Clock className="w-6 h-6 text-blue-600" />
                    </div>
                </div>
            </button>

            <button
                type="button"
                onClick={() => onFilterDate('mes')}
                className={`${cardBase} ${activeFilter === 'mes' ? 'ring-2 ring-slate-500' : ''} bg-(--bg-card) border-slate-200 text-left w-full`}
            >
                <div className="flex items-center justify-between">
                    <div>
                        <p className="text-sm text-(--text-secondary) font-medium">Este mes</p>
                        <p className="text-2xl font-bold text-(--text-primary)">{counts.mes}</p>
                    </div>
                    <div className="p-3 bg-slate-100 rounded-full group-hover:bg-slate-200 transition-colors">
                        <Calendar className="w-6 h-6 text-slate-600" />
                    </div>
                </div>
            </button>
        </div>
    );
}
