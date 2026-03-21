import React from 'react';
import dayjs from 'dayjs';
import 'dayjs/locale/es';
import { 
    Briefcase, 
    User, 
    Calendar, 
    DollarSign, 
    FileText, 
    CheckCircle2, 
    Clock, 
    Shield 
} from 'lucide-react';
import { Badge } from '../ui/Badge';
import { getCaseStatusLabel } from '../../utils/caseStatus';

dayjs.locale('es');

/**
 * Componente que renderiza la Ficha Ejecutiva de un Expediente.
 * Diseñado para ser visualizado en modal y optimizado para impresión (PDF).
 */
export const CaseReportView = ({ data }) => {
    if (!data) return (
        <div className="p-8 text-center text-(--text-tertiary)">
            No hay datos disponibles para generar el reporte.
        </div>
    );

    const { caseData, participants, clients, events, honorarios, gastos, documents, multimedia, files, partes, generatedAt } = data;

    // Cálculos financieros con defensa extra por si llegan como objetos {data:[]}
    const honorariosList = Array.isArray(honorarios) ? honorarios : (honorarios?.data || []);
    const gastosList = Array.isArray(gastos) ? gastos : (gastos?.data || []);

    const totalHonorarios = honorariosList.reduce((acc, h) => acc + (Number(h.monto) || 0), 0);
    const totalEntregas = honorariosList.reduce((acc, h) => acc + (Number(h.total_entregas) || 0), 0);
    const totalGastos = gastosList.reduce((acc, g) => acc + (Number(g.monto) || 0), 0);
    const pendingBalance = Math.max(0, totalHonorarios - totalEntregas);

    const formatCurrency = (amount) => {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS',
        }).format(amount);
    };

    const formatDate = (date) => dayjs(date).format('DD [de] MMMM, YYYY');
    const safeKey = (...parts) => parts.filter(Boolean).join('-');
    const caseAssets = [
        ...(Array.isArray(documents) ? documents.map((d) => ({ ...d, type: 'Documento' })) : []),
        ...(Array.isArray(multimedia) ? multimedia.map((m) => ({ ...m, type: 'Multimedia' })) : []),
        ...(Array.isArray(files) ? files.map((f) => ({ ...f, type: 'Fichero' })) : []),
    ].sort((a, b) => dayjs(b.updated_at || b.created_at || b.synced_at).unix() - dayjs(a.updated_at || a.created_at || a.synced_at).unix());

    return (
        <div id="case-report-content" className="case-report-printable bg-white text-slate-900 p-0 sm:p-4 print:p-0">
            {/* Estilos específicos para impresión */}
            <style>{`
                @media print {
                    @page { size: portrait; margin: 20mm; }
                    body { background: white !important; color: black !important; }
                    .no-print { display: none !important; }
                    .case-report-printable { padding: 0 !important; width: 100% !important; }
                    .shadow-sm, .shadow-md, .shadow-lg { shadow: none !important; border: 1px solid #e2e8f0 !important; }
                }
            `}</style>

            {/* Encabezado Corporativo */}
            <div className="border-b-2 border-slate-800 pb-6 mb-8 flex justify-between items-start">
                <div>
                    <h1 className="text-3xl font-bold uppercase tracking-tight text-slate-900">
                        Ficha Ejecutiva del Expediente
                    </h1>
                    <p className="text-slate-500 mt-1 flex items-center gap-2">
                        < Shield size={14} /> SuitApp Legal Management System — Reporte Interno
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm font-semibold text-slate-700">Generado el:</p>
                    <p className="text-sm text-slate-500">{formatDate(generatedAt)}</p>
                </div>
            </div>

            {/* Información Principal del Caso */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <Briefcase className="text-slate-700" size={20} />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Información del Caso</h2>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 bg-slate-50 p-6 rounded-lg border border-slate-200">
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Carátula / Título</p>
                        <p className="text-lg font-bold text-slate-900">{caseData?.title || 'Sin Título'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Categoría / Tipo de Expediente</p>
                        <p className="text-slate-700 font-medium">{caseData?.case_type?.name || caseData?.category || 'General'}</p>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Estado del Proceso</p>
                        <div className="mt-1">
                            <Badge variant={getCaseStatusLabel(caseData) === 'Finalizado' ? 'success' : 'primary'}>
                                {getCaseStatusLabel(caseData)}
                            </Badge>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Fecha de Apertura</p>
                        <p className="text-slate-700 font-medium">{formatDate(caseData?.created_at || caseData?.start_date)}</p>
                    </div>
                </div>
            </section>

            {/* Resumen Financiero */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="text-slate-700" size={20} />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Situación Económica</h2>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div className="p-4 border border-slate-200 rounded-lg text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Honorarios Totales</p>
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(totalHonorarios)}</p>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-lg text-center bg-emerald-50/50">
                        <p className="text-xs font-bold text-emerald-600 uppercase mb-1">Cobrado / Percibido</p>
                        <p className="text-xl font-bold text-emerald-700">{formatCurrency(totalEntregas)}</p>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-lg text-center">
                        <p className="text-xs font-bold text-slate-400 uppercase mb-1">Gastos Incurridos</p>
                        <p className="text-xl font-bold text-slate-900">{formatCurrency(totalGastos)}</p>
                    </div>
                    <div className="p-4 border border-slate-200 rounded-lg text-center bg-amber-50/50">
                        <p className="text-xs font-bold text-amber-600 uppercase mb-1">Saldo Pendiente</p>
                        <p className="text-xl font-bold text-amber-700">{formatCurrency(pendingBalance)}</p>
                    </div>
                </div>
            </section>

            {/* Clientes y Participantes */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-8">
                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <User className="text-slate-700" size={18} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Clientes Vinculados</h2>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Nombre</th>
                                    <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Documento / Vínculo</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(clients) ? clients : (clients?.data || [])).length > 0 ? (Array.isArray(clients) ? clients : (clients?.data || [])).map((c) => (
                                    <tr key={safeKey('client', c.id, c.document_number, c.dni, c.name)} className="border-b border-slate-100 last:border-0">
                                        <td className="px-4 py-2 font-medium text-slate-900">{c.name}</td>
                                        <td className="px-4 py-2 text-slate-500 text-xs">{c.dni || c.document_number || 'S/D'}</td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan="2" className="px-4 py-4 text-center text-slate-400 italic">No hay clientes asociados</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </section>

                <section>
                    <div className="flex items-center gap-2 mb-4">
                        <Shield className="text-slate-700" size={18} />
                        <h2 className="text-lg font-bold text-slate-800 uppercase tracking-wide">Responsables Internos</h2>
                    </div>
                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                        <table className="w-full text-sm">
                            <thead className="bg-slate-50 border-b border-slate-200">
                                <tr>
                                    <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Nombre</th>
                                    <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Rol</th>
                                </tr>
                            </thead>
                            <tbody>
                                {(Array.isArray(participants) ? participants : (participants?.data || [])).length > 0
                                    ? (Array.isArray(participants) ? participants : (participants?.data || [])).map((p) => {
                                        const isOwner = p.tag && caseData?.owner_tag && p.tag === caseData.owner_tag;
                                        return (
                                            <tr key={safeKey('participant', p.id, p.tag, p.name)} className="border-b border-slate-100 last:border-0">
                                                <td className="px-4 py-2 font-medium text-slate-900">{p.name || p.tag}</td>
                                                <td className="px-4 py-2">
                                                    <Badge variant={isOwner ? 'default' : 'secondary'} className="text-[10px]">
                                                        {isOwner ? 'Dueño del caso' : (p.role_name || 'Participante')}
                                                    </Badge>
                                                </td>
                                            </tr>
                                        );
                                    })
                                    : (
                                        <tr>
                                            <td colSpan="2" className="px-4 py-4 text-center text-slate-400 italic">Sin personal asignado</td>
                                        </tr>
                                    )
                                }
                            </tbody>
                        </table>
                    </div>
                </section>
            </div>

            {/* Partes Intervinientes */}
            <section className="mb-8">
                <div className="flex items-center gap-2 mb-4">
                    <User className="text-slate-700" size={20} />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Partes Intervinientes (Tribunal y Contrapartes)</h2>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Nombre y Apellido</th>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase text-center w-48">Rol / Carácter</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(Array.isArray(partes) ? partes : []).length > 0 ? partes.map((p) => (
                                <tr key={safeKey('parte', p.id, p.nombre, p.apellido)} className="border-b border-slate-100 last:border-0 hover:bg-slate-50/50 transition-colors">
                                    <td className="px-4 py-2 font-medium text-slate-900">
                                        {p.nombre} {p.apellido}
                                    </td>
                                    <td className="px-4 py-2 text-center">
                                        <Badge variant="ghost" className="text-[10px] uppercase font-bold tracking-wider">
                                            {p.rol?.titulo || 'Parte'}
                                        </Badge>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="2" className="px-4 py-6 text-center text-slate-400 italic">No se han registrado partes intervinientes externas</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Detalle Cronológico de Honorarios y Pagos */}
            <section className="mb-8 page-break-inside-avoid">
                <div className="flex items-center gap-2 mb-4">
                    <Clock className="text-slate-700" size={20} />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Desglose de Honorarios y Cobros</h2>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase w-32">Fecha</th>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Concepto / Detalle</th>
                                <th className="px-4 py-2 text-right font-bold text-slate-500 uppercase w-32">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {honorariosList.length > 0 ? honorariosList.flatMap((h) => {
                                const rows = [];
                                const honorarioKey = safeKey('honorario', h.id, h.created_at, h.detalles);
                                // Fila del Honorario Pactado
                                rows.push(
                                    <tr key={honorarioKey} className="border-b border-slate-100 bg-slate-50/30">
                                        <td className="px-4 py-2 text-slate-500">{dayjs(h.created_at || h.synced_at).format('DD/MM/YYYY')}</td>
                                        <td className="px-4 py-2 font-bold text-slate-900">Honorario: {h.detalles || 'Sin descripción'}</td>
                                        <td className="px-4 py-2 text-right font-bold text-slate-900">{formatCurrency(h.monto)}</td>
                                    </tr>
                                );
                                // Filas de las entregas (pagos) asociadas
                                (h.entregas || []).forEach((e) => {
                                    rows.push(
                                        <tr key={safeKey(honorarioKey, 'entrega', e.id, e.created_at, e.monto)} className="border-b border-slate-100 italic">
                                            <td className="px-8 py-1 text-slate-400 text-xs">— {dayjs(e.created_at || e.synced_at).format('DD/MM/YYYY')}</td>
                                            <td className="px-4 py-1 text-emerald-600 text-xs">Pago: {e.nota || 'A cuenta de honorarios'}</td>
                                            <td className="px-4 py-1 text-right text-emerald-600 text-xs">({formatCurrency(e.monto)})</td>
                                        </tr>
                                    );
                                });
                                return rows;
                            }) : (
                                <tr>
                                    <td colSpan="3" className="px-4 py-8 text-center text-slate-400 italic">No se han registrado movimientos de honorarios</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Detalle de Gastos */}
            <section className="mb-8 page-break-inside-avoid">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="text-slate-700" size={20} />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Detalle de Gastos Incurridos</h2>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase w-32">Fecha</th>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Concepto</th>
                                <th className="px-4 py-2 text-right font-bold text-slate-500 uppercase w-32">Monto</th>
                            </tr>
                        </thead>
                        <tbody>
                            {gastosList.length > 0 ? gastosList.map((g) => (
                                <tr key={safeKey('gasto', g.id, g.created_at, g.titulo, g.detalles)} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-2 text-slate-500">{dayjs(g.created_at || g.synced_at).format('DD/MM/YYYY')}</td>
                                    <td className="px-4 py-2 text-slate-900">{g.detalles || g.titulo || 'Gasto registrado'}</td>
                                    <td className="px-4 py-2 text-right font-medium text-slate-700">{formatCurrency(g.monto)}</td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="3" className="px-4 py-8 text-center text-slate-400 italic">No hay gastos detallados en este expediente</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Gestión de Documentos y Archivos */}
            <section className="mb-8 page-break-inside-avoid">
                <div className="flex items-center gap-2 mb-4">
                    <FileText className="text-slate-700" size={20} />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Acervo Documental y Archivos</h2>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase w-32">Fecha</th>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Nombre del Archivo / Documento</th>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase w-32 text-center">Tipo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {caseAssets.length > 0 ? caseAssets.map((item) => (
                                <tr key={safeKey('asset', item.type, item.id, item.updated_at, item.created_at, item.filename, item.title, item.name)} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-2 text-slate-500">{dayjs(item.updated_at || item.created_at || item.synced_at).format('DD/MM/YYYY')}</td>
                                    <td className="px-4 py-2 font-medium text-slate-900">{item.name || item.title || item.filename || 'Sin título'}</td>
                                    <td className="px-4 py-2 text-center">
                                        <Badge variant="ghost" className="text-[9px] uppercase">
                                            {item.type}
                                        </Badge>
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="3" className="px-4 py-8 text-center text-slate-400 italic">No hay documentos o archivos cargados en este expediente</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Actividad Reciente */}
            <section className="mb-8 page-break-before">
                <div className="flex items-center gap-2 mb-4">
                    <Calendar className="text-slate-700" size={20} />
                    <h2 className="text-xl font-bold text-slate-800 uppercase tracking-wide">Cronograma de Actividad</h2>
                </div>
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-sm">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase w-32">Fecha</th>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase">Hito / Actuación</th>
                                <th className="px-4 py-2 text-left font-bold text-slate-500 uppercase w-24 text-center">Tipo</th>
                            </tr>
                        </thead>
                        <tbody>
                            {(Array.isArray(events) ? events : (events?.data || [])).length > 0 ? (Array.isArray(events) ? events : (events?.data || [])).slice(0, 10).map((e) => (
                                <tr key={safeKey('event', e.id, e.starts_at, e.date, e.title, e.name)} className="border-b border-slate-100 last:border-0">
                                    <td className="px-4 py-2 font-medium text-slate-700">{dayjs(e.starts_at || e.date).format('DD/MM/YYYY')}</td>
                                    <td className="px-4 py-2 text-slate-900">{e.title || e.name || 'Sin descripción'}</td>
                                    <td className="px-4 py-2 text-center">
                                        {e.event_type?.name === 'Vencimiento' ? (
                                            <Badge variant="warning">Vencimiento</Badge>
                                        ) : (
                                            <Badge variant="ghost">Evento</Badge>
                                        )}
                                    </td>
                                </tr>
                            )) : (
                                <tr>
                                    <td colSpan="3" className="px-4 py-8 text-center text-slate-400 italic">No hay historial de eventos registrado</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
                {events?.length > 10 && (
                    <p className="mt-2 text-[10px] text-slate-400 italic text-right">* Mostrando sólo los últimos 10 hitos relevantes.</p>
                )}
            </section>

            {/* Firmas / Sello (Solo para papel) */}
            <div className="mt-16 hidden print:block">
                <div className="flex justify-end gap-12">
                    <div className="w-48 border-t border-slate-400 text-center pt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Sello del Estudio</p>
                    </div>
                    <div className="w-48 border-t border-slate-400 text-center pt-2">
                        <p className="text-[10px] font-bold text-slate-400 uppercase">Firma del Responsable</p>
                    </div>
                </div>
            </div>

            {/* Advertencia Legal */}
            <footer className="mt-12 pt-4 border-t border-slate-200 text-center">
                <p className="text-[9px] text-slate-400 leading-relaxed max-w-2xl mx-auto">
                    Este documento contiene información confidencial sujeta al secreto profesional. Su divulgación no autorizada está prohibida bajo las normas de ética profesional y protección de datos personales vigentes. Generado automáticamente por SuitApp Legal Management.
                </p>
            </footer>
        </div>
    );
};
