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
    return String(key || '')
        .replaceAll('_', ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .replace(/^./, (chunk) => chunk.toUpperCase());
}

function formatValue(value) {
    if (value === null) return 'null';
    if (value === undefined) return 'Sin dato';
    if (typeof value === 'boolean') return value ? 'Sí' : 'No';
    if (typeof value === 'number' || typeof value === 'bigint') return String(value);
    if (typeof value === 'string') return value.trim() || 'Sin dato';
    return JSON.stringify(value, null, 2);
}

function isComplexValue(value) {
    return Array.isArray(value) || (value && typeof value === 'object');
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
                                    <div key={key} className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) px-4 py-3">
                                        <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">{prettifyKey(key)}</p>
                                        {isComplexValue(value) ? (
                                            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap break-words rounded-lg bg-(--bg-card) p-3 text-xs text-(--text-primary)">{formatValue(value)}</pre>
                                        ) : (
                                            <p className="mt-1 text-sm font-medium text-(--text-primary)">{formatValue(value)}</p>
                                        )}
                                    </div>
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
