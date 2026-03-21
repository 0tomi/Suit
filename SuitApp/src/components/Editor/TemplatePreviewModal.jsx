import React from 'react';
import { Eye, FileText } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import TiptapEditor from './TiptapEditor.jsx';

export default function TemplatePreviewModal({
    open,
    loading = false,
    template = null,
    categoryName = 'Sin categoría',
    onClose,
    onUseTemplate,
}) {
    const hasContent = typeof template?.content === 'string' && template.content.trim().length > 0;

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
            <div data-testid="template-preview-modal" className="space-y-4">
                {loading ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-(--text-secondary)">
                        <Eye className="h-8 w-8 animate-pulse text-blue-600" />
                        <span className="text-sm">Cargando vista previa...</span>
                    </div>
                ) : hasContent ? (
                    <div className="rounded-xl bg-(--bg-card-hover) p-4">
                        <TiptapEditor
                            content={template.content}
                            onChange={() => {}}
                            readOnly
                            placeholder=""
                        />
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
