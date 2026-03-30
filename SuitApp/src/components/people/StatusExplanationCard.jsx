import React from 'react';
import { Info, ShieldCheck, CreditCard, AlertCircle } from 'lucide-react';
import { Badge } from '../ui/Badge';

/**
 * Tarjeta premium que explica los estados de la persona (Actividad y Situación Financiera).
 */
export function StatusExplanationCard({ status, financialStatus }) {
    const getFinancialStatusVariant = (s) => {
        const norm = String(s || '').toLowerCase();
        if (norm === 'moroso') return 'danger';
        if (norm === 'deudor') return 'warning';
        if (norm === 'no deudor') return 'success';
        return 'default';
    };

    const getStatusVariant = (s) => {
        const norm = String(s || '').toLowerCase();
        if (norm === 'activo') return 'success';
        if (norm === 'inactivo') return 'danger';
        return 'default';
    };

    return (
        <div className="bg-(--bg-card) p-6 rounded-xl shadow-sm border border-(--border-subtle) space-y-6">
            <h3 className="text-lg font-semibold text-(--text-primary) flex items-center gap-2">
                <Info size={18} className="text-blue-500" />
                Estado y Situación
            </h3>

            <div className="space-y-5">
                {/* Actividad */}
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-xs font-bold uppercase tracking-wider text-(--text-tertiary) flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-green-500" />
                            Actividad
                        </span>
                        {status && <Badge variant={getStatusVariant(status)} className="capitalize">{status}</Badge>}
                    </div>
                    <p className="text-sm text-(--text-secondary) leading-relaxed">
                        Este estado indica si la persona se encuentra vinculada actualmente a un <span className="text-(--text-primary) font-medium">caso activo</span> en el despacho.
                    </p>
                </div>

                {/* Situación Financiera */}
                {financialStatus && (
                    <div className="space-y-3 border-t border-(--border-subtle) pt-5">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-bold uppercase tracking-wider text-(--text-tertiary) flex items-center gap-1.5">
                                <CreditCard size={14} className="text-blue-500" />
                                Situación Financiera
                            </span>
                            <Badge variant={getFinancialStatusVariant(financialStatus)} className="capitalize">{financialStatus}</Badge>
                        </div>
                        
                        <div className="space-y-3">
                            <p className="text-sm text-(--text-secondary) leading-relaxed">
                                Refleja la situación actual de <span className="text-(--text-primary) font-medium">pagos y honorarios</span> del cliente.
                            </p>

                            {/* Definiciones dinámicas */}
                            <div className="flex gap-3 p-3 rounded-lg bg-(--bg-card-hover) border border-(--border-subtle)">
                                <AlertCircle size={16} className="text-(--text-tertiary) shrink-0 mt-0.5" />
                                <div className="text-[12px] leading-snug">
                                    {financialStatus.toLowerCase() === 'no deudor' && (
                                        <p className="text-green-600/90 dark:text-green-400/90">
                                            <strong className="uppercase tracking-tighter mr-1">No deudor:</strong> 
                                            Cliente que tiene saldados sus honorarios o no tiene honorarios asociados.
                                        </p>
                                    )}
                                    {financialStatus.toLowerCase() === 'deudor' && (
                                        <p className="text-yellow-600/90 dark:text-yellow-400/90">
                                            <strong className="uppercase tracking-tighter mr-1">Deudor:</strong> 
                                            Cliente que debe honorarios.
                                        </p>
                                    )}
                                    {financialStatus.toLowerCase() === 'moroso' && (
                                        <p className="text-red-600/90 dark:text-red-400/90">
                                            <strong className="uppercase tracking-tighter mr-1">Moroso:</strong> 
                                            Persona que no ha realizado entregas sobre un honorario pendiente en un plazo superior a 30 días.
                                        </p>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default StatusExplanationCard;
