import React, { useMemo } from 'react';
import { Eye, FileText, Info } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { buildPreviewHtml } from '../templates/templateEditorUtils.js';

export default function TemplatePreviewModal({
    open,
    loading = false,
    template = null,
    categoryName = 'Sin categoría',
    onClose,
    onUseTemplate,
}) {
    const hasContent = typeof template?.content === 'string' && template.content.trim().length > 0;

    // Procesa el contenido una sola vez por cambio de template:
    // convierte los placeholders #n# a burbujas grises inline.
    const previewHtml = useMemo(
        () => (hasContent ? buildPreviewHtml(template.content) : ''),
        [hasContent, template]
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={template?.title || 'Vista previa de plantilla'}
            subtitle={template ? `Categoría: ${categoryName}` : 'Cargando contenido de la plantilla'}
            maxWidth="max-w-5xl"
            footerAlignment="justify-end"
            footer={(
                <>
                    <Button variant="outline" onClick={onClose}>
                        Cerrar
                    </Button>
                    <Button
                        variant="primary"
                        icon={FileText}
                        onClick={onUseTemplate}
                        disabled={!template || loading}
                        data-testid="template-preview-use-button"
                    >
                        Usar plantilla
                    </Button>
                </>
            )}
        >
            <div data-testid="template-preview-modal">
                {loading ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-(--text-secondary)">
                        <Eye className="h-8 w-8 animate-pulse text-blue-600" />
                        <span className="text-sm">Cargando vista previa...</span>
                    </div>
                ) : hasContent ? (
                    <div className="space-y-3">
                        {/* Aviso sobre el alcance visual de la preview */}
                        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 dark:border-amber-700/50 dark:bg-amber-900/20 px-3 py-2.5">
                            <Info size={14} className="shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                            <p className="text-xs text-amber-700 dark:text-amber-300">
                                Vista previa de lectura: conserva la estructura y la tipografía básica del documento.
                                Las burbujas grises indican los campos que se completarán con datos del caso.
                            </p>
                        </div>

                        {/* Contenido normalizado de solo lectura con burbujas de requisito */}
                        <div className="overflow-auto rounded-xl bg-(--bg-card-hover) p-4">
                            <div
                                className="text-sm text-(--text-primary) leading-relaxed"
                                dangerouslySetInnerHTML={{ __html: previewHtml }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-(--border-default) bg-(--bg-card-hover) px-6 text-center text-sm text-(--text-secondary)">
                        La plantilla no tiene contenido disponible para vista previa.
                    </div>
                )}
            </div>
        </Modal>
    );
}
