import React, { useEffect, useState } from 'react';
import { Play, Film, Loader2, X } from 'lucide-react';
import { Modal } from '../ui/Modal.jsx';
import { Button } from '../ui/Button.jsx';
import { downloadMultimedia } from '../../services/multimediaService.js';
import { isVideoDocument } from '../../utils/mediaDocument.js';

export default function MediaPreviewModal({
    open,
    item = null,
    onClose,
}) {
    const [loading, setLoading] = useState(true);
    const [blobUrl, setBlobUrl] = useState(null);
    const [isVideo, setIsVideo] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (!open || !item?.id) return;

        let cancelled = false;
        let createdUrl = null;
        setLoading(true);
        setError(null);

        const load = async () => {
            try {
                const result = await downloadMultimedia(item.id);
                if (cancelled) return;

                if (!result.ok) throw new Error('No se pudo descargar el archivo.');

                const mimeType = result.data?.mimeType || item.mime_type || 'application/octet-stream';
                const uint8 = new Uint8Array(result.data.bytes);
                const blob = new Blob([uint8], { type: mimeType });
                const url = URL.createObjectURL(blob);
                createdUrl = url;

                setBlobUrl(url);
                setIsVideo(isVideoDocument({ mime_type: mimeType, filename: item.filename }));
                setLoading(false);
            } catch (err) {
                if (!cancelled) {
                    setError(err.message);
                    setLoading(false);
                }
            }
        };

        void load();

        return () => {
            cancelled = true;
            if (createdUrl) URL.revokeObjectURL(createdUrl);
        };
    }, [open, item]);

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={item?.filename || 'Vista previa de archivo'}
            subtitle={item ? `Tamaño: ${(item.size / 1024).toFixed(1)} KB` : ''}
            maxWidth="max-w-4xl"
            footerAlignment="justify-end"
            footer={(
                <Button variant="outline" onClick={onClose}>
                    Cerrar
                </Button>
            )}
        >
            <div className="flex min-h-[300px] items-center justify-center rounded-xl bg-(--bg-card-hover) overflow-hidden mt-4">
                {loading ? (
                    <div className="flex flex-col items-center gap-3">
                        <Loader2 className="h-8 w-8 animate-spin text-blue-500" />
                        <span className="text-sm text-(--text-secondary)">Cargando archivo...</span>
                    </div>
                ) : error ? (
                    <div className="text-center p-6 text-red-500">
                        <p className="font-semibold">Error al cargar</p>
                        <p className="text-xs">{error}</p>
                    </div>
                ) : blobUrl ? (
                    isVideo ? (
                        <video 
                            src={blobUrl} 
                            controls 
                            autoPlay 
                            className="max-h-[70vh] w-full bg-black"
                        />
                    ) : (
                        <img 
                            src={blobUrl} 
                            alt={item.filename} 
                            className="max-h-[70vh] max-w-full object-contain"
                        />
                    )
                ) : (
                    <div className="text-sm text-(--text-tertiary)">Vista previa no disponible</div>
                )}
            </div>
        </Modal>
    );
}
