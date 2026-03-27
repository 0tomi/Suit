import { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Share2, Clock, Copy, Check, Download, Loader2 } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { showAppToast } from '../../ui/show-app-toast';

export const QrCodeModal = ({ 
    open, 
    file, 
    signedData, 
    onClose,
    title = "Escanea para descargar",
    description = "Escanea este código con la cámara de tu teléfono para descargar el archivo directamente, sin necesidad de iniciar sesión."
}) => {
    const [qrDataUrl, setQrDataUrl] = useState('');
    const [copied, setCopied] = useState(false);
    const [generating, setGenerating] = useState(false);

    useEffect(() => {
        if (open && signedData?.signed_url) {
            generateQr(signedData.signed_url);
        } else {
            setQrDataUrl('');
        }
    }, [open, signedData]);

    const generateQr = async (text) => {
        setGenerating(true);
        try {
            // Generar un QR limpio con margen blanco
            const url = await QRCode.toDataURL(text, {
                width: 400,
                margin: 2,
                color: {
                    dark: '#0f172a',  // Texto primario (slate-900)
                    light: '#ffffff',
                },
                errorCorrectionLevel: 'H',
            });
            setQrDataUrl(url);
        } catch (err) {
            console.error('QR Generation failed:', err);
            showAppToast({ title: 'Error al generar QR', variant: 'danger' });
        } finally {
            setGenerating(false);
        }
    };

    const handleCopy = () => {
        if (!signedData?.signed_url) return;
        navigator.clipboard.writeText(signedData.signed_url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        showAppToast({ title: 'Enlace copiado al portapapeles', variant: 'success' });
    };

    const handleDownload = () => {
        if (!qrDataUrl) return;
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `qr-${file?.name || 'archivo'}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const expiresAt = signedData?.expires_at ? new Date(signedData.expires_at) : null;
    const timeStr = expiresAt ? expiresAt.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : '';

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={title}
            subtitle={file?.name}
            maxWidth="max-w-md"
        >
            <div className="flex flex-col items-center gap-6 py-4">
                {/* Contenedor del QR */}
                <div className="relative group">
                    <div className="bg-white p-4 rounded-2xl shadow-xl border border-(--border-subtle) transition-transform duration-300 group-hover:scale-[1.02]">
                        {generating ? (
                            <div className="w-[300px] h-[300px] flex items-center justify-center bg-gray-50 rounded-lg">
                                <Loader2 className="h-10 w-10 animate-spin text-blue-500" />
                            </div>
                        ) : qrDataUrl ? (
                            <img 
                                src={qrDataUrl} 
                                alt="QR Code" 
                                className="w-[300px] h-[300px] rounded-lg animate-in fade-in zoom-in-95 duration-300" 
                            />
                        ) : (
                            <div className="w-[300px] h-[300px] bg-gray-50 rounded-lg" />
                        )}
                    </div>
                </div>

                {/* Info de expiración */}
                <div className="flex items-center gap-2 px-4 py-2 bg-amber-500/10 text-amber-600 rounded-full text-sm font-medium border border-amber-500/20">
                    <Clock className="h-4 w-4" />
                    <span>Este QR expira hoy a las {timeStr}</span>
                </div>

                {/* Acciones rápidas */}
                <div className="w-full grid grid-cols-2 gap-3 mt-2">
                    <Button
                        variant="outline"
                        onClick={handleCopy}
                        icon={copied ? Check : Copy}
                        className={copied ? 'text-green-600 border-green-200 bg-green-50' : ''}
                    >
                        {copied ? 'Copiado' : 'Copiar Link'}
                    </Button>
                    <Button
                        variant="outline"
                        onClick={handleDownload}
                        icon={Download}
                        disabled={!qrDataUrl}
                    >
                        Imagen QR
                    </Button>
                </div>

                <p className="text-xs text-(--text-tertiary) text-center max-w-[280px]">
                    {description}
                </p>

                <div className="w-full pt-4 border-t border-(--border-subtle)">
                    <Button
                        variant="secondary"
                        onClick={onClose}
                        className="w-full"
                    >
                        Cerrar
                    </Button>
                </div>
            </div>
        </Modal>
    );
};
