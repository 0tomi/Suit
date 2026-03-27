import React, { useEffect, useState } from 'react';
import { Eye } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { getDocumentStatusLabel } from '../../utils/documentStatus.js';
import { fetchDocumentContent } from '../../services/draftingToolsApiService.js';

/**
 * Modal de vista previa de documento.
 * Al abrirse, obtiene automáticamente el contenido HTML desde la API.
 * El llamador solo necesita pasar los metadatos del documento (id, name, status).
 */
export default function DocumentPreviewModal({
    open,
    document = null,
    onClose,
}) {
    const [content, setContent] = useState(null);
    const [loading, setLoading] = useState(false);

    // Fetch del contenido HTML al abrir el modal o cambiar de documento
    useEffect(() => {
        if (!open || !document?.id) {
            setContent(null);
            setLoading(false);
            return;
        }

        // Si el documento ya trae contenido (ej: tests o caché manual), usarlo directamente
        if (document.content) {
            setContent(document.content);
            return;
        }

        let cancelled = false;
        setLoading(true);
        setContent(null);

        fetchDocumentContent(document.id).then((html) => {
            if (!cancelled) {
                setContent(html);
                setLoading(false);
            }
        });

        return () => { cancelled = true; };
    }, [open, document?.id]);

    const hasContent = typeof content === 'string' && content.trim().length > 0;

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={document?.name || document?.title || 'Vista previa de documento'}
            subtitle={document ? `Estado: ${getDocumentStatusLabel(document.status)}` : 'Cargando contenido...'}
            maxWidth="max-w-5xl"
            footerAlignment="justify-end"
            footer={(
                <Button variant="outline" onClick={onClose}>
                    Cerrar
                </Button>
            )}
        >
            <div data-testid="document-preview-modal">
                {loading ? (
                    <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-(--text-secondary)">
                        <Eye className="h-8 w-8 animate-pulse text-blue-600" />
                        <span className="text-sm">Cargando vista previa...</span>
                    </div>
                ) : hasContent ? (
                    <div className="space-y-3">
                        <div className="overflow-auto rounded-xl bg-(--bg-card-hover) p-6 min-h-[400px]">
                            <div
                                className="text-sm text-(--text-primary) leading-relaxed prose prose-sm dark:prose-invert max-w-none"
                                dangerouslySetInnerHTML={{ __html: content }}
                            />
                        </div>
                    </div>
                ) : (
                    <div className="flex min-h-64 items-center justify-center rounded-xl border border-dashed border-(--border-default) bg-(--bg-card-hover) px-6 text-center text-sm text-(--text-secondary)">
                        El documento no tiene contenido disponible para vista previa.
                    </div>
                )}
            </div>
        </Modal>
    );
}
