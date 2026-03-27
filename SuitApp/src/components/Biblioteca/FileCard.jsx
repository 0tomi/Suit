import {
    FileText,
    Download,
    Info,
    FileImage,
    FileSpreadsheet,
    FileIcon,
    Presentation,
    Trash2,
    Loader2,
    QrCode
} from 'lucide-react';
import { useSettings } from '../../context/SettingsContext';

const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const getFileStyles = (file) => {
    const name = (file.name || '').toLowerCase();
    const mime = (file.mime_type || '').toLowerCase();

    // Excel / CSV
    if (
        mime.includes('spreadsheet') || 
        mime.includes('excel') || 
        name.endsWith('.xlsx') || 
        name.endsWith('.xls') || 
        name.endsWith('.csv')
    ) {
        return {
            icon: FileSpreadsheet,
            color: 'text-emerald-500',
            bg: 'bg-emerald-500/10',
            hoverBg: 'group-hover:bg-emerald-600',
            border: 'hover:border-emerald-500',
            gradient: 'from-emerald-500 to-emerald-600'
        };
    }

    // PowerPoint / OpenDocument Presentation
    if (
        mime.includes('presentation') || 
        mime.includes('powerpoint') || 
        name.endsWith('.pptx') || 
        name.endsWith('.ppt') ||
        name.endsWith('.odp')
    ) {
        return {
            icon: Presentation,
            color: 'text-orange-500',
            bg: 'bg-orange-500/10',
            hoverBg: 'group-hover:bg-orange-600',
            border: 'hover:border-orange-500',
            gradient: 'from-orange-500 to-orange-600'
        };
    }

    // Word
    if (
        mime.includes('word') || 
        mime.includes('officedocument.word') || 
        name.endsWith('.docx') || 
        name.endsWith('.doc') || 
        name.endsWith('.rtf')
    ) {
        return {
            icon: FileText,
            color: 'text-blue-500',
            bg: 'bg-blue-500/10',
            hoverBg: 'group-hover:bg-blue-600',
            border: 'hover:border-blue-500',
            gradient: 'from-blue-500 to-indigo-600'
        };
    }

    // PDF
    if (mime.includes('pdf') || name.endsWith('.pdf')) {
        return {
            icon: FileText,
            color: 'text-rose-500',
            bg: 'bg-rose-500/10',
            hoverBg: 'group-hover:bg-rose-600',
            border: 'hover:border-rose-500',
            gradient: 'from-rose-500 to-red-600'
        };
    }

    // Text / Markdown
    if (mime.includes('text/') || name.endsWith('.txt') || name.endsWith('.md')) {
        return {
            icon: FileText,
            color: 'text-gray-500',
            bg: 'bg-gray-500/10',
            hoverBg: 'group-hover:bg-gray-600',
            border: 'hover:border-gray-500',
            gradient: 'from-gray-400 to-gray-500'
        };
    }

    // Image
    if (mime.includes('image/')) {
        return {
            icon: FileImage,
            color: 'text-purple-500',
            bg: 'bg-purple-500/10',
            hoverBg: 'group-hover:bg-purple-600',
            border: 'hover:border-purple-500',
            gradient: 'from-purple-500 to-indigo-500'
        };
    }

    return {
        icon: FileIcon,
        color: 'text-blue-500',
        bg: 'bg-blue-500/10',
        hoverBg: 'group-hover:bg-blue-600',
        border: 'hover:border-blue-500',
        gradient: 'from-blue-500 to-indigo-600'
    };
};

export const FileCard = ({
    file,
    onDownload,
    onOpenInfo,
    onMarkAsSeen,
    onDelete,
    onGenerateQr,
    deleteLoading,
}) => {
    const { libraryNewBadgeEnabled, libraryNewBadgeColor, libraryJumpAnimationEnabled } = useSettings();
    const styles = getFileStyles(file);
    const IconComponent = styles.icon;
    const displayName = file.name || file.filename || 'Sin nombre';

    return (
        <article 
            className={`group bg-(--bg-card) rounded-xl shadow-sm border border-(--border-subtle) hover:shadow-lg ${styles.border} transition-all overflow-hidden flex flex-col relative h-[180px]
                ${file.is_new && libraryJumpAnimationEnabled ? 'library-card-jump' : ''}
            `}
            onMouseEnter={() => {
                if (file.is_new && onMarkAsSeen) {
                    onMarkAsSeen(file.id);
                }
            }}
        >
            {/* Badge de "Nuevo" */}
            {file.is_new && libraryNewBadgeEnabled && (
                <div
                    className="absolute top-2 right-2 z-30 px-2 py-0.5 rounded-md text-[10px] font-bold text-white shadow-sm transition-opacity duration-300 pointer-events-none"
                    style={{ backgroundColor: libraryNewBadgeColor }}
                >
                    NUEVO
                </div>
            )}
            <div className="absolute top-2 right-2 z-20 opacity-0 group-hover:opacity-100 transition-opacity bg-(--bg-card) shadow-md rounded-lg flex items-center p-1 border border-(--border-subtle)">
                <button
                    onClick={(e) => {
                        e.stopPropagation();
                        onDownload(file);
                    }}
                    className="p-1.5 rounded-md text-(--text-secondary) hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                    title="Descargar"
                >
                    <Download className="h-4 w-4" />
                </button>
                {onOpenInfo && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onOpenInfo(file);
                        }}
                        className="p-1.5 rounded-md text-(--text-secondary) hover:text-indigo-500 hover:bg-indigo-500/10 transition-colors"
                        title="Información / Editar"
                    >
                        <Info className="h-4 w-4" />
                    </button>
                )}
                {onGenerateQr && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onGenerateQr(file);
                        }}
                        className="p-1.5 rounded-md text-(--text-secondary) hover:text-blue-500 hover:bg-blue-500/10 transition-colors"
                        title="Generar QR para compartir"
                    >
                        <QrCode className="h-4 w-4" />
                    </button>
                )}
                {onDelete && (
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(file);
                        }}
                        className="p-1.5 rounded-md text-(--text-secondary) hover:text-red-500 hover:bg-red-500/10 transition-colors"
                        title="Eliminar"
                        disabled={deleteLoading}
                    >
                        {deleteLoading ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                            <Trash2 className="h-4 w-4" />
                        )}
                    </button>
                )}
            </div>

            <button
                type="button"
                className="w-full text-left flex-1"
                onClick={() => onDownload(file)}
                data-testid={`file-card-download-${file.id}`}
            >
                <div className={`h-2 bg-gradient-to-r ${styles.gradient} w-full`} />
                <div className="p-4 flex-1 flex flex-col h-full">
                    <div className="flex items-start justify-between mb-3 gap-3">
                        <div className={`p-2.5 ${styles.bg} rounded-lg ${styles.color} ${styles.hoverBg} group-hover:text-white transition-colors`}>
                            <IconComponent size={24} />
                        </div>
                    </div>

                    <h3
                        className={`text-base font-bold text-(--text-primary) mb-1 group-hover:${styles.color} transition-colors line-clamp-2`}
                        title={displayName}
                    >
                        {displayName}
                    </h3>
                    
                    <div className="mt-auto flex items-center justify-between pt-3 border-t border-(--border-subtle)">
                        <span className="text-xs font-semibold text-(--text-secondary) bg-(--bg-input) px-2 py-1 rounded-full truncate max-w-[130px]" title="Fecha de subida">
                            {(file.created_at || file.updated_at) ? new Date(file.created_at || file.updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : 'Sin fecha'}
                        </span>
                        <span className="text-xs text-(--text-tertiary)">{formatBytes(file.size)}</span>
                    </div>
                </div>
            </button>
        </article>
    );
};
