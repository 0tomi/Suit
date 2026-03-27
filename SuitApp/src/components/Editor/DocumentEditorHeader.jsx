import { ArrowLeft, FileDown, FileText, Loader2, Pencil, Save } from 'lucide-react';
import { Button } from '../ui/Button.jsx';
import { Badge } from '../ui/Badge.jsx';
import { SectionTutorialTrigger } from '../ui/SectionTutorialTrigger.jsx';
import { getDocumentStatusLabel, getDocumentStatusVariant } from '../../utils/documentStatus.js';
import { documentEditorSteps } from '../../constants/tutorialSteps.js';

export default function DocumentEditorHeader({
    id,
    title,
    status,
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
    onOpenSettings,
    onExportPdf,
    onSave,
}) {
    const saveDisabled = isSaving || isLockedByOther || (id && !isEditing);
    const documentStatusLabel = status ? getDocumentStatusLabel(status) : null;

    return (
        <div className="flex justify-between items-center bg-white dark:bg-gray-800 p-4 rounded-xl shadow-sm border border-gray-100 dark:border-gray-700 sticky top-0 z-40">
            <div className="flex items-center space-x-4 flex-1">
                <button
                    onClick={onBack}
                    aria-label="Volver"
                    className="cursor-pointer p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-full transition-colors text-gray-500 dark:text-gray-400"
                >
                    <ArrowLeft size={24} />
                </button>
                <div className="min-w-0 flex-1">
                    <div className="mb-1 flex max-w-[640px] items-center gap-2">
                        <input
                            type="text"
                            value={title}
                            onChange={(event) => onTitleChange(event.target.value)}
                            placeholder="Sin Título"
                            className="min-w-0 flex-1 bg-transparent p-0 text-xl font-bold text-gray-900 placeholder-gray-300 focus:ring-0 dark:text-gray-100 dark:placeholder-gray-600"
                            readOnly={id ? !isEditing : false}
                        />
                    </div>
                    <div className="flex items-center gap-4 text-sm text-gray-500 dark:text-gray-400">
                        {documentStatusLabel && (
                            <Badge variant={getDocumentStatusVariant(status)}>
                                {documentStatusLabel}
                            </Badge>
                        )}
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
                        <SectionTutorialTrigger
                            steps={documentEditorSteps}
                            ariaLabel="Ver tutorial del editor de documentos"
                            testId="document-editor-tutorial-trigger"
                            className="shrink-0"
                        />

                        <div className="h-6 w-px bg-gray-200 dark:bg-gray-600"></div>

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
                    onClick={onOpenSettings}
                    title="Propiedades y Caso"
                >
                    Propiedades
                </Button>

                <div className="h-6 w-px bg-gray-200 dark:bg-gray-600"></div>

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
