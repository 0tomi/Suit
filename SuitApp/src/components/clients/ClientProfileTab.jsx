import { Calendar, Briefcase, Phone, Mail, MapPin } from 'lucide-react';
import { format, parseISO } from 'date-fns';

function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return format(parseISO(String(dateStr).replace(' ', 'T')), 'dd/MM/yyyy');
    } catch {
        return '—';
    }
}

const ClientProfileTab = ({ clientData, fullName }) => (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-in fade-in duration-300">
        <div className="md:col-span-2 bg-(--bg-card) p-6 rounded-xl shadow-sm border border-(--border-subtle) space-y-6">
            <h3 className="text-lg font-semibold text-(--text-primary) border-b border-(--border-subtle) pb-2">Información Personal</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <div>
                    <span className="text-xs text-(--text-tertiary) uppercase font-bold block mb-1">Nombre Completo</span>
                    <p className="text-(--text-primary) font-medium">{fullName}</p>
                </div>
                <div>
                    <span className="text-xs text-(--text-tertiary) uppercase font-bold block mb-1">Identificación</span>
                    <p className="text-(--text-primary) font-medium">{clientData.identification_number || '—'}</p>
                </div>
                <div>
                    <span className="text-xs text-(--text-tertiary) uppercase font-bold block mb-1">Tipo</span>
                    <p className="text-(--text-primary) font-medium">{clientData.type || '—'}</p>
                </div>
                <div>
                    <span className="text-xs text-(--text-tertiary) uppercase font-bold block mb-1">Fecha Registro</span>
                    <div className="flex items-center gap-2 text-(--text-primary) font-medium">
                        <Calendar size={16} className="text-(--text-secondary)" /> {formatDate(clientData.created_at)}
                    </div>
                </div>
                <div>
                    <span className="text-xs text-(--text-tertiary) uppercase font-bold block mb-1">Ocupación / Notas</span>
                    <div className="flex items-center gap-2 text-(--text-primary) font-medium whitespace-nowrap overflow-hidden text-ellipsis">
                        <Briefcase size={16} className="text-(--text-secondary) shrink-0" /> {clientData.notes ? clientData.notes.substring(0, 30) + '...' : '—'}
                    </div>
                </div>
            </div>

            <h3 className="text-lg font-semibold text-(--text-primary) border-b border-(--border-subtle) pb-2 pt-4">Datos de Contacto</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-6 gap-x-4">
                <div>
                    <span className="text-xs text-(--text-tertiary) uppercase font-bold block mb-1">Teléfono</span>
                    <div className="flex items-center gap-2 text-(--text-primary) font-medium">
                        <Phone size={16} className="text-(--text-secondary)" /> {clientData.phone || '—'}
                    </div>
                </div>
                <div>
                    <span className="text-xs text-(--text-tertiary) uppercase font-bold block mb-1">Email</span>
                    <div className="flex items-center gap-2 text-(--text-primary) font-medium">
                        <Mail size={16} className="text-(--text-secondary)" /> {clientData.email || '—'}
                    </div>
                </div>
                <div className="sm:col-span-2">
                    <span className="text-xs text-(--text-tertiary) uppercase font-bold block mb-1">Dirección</span>
                    <div className="flex items-center gap-2 text-(--text-primary) font-medium">
                        <MapPin size={16} className="text-(--text-secondary)" /> {clientData.address || '—'}
                    </div>
                </div>
            </div>
        </div>

        <div className="bg-(--bg-card) p-6 rounded-xl shadow-sm border border-(--border-subtle) h-fit">
            <h3 className="text-lg font-semibold text-(--text-primary) mb-4">Notas Internas</h3>
            <textarea
                className="w-full bg-amber-900/10 dark:bg-amber-900/20 text-(--text-primary) border border-amber-700/30 p-3 rounded-lg text-sm min-h-[150px] focus:ring-2 focus:ring-amber-400 outline-none"
                value={clientData.notes || ''}
                readOnly
            />
        </div>
    </div>
);

export default ClientProfileTab;
