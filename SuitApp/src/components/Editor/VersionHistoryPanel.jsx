import { FileText, History, Loader2, RefreshCcw } from 'lucide-react';
import { format, parseISO } from 'date-fns';

const formatVersionDate = (value) => {
    if (!value) return 'Fecha no disponible';
    try {
        return format(parseISO(String(value).replace(' ', 'T')), 'dd/MM/yyyy HH:mm');
    } catch {
        return 'Fecha no disponible';
    }
};

const resolveVersionNumber = (version, index) => (
    version?.version_number ??
    version?.number ??
    version?.version ??
    index + 1
);

const resolveUserLabel = (userLike) => {
    if (!userLike) return null;
    const candidate = userLike?.data ?? userLike?.attributes ?? userLike;
    if (typeof candidate === 'string' && candidate.trim()) return candidate.trim();
    if (typeof candidate !== 'object') return null;

    const fullName = [candidate.name, candidate.last_name].filter(Boolean).join(' ').trim();
    if (fullName) return fullName;

    if (typeof candidate.tag === 'string' && candidate.tag.trim()) {
        return `@${candidate.tag.trim()}`;
    }

    if (typeof candidate.email === 'string' && candidate.email.trim()) {
        return candidate.email.trim();
    }

    return null;
};

const resolveVersionAuthor = (version) => (
    resolveUserLabel(version?.modifier) ??
    resolveUserLabel(version?.modified_by_user) ??
    resolveUserLabel(version?.updated_by_user) ??
    resolveUserLabel(version?.editor) ??
    resolveUserLabel(version?.last_editor) ??
    resolveUserLabel(version?.creator) ??
    resolveUserLabel(version?.user) ??
    resolveUserLabel(version?.created_by_user) ??
    version?.modified_by_name ??
    version?.updated_by_name ??
    version?.editor_name ??
    version?.creator_name ??
    version?.author_name ??
    'Autor no disponible'
);

export default function VersionHistoryPanel({
    versions,
    loading,
    error,
    activeVersionId = null,
    onOpenVersion,
    onRetry,
}) {
    if (loading) {
        return (
            <div className="flex min-h-48 items-center justify-center gap-3 rounded-xl border border-dashed border-(--border-default) bg-(--bg-card-hover) text-sm text-(--text-tertiary)">
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Cargando historial...</span>
            </div>
        );
    }

    if (error) {
        return (
            <div className="space-y-3 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-400">
                <p>{error}</p>
                <button
                    type="button"
                    onClick={onRetry}
                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 font-medium text-red-700 transition-colors hover:bg-red-500/20 dark:text-red-300"
                >
                    <RefreshCcw size={14} />
                    Reintentar
                </button>
            </div>
        );
    }

    if (!versions.length) {
        return (
            <div className="flex min-h-48 flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-(--border-default) bg-(--bg-card-hover) px-6 text-center">
                <History className="h-8 w-8 text-(--text-tertiary)" />
                <div className="space-y-1">
                    <p className="text-sm font-medium text-(--text-secondary)">No hay versiones disponibles</p>
                    <p className="text-sm text-(--text-tertiary)">El historial aparecerá cuando la API informe versiones del documento.</p>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-3">
            <p className="text-sm text-(--text-tertiary)">
                Abre una versión en modo lectura. Si luego habilitas edición y guardas, la API creará una versión nueva automáticamente.
            </p>

            <div className="space-y-2">
                {versions.map((version, index) => {
                    const versionNumber = resolveVersionNumber(version, index);
                    const isActive = activeVersionId !== null && String(activeVersionId) === String(version.id);

                    return (
                        <div
                            key={version.id || `${versionNumber}-${version.created_at || index}`}
                            className={`rounded-xl border p-4 transition-colors ${
                                isActive ? 'border-blue-500/50 bg-blue-500/10' : 'border-(--border-default) bg-(--bg-card-hover)'
                            }`}
                        >
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0 space-y-1">
                                    <div className="flex items-center gap-2">
                                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-1 text-xs font-semibold text-blue-600 dark:text-blue-400">
                                            <FileText size={12} />
                                            v{versionNumber}
                                        </span>
                                        {isActive ? (
                                            <span className="rounded-full bg-emerald-500/10 px-2.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                                                Abierta actualmente
                                            </span>
                                        ) : null}
                                    </div>
                                    <p className="text-sm font-medium text-(--text-primary)">{resolveVersionAuthor(version)}</p>
                                    <p className="text-sm text-(--text-secondary)">{formatVersionDate(version.created_at || version.updated_at)}</p>
                                </div>

                                <button
                                    type="button"
                                    onClick={() => onOpenVersion(version)}
                                    className="inline-flex cursor-pointer items-center gap-2 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-500/20 dark:text-blue-400"
                                >
                                    Abrir
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
