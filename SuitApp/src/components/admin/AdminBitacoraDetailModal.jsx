import { Clock3, FileText, Shield, UserRound } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Badge } from '../ui/Badge.jsx';
import {
    BITACORA_ENTITY_TYPE_LABELS,
    resolveBitacoraActionLabel,
} from '../../services/adminBitacoraService.js';

const dateFormatter = new Intl.DateTimeFormat('es-AR', {
    dateStyle: 'medium',
    timeStyle: 'short',
});

function formatDate(value) {
    if (!value) return 'Sin fecha';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return String(value);
    return dateFormatter.format(parsed);
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}(T[\d:.]+Z?)?$/;

function looksLikeDate(value) {
    return typeof value === 'string' && ISO_DATE_RE.test(value.trim());
}

const FIELD_LABELS = {
    // Fechas
    created_at: 'Fecha de creación',
    updated_at: 'Fecha de actualización',
    deleted_at: 'Fecha de eliminación',
    date: 'Fecha',
    start_date: 'Fecha de inicio',
    end_date: 'Fecha de fin',
    due_date: 'Fecha de vencimiento',
    starts_at: 'Inicio',
    ends_at: 'Fin',
    // Generales
    id: 'ID',
    name: 'Nombre',
    title: 'Título',
    description: 'Descripción',
    status: 'Estado',
    type: 'Tipo',
    notes: 'Notas',
    reason: 'Motivo',
    active: 'Activo',
    number: 'Número',
    content: 'Contenido',
    version: 'Versión',
    locked: 'Bloqueado',
    tags: 'Etiquetas',
    amount: 'Monto',
    observations: 'Observaciones',
    // IDs de relaciones
    user_id: 'ID del usuario',
    client_id: 'ID del cliente',
    lawyer_id: 'ID del abogado',
    case_id: 'ID del caso',
    suit_case_id: 'ID del expediente',
    document_id: 'ID del documento',
    honorario_id: 'ID del honorario',
    tax_id: 'ID del gasto',
    fee_id: 'ID del honorario',
    delivery_id: 'ID de la entrega',
    radicacion_id: 'ID de la radicación',
    jurisdiction_id: 'ID de la jurisdicción',
    competency_id: 'ID de la competencia',
    role_id: 'ID del rol',
    agenda_id: 'ID de la agenda',
    event_id: 'ID del evento',
    // Entidades relacionadas (objetos anidados)
    honorario: 'Honorario',
    suit_case: 'Expediente',
    client: 'Cliente',
    lawyer: 'Abogado',
    user: 'Usuario',
    document: 'Documento',
    agenda: 'Agenda',
    event: 'Evento',
    role: 'Rol',
    jurisdiction: 'Jurisdicción',
    competency: 'Competencia',
    // Campos específicos
    monto: 'Monto',
    detalles: 'Detalles',
    pagado: 'Pagado',
    email: 'Email',
    phone: 'Teléfono',
    phone_number: 'Teléfono',
    mobile: 'Móvil',
    address: 'Dirección',
    first_name: 'Nombre',
    last_name: 'Apellido',
    file_path: 'Ruta del archivo',
    size: 'Tamaño',
    mime_type: 'Tipo de archivo',
    city: 'Ciudad',
    province: 'Provincia',
    country: 'País',
    zip: 'Código postal',
    dni: 'DNI',
    cuit: 'CUIT',
    website: 'Sitio web',
    summary: 'Resumen',
    color: 'Color',
    location: 'Lugar',
};

function getActionBadgeVariant(action) {
    switch (action) {
        case 'created':
        case 'uploaded':
        case 'photo_uploaded':
        case 'participant_added':
            return 'success';
        case 'deleted':
        case 'participant_removed':
            return 'danger';
        case 'closed':
        case 'locked':
        case 'status_updated':
        case 'name_updated':
            return 'warning';
        case 'updated':
        case 'reopened':
        case 'unlocked':
        default:
            return 'info';
    }
}

function prettifyKey(key) {
    const normalized = String(key || '').trim();
    if (FIELD_LABELS[normalized]) return FIELD_LABELS[normalized];
    return normalized
        .replaceAll('_', ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, (chunk) => chunk.toUpperCase());
}

function formatScalarValue(value) {
    if (value === null || value === undefined) return '—';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (typeof value === 'string') {
        const trimmed = value.trim();
        if (!trimmed) return '—';
        if (looksLikeDate(trimmed)) return formatDate(trimmed);
        return trimmed;
    }
    return String(value);
}

function isObjectValue(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function resolveActorName(entry) {
    const fullName = [entry?.user?.name, entry?.user?.lastName].filter(Boolean).join(' ').trim();
    return fullName || 'Usuario sin nombre';
}

function resolveEntityLabel(entry) {
    return BITACORA_ENTITY_TYPE_LABELS[entry?.entityInfo?.type] || entry?.entityInfo?.type || 'Entidad desconocida';
}

function DetailCard({ icon: Icon, label, value }) {
    return (
        <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3">
            <p className="flex items-center gap-2 text-xs uppercase tracking-wider text-(--text-tertiary)">
                {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
                {label}
            </p>
            <p className="mt-1 text-sm font-medium text-(--text-primary)">{value}</p>
        </div>
    );
}

const AdminBitacoraDetailModal = ({ open, onClose, entry }) => {
    const attributes = entry?.entityInfo?.data?.attributes || {};
    const attributeEntries = Object.entries(attributes).sort(([leftKey], [rightKey]) =>
        leftKey.localeCompare(rightKey, 'es'),
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Detalle del movimiento"
            subtitle="Datos disponibles del movimiento seleccionado."
            maxWidth="max-w-4xl"
        >
            {!entry ? (
                <div className="py-10 text-center text-(--text-secondary)">No hay un movimiento seleccionado.</div>
            ) : (
                <div className="space-y-6">
                    <div className="rounded-2xl border border-(--border-default) bg-(--bg-card)">
                        <div className="rounded-[calc(theme(borderRadius.2xl)-1px)] bg-linear-to-r from-blue-500/10 via-cyan-500/10 to-transparent p-5">
                        <div className="flex flex-wrap items-center gap-3">
                            <Badge variant={getActionBadgeVariant(entry.action)}>
                                {resolveBitacoraActionLabel(entry.action)}
                            </Badge>
                            <Badge variant="default">
                                {resolveEntityLabel(entry)}
                            </Badge>
                        </div>
                        <h3 className="mt-3 text-xl font-semibold text-(--text-primary)">
                            {entry.entityInfo?.name || entry.entityInfo?.data?.name || 'Sin datos para mostrar'}
                        </h3>
                        <p className="mt-1 text-sm text-(--text-secondary)">
                            {resolveActorName(entry)} realizó este movimiento el {formatDate(entry.createdAt)}.
                        </p>
                    </div>
                    </div>

                    <section className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Movimiento</h4>
                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                            <DetailCard icon={Clock3} label="Fecha" value={formatDate(entry.createdAt)} />
                            <DetailCard icon={Shield} label="Acción" value={resolveBitacoraActionLabel(entry.action)} />
                            <DetailCard icon={FileText} label="Entidad" value={resolveEntityLabel(entry)} />
                            <DetailCard icon={FileText} label="Entidad ID" value={entry.entityInfo?.id != null ? String(entry.entityInfo.id) : 'Sin ID'} />
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Actor</h4>
                        <div className="grid gap-3 md:grid-cols-3">
                            <DetailCard icon={UserRound} label="Nombre" value={resolveActorName(entry)} />
                            <DetailCard icon={UserRound} label="Usuario ID" value={entry.user?.id != null ? String(entry.user.id) : 'Sin ID'} />
                            <DetailCard icon={Shield} label="Estado" value={entry.user ? 'Usuario identificado' : 'Sin datos para mostrar'} />
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Entidad afectada</h4>
                        <div className="grid gap-3 md:grid-cols-3">
                            <DetailCard icon={FileText} label="Nombre" value={entry.entityInfo?.data?.name || entry.entityInfo?.name || 'Sin datos para mostrar'} />
                            <DetailCard icon={FileText} label="Tipo" value={resolveEntityLabel(entry)} />
                            <DetailCard icon={FileText} label="ID" value={entry.entityInfo?.data?.id != null ? String(entry.entityInfo.data.id) : (entry.entityInfo?.id != null ? String(entry.entityInfo.id) : 'Sin ID')} />
                        </div>
                    </section>

                    <section className="space-y-3">
                        <h4 className="text-sm font-semibold uppercase tracking-wide text-(--text-secondary)">Datos del registro</h4>
                        {entry.entityInfo?.data === null ? (
                            <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
                                Sin datos para mostrar.
                            </div>
                        ) : attributeEntries.length === 0 ? (
                            <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3 text-sm text-(--text-secondary)">
                                Sin datos para mostrar.
                            </div>
                        ) : (
                            <div className="grid gap-3 md:grid-cols-2">
                                {attributeEntries.map(([key, value]) => (
                                    isObjectValue(value) ? (
                                        <div key={key} className="col-span-full rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3">
                                            <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">{prettifyKey(key)}</p>
                                            <div className="mt-2 grid gap-2 sm:grid-cols-2">
                                                {Object.entries(value).map(([subKey, subVal]) => (
                                                    <div key={subKey} className="rounded-lg border border-(--border-subtle) bg-(--bg-card) px-3 py-2">
                                                        <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">{prettifyKey(subKey)}</p>
                                                        {Array.isArray(subVal) ? (
                                                            <p className="mt-1 text-xs text-(--text-secondary)">{subVal.length === 0 ? '—' : subVal.map(formatScalarValue).join(', ')}</p>
                                                        ) : (
                                                            <p className="mt-1 text-sm font-medium text-(--text-primary)">{formatScalarValue(subVal)}</p>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ) : Array.isArray(value) ? (
                                        <div key={key} className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3">
                                            <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">{prettifyKey(key)}</p>
                                            <p className="mt-1 text-sm font-medium text-(--text-primary)">
                                                {value.length === 0 ? '—' : value.map(formatScalarValue).join(', ')}
                                            </p>
                                        </div>
                                    ) : (
                                        <div key={key} className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3">
                                            <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">{prettifyKey(key)}</p>
                                            <p className="mt-1 text-sm font-medium text-(--text-primary)">{formatScalarValue(value)}</p>
                                        </div>
                                    )
                                ))}
                            </div>
                        )}
                    </section>
                </div>
            )}
        </Modal>
    );
};

export default AdminBitacoraDetailModal;
