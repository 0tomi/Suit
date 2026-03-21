import { ArrowLeft, FileDown, FileText, Loader2, Pencil, Save } from 'lucide-react';
import { Button } from '../ui/Button.jsx';

export default function DocumentEditorHeader({
    id,
    title,
    onTitleChange,
    isEditing,
    isCheckingEdit,
    isSaving,
    isExportingPdf,
    isLockedByOther,
    lastAutoSavedAt,
    historyVersionLabel,
    onBack,
    onEnableEdit,
    onExportPdf,
    onSave,
}) {
    const saveDisabled = isSaving || isLockedByOther || (id && !isEditing);

    return (
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-0 z-20">
            <div className="flex items-center space-x-4 flex-1">
                <button
                    onClick={onBack}
                    aria-label="Volver"
                    className="cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => onTitleChange(event.target.value)}
                            placeholder="Sin Título"
                            className="text-xl font-bold text-gray-900 dark:text-gray-100 bg-transparent border-none focus:ring-0 p-0 placeholder-gray-300 dark:placeholder-gray-600 w-full"
                            readOnly={id ? !isEditing : false}
                        />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        <span className="flex items-center gap-1">
                            <FileText size={14} />
                            {isEditing ? 'Editando' : 'Solo lectura'}
                        </span>
                        {historyVersionLabel ? (
                            <span className="rounded-full bg-amber-100 dark:bg-amber-900/40 px-2.5 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                                Historial {historyVersionLabel}
                            </span>
                        ) : null}
                        {isEditing && lastAutoSavedAt && (
                            <span className="text-xs text-gray-400 dark:text-gray-500">
                                · Local autoguardado {lastAutoSavedAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
                            </span>
                        )}
                    </div>
                </div>
            </div>

            <div className="flex items-center gap-3">
                {id && (
                    <>
                        <Button
                            variant={isEditing ? 'outline' : 'secondary'}
                            size="md"
                            onClick={onEnableEdit}
                            disabled={isCheckingEdit || isEditing}
                            isLoading={isCheckingEdit}
                            icon={Pencil}
                            className={isEditing ? 'border-amber-200 dark:border-amber-700 bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-300' : ''}
                            title="Habilitar modo edición"
                        >
                            {isEditing ? 'Editando' : 'Editar'}
                        </Button>

                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600"></div>
                    </>
                )}

                <Button
                    variant="outline"
                    size="md"
                    onClick={onExportPdf}
                    isLoading={isExportingPdf}
                    icon={FileDown}
                >
                    {isExportingPdf ? 'Exportando...' : 'Exportar PDF'}
                </Button>

                <Button
                    variant="primary"
                    size="md"
                    onClick={onSave}
                    disabled={saveDisabled}
                    isLoading={isSaving}
                    icon={Save}
                >
                    {isSaving ? 'Guardando...' : 'Guardar'}
                </Button>
            </div>
        </div>
    );
}
