import { Archive, FileText } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { Badge } from '../ui/Badge';
import { Button } from '../ui/Button';
import { Table } from '../ui/Table';
import { useCaseTypes } from '../../context/CaseTypesContext';
import { useSettings } from '../../context/SettingsContext';
import { getCaseStatusLabel } from '../../utils/caseStatus.js';

/** Formatea un timestamp de la API para mostrar (DD/MM/YYYY). */
function formatDate(dateStr) {
    if (!dateStr) return '—';
    try {
        return format(parseISO(String(dateStr).replace(' ', 'T')), 'dd/MM/yyyy');
    } catch {
        return '—';
    }
}

const getStatusVariant = (statusLabel) => {
    if (statusLabel === 'Finalizado') return 'default';
    if (statusLabel === 'Activo') return 'success';
    return 'default';
};

/** Genera estilos inline para un badge de categoría basado en un color hex. */
function getCategoryBadgeStyle(color) {
    if (!color) return null;
    return {
        backgroundColor: `${color}22`,
        color: color,
        borderColor: `${color}55`,
    };
}

/** Filas vacías animadas (skeleton) para el estado de carga. */
const SkeletonRows = ({ count = 5 }) => (
    <>
        {Array.from({ length: count }).map((_, i) => (
            <tr key={i} className="animate-pulse">
                <td className="px-6 py-4">
                    <div className="h-4 bg-(--border-subtle) rounded w-3/4" />
                </td>
                <td className="px-6 py-4">
                    <div className="h-5 bg-(--border-subtle) rounded-full w-20" />
                </td>
                <td className="px-6 py-4">
                    <div className="h-4 bg-(--border-subtle) rounded w-16" />
                </td>
                <td className="px-6 py-4">
                    <div className="h-5 bg-(--border-subtle) rounded-full w-16" />
                </td>
                <td className="px-6 py-4">
                    <div className="h-4 bg-(--border-subtle) rounded w-20" />
                </td>
                <td className="px-6 py-4 text-right">
                    <div className="h-7 bg-(--border-subtle) rounded w-7 ml-auto" />
                </td>
            </tr>
        ))}
    </>
);

const COLUMNS = [
    { header: 'Carátula' },
    { header: 'Categoría' },
    { header: 'Dueño' },
    { header: 'Estado' },
    { header: 'Actualizado' },
    { header: 'Acciones', align: 'right' },
];

const CasesTable = ({ cases, onNavigate, onClose, onGenerateReport, isLoading = false }) => {
    const { case_types: caseTypes = [] } = useCaseTypes();
    const { personalEventColor } = useSettings();

    // Mapa rápido: ID del tipo → { name, eventColor }
    const typeById = {};
    for (const ct of caseTypes) {
        typeById[String(ct.id)] = { name: ct.name, color: ct.eventColor || null };
    }

    const showEmpty = !isLoading && cases.length === 0;

    return (
        <Table
            isEmpty={showEmpty}
            emptyMessage="No se encontraron casos que coincidan con la búsqueda."
            columns={COLUMNS}
        >
            {isLoading
                ? <SkeletonRows count={5} />
                : cases.map((c) => {
                    const statusLabel = getCaseStatusLabel(c);
                    const statusVariant = getStatusVariant(statusLabel);
                    const caseTypeId = String(c.case_type_id || '');
                    const typeInfo = typeById[caseTypeId] || null;
                    const typeColor = typeInfo?.color ?? (c.case_type_id ? personalEventColor : null);
                    const typeName = typeInfo?.name || c.case_type || null;
                    const categoryStyle = getCategoryBadgeStyle(typeColor);

                    return (
                        <tr
                            key={c.id}
                            onClick={() => onNavigate(c)}
                            className="hover:bg-blue-50/50 dark:hover:bg-blue-950/20 transition-colors cursor-pointer group"
                            style={{ animation: 'fadeIn 0.2s ease-in-out' }}
                        >
                            {/* Carátula */}
                            <td className="px-6 py-4">
                                <span className="font-medium text-(--text-primary) block">{c.title}</span>
                            </td>
                            {/* Categoría */}
                            <td className="px-6 py-4">
                                {typeName ? (
                                    <span
                                        className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border"
                                        style={categoryStyle || undefined}
                                    >
                                        {typeName}
                                    </span>
                                ) : (
                                    <span className="text-(--text-tertiary) text-xs">—</span>
                                )}
                            </td>
                            {/* Dueño */}
                            <td className="px-6 py-4 text-(--text-secondary)">{c.owner_tag || '—'}</td>
                            {/* Estado */}
                            <td className="px-6 py-4">
                                <Badge variant={statusVariant}>{statusLabel}</Badge>
                            </td>
                            {/* Actualizado */}
                            <td className="px-6 py-4 text-(--text-secondary) text-sm">
                                {formatDate(c.updated_at)}
                            </td>
                            {/* Acciones */}
                            <td className="px-6 py-4 text-right">
                                <div className="flex justify-end gap-1">
                                    <Button
                                        variant="ghost"
                                        size="icon"
                                        icon={FileText}
                                        onClick={(e) => onGenerateReport(c.id, e)}
                                        title="Generar reporte completo"
                                        className="text-(--text-tertiary) hover:text-blue-600 hover:bg-blue-500/10"
                                    />
                                    {statusLabel !== 'Finalizado' && (
                                        <Button
                                            variant="ghost"
                                            size="icon"
                                            icon={Archive}
                                            onClick={(e) => onClose(c, e)}
                                            title="Cerrar caso"
                                            className="text-(--text-tertiary) hover:text-amber-600 hover:bg-amber-500/10"
                                        />
                                    )}
                                </div>
                            </td>
                        </tr>
                    );
                })
            }
        </Table>
    );
};

export default CasesTable;
