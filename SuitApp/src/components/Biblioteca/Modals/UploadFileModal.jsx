import { useState, useRef, useEffect } from 'react';
import { Upload, AlertCircle } from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { FilePermissionsSelector } from '../FilePermissionsSelector';
import { useUsers } from '../../../context/UsersContext';
import { generateUploadLink } from '../../../services/publicFileService';
import { QrCodeModal } from './QrCodeModal';
import { QrCode } from 'lucide-react';

const ALLOWED_MIME_TYPES = [
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/vnd.oasis.opendocument.presentation',
    'text/plain',
    'text/csv',
    'text/markdown',
];

const ALLOWED_EXTENSIONS_STR = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.odp,.txt,.csv,.md';
const LOCAL_STORAGE_KEY = 'suitapp_upload_permissions';

export const UploadFileModal = ({
    open,
    catalogs,
    loading,
    onClose,
    onCloseAfterQrFlow,
    onUpload,
    initialFile = null
}) => {
    const [file, setFile] = useState(null);
    const [catalogId, setCatalogId] = useState('');
    const [error, setError] = useState(null);
    const fileInputRef = useRef(null);

    const { users } = useUsers();
    const [permissions, setPermissions] = useState([]);
    const [rememberChoice, setRememberChoice] = useState(false);
    const [isDragging, setIsDragging] = useState(false);

    const [qrData, setQrData] = useState(null);
    const [isGeneratingQr, setIsGeneratingQr] = useState(false);
    const [usedQrFlow, setUsedQrFlow] = useState(false);

    // Resetear al abrir/cerrar
    useEffect(() => {
        if (!open) {
            setFile(null);
            setCatalogId('');
            setError(null);
            setPermissions([]);
            setRememberChoice(false);
            setIsDragging(false);
            setQrData(null);
            setIsGeneratingQr(false);
            setUsedQrFlow(false);
        } else if (initialFile) {
            // Validar archivo inicial (drag & drop)
            if (!ALLOWED_MIME_TYPES.includes(initialFile.type)) {
                setError('Este formato de archivo no está permitido. Solo documentos (PDF, Word, Excel, PowerPoint, CSV, Texto).');
                setFile(null);
            } else {
                setFile(initialFile);
                setError(null);
            }
        }
    }, [open, initialFile]);

    // Cargar permisos desde localStorage si aplica
    useEffect(() => {
        if (open && users && users.length > 0) {
            try {
                const saved = localStorage.getItem(LOCAL_STORAGE_KEY);
                if (saved) {
                    const parsed = JSON.parse(saved);
                    const matchedUsers = parsed.map(p => {
                        const foundUser = users.find(u => u.id === p.user_id);
                        return foundUser ? { ...p, user: foundUser } : null;
                    }).filter(Boolean);

                    if (matchedUsers.length > 0) {
                        setPermissions(matchedUsers);
                        setRememberChoice(true);
                    }
                }
            } catch (e) {
                console.error("Error parsing localstorage permissions", e);
            }
        }
    }, [open, users]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file || error) return;

        const formData = new FormData();
        formData.append('file', file);
        if (catalogId) {
            formData.append('public_file_catalog_id', catalogId);
        }

        const permissionsToApply = permissions.map(p => ({
            user_id: p.user_id,
            can_update: p.can_update,
            can_delete: p.can_delete
        }));

        if (rememberChoice && permissionsToApply.length > 0) {
            localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(permissionsToApply));
        } else if (!rememberChoice) {
            localStorage.removeItem(LOCAL_STORAGE_KEY);
        }

        try {
            // Pasamos también los permisos para que la página los aplique
            await onUpload(formData, permissionsToApply);
        } catch (err) {
            console.error('Error uploading file:', err);
            setError('Hubo un error.');
        }
    };

    const handleGenerateQr = async () => {
        setIsGeneratingQr(true);
        setError(null);
        try {
            const permissionsToApply = permissions.map(p => ({
                user_id: p.user_id,
                can_update: p.can_update,
                can_delete: p.can_delete
            }));

            const result = await generateUploadLink({
                catalogId: catalogId ? parseInt(catalogId) : undefined,
                permissions: permissionsToApply
            });

            setQrData({
                signed_url: result.upload_url,
                expires_at: result.expires_at
            });
            setUsedQrFlow(true);
        } catch (err) {
            console.error('Error generating QR upload link:', err);
            const message = err.message?.includes('422') || err.message?.includes('403')
                ? 'No tenes permisos para realizar esta accion.'
                : 'Error al generar el código QR.';
            setError(message);
        } finally {
            setIsGeneratingQr(false);
        }
    };

    const handleFileChange = (e) => {
        setError(null);
        if (e.target.files && e.target.files.length > 0) {
            const selectedFile = e.target.files[0];

            // Validación de tipo mime
            if (!ALLOWED_MIME_TYPES.includes(selectedFile.type)) {
                setError('Este formato de archivo no está permitido. Solo documentos (PDF, Word, Excel, PowerPoint, CSV, Texto).');
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }

            setFile(selectedFile);
        }
    };

    const handleDragEnter = (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.items && e.dataTransfer.items.length > 0) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
    };

    const handleDrop = (e) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);
        setError(null);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
            const droppedFile = e.dataTransfer.files[0];

            // Validación de tipo mime
            if (!ALLOWED_MIME_TYPES.includes(droppedFile.type)) {
                setError('Este formato de archivo no está permitido. Solo documentos (PDF, Word, Excel, PowerPoint, CSV, Texto).');
                setFile(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
                return;
            }
            setFile(droppedFile);
        }
    };

    const handleClose = () => {
        const shouldRefreshAfterClose = usedQrFlow;
        onClose();
        if (shouldRefreshAfterClose) {
            onCloseAfterQrFlow?.();
        }
    };

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="Subir Archivo"
            maxWidth="max-w-2xl"
            footer={(
                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <Button
                        variant="outline"
                        onClick={handleGenerateQr}
                        disabled={loading || isGeneratingQr || !!error}
                        isLoading={isGeneratingQr}
                        icon={QrCode}
                        className="flex-1 sm:flex-initial"
                    >
                        Cargar usando QR
                    </Button>
                    <Button
                        type="submit"
                        form="upload-file-form"
                        disabled={loading || !file || !!error}
                        isLoading={loading}
                        className="flex-1 sm:flex-initial"
                    >
                        Subir
                    </Button>
                </div>
            )}
        >
            <form id="upload-file-form" onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-sm font-medium text-(--text-secondary) mb-1">
                        Archivo *
                    </label>
                    <div
                        className={`mt-1 flex justify-center px-6 pt-5 pb-6 border-2 border-dashed rounded-lg transition-all duration-200 ${isDragging ? 'border-blue-600 bg-blue-600/10 shadow-lg scale-[1.01]' :
                            error ? 'border-red-500 bg-red-500/5' :
                                file ? 'border-blue-500 bg-blue-500/5' :
                                    'border-(--border-default) hover:border-blue-500 hover:bg-blue-500/5'
                            } cursor-pointer`}
                        onClick={() => fileInputRef.current?.click()}
                        onDragEnter={handleDragEnter}
                        onDragLeave={handleDragLeave}
                        onDragOver={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                        }}
                        onDrop={handleDrop}
                    >
                        <div className="space-y-1 text-center pointer-events-none">
                            <Upload className={`mx-auto h-12 w-12 transition-transform duration-200 ${isDragging ? 'text-blue-600 scale-110' :
                                error ? 'text-red-500' :
                                    file ? 'text-blue-500' :
                                        'text-(--text-tertiary)'
                                }`} />
                            <div className="text-sm text-(--text-primary)">
                                {isDragging ? (
                                    <span className="font-bold text-blue-600">Soltar acá para subir</span>
                                ) : file ? (
                                    <span className="font-medium text-blue-600 truncate max-w-[200px] inline-block">{file.name}</span>
                                ) : (
                                    <span className="font-medium text-blue-600 hover:text-blue-500">
                                        Seleccioná un archivo
                                    </span>
                                )}
                            </div>
                            <p className="text-xs text-(--text-tertiary)">
                                PDF, Word, Excel, PowerPoint, CSV, o Texto
                            </p>
                        </div>
                    </div>

                    {error && (
                        <div className="mt-3 flex items-start gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-600 text-sm animate-in fade-in slide-in-from-top-1">
                            <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                            <span>{error}</span>
                        </div>
                    )}

                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleFileChange}
                        accept={ALLOWED_EXTENSIONS_STR}
                        className="hidden"
                    />
                </div>

                {!error && (
                    <div className="animate-in fade-in duration-300">
                        <label htmlFor="upload-catalog-select" className="block text-sm font-medium text-(--text-secondary) mb-1">
                            Catálogo (Opcional)
                        </label>
                        <select
                            id="upload-catalog-select"
                            value={catalogId}
                            onChange={(e) => setCatalogId(e.target.value)}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            <option value="">General</option>
                            {catalogs.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>
                )}

                <FilePermissionsSelector
                    permissions={permissions}
                    onChange={setPermissions}
                    showRememberChoice={true}
                    rememberChoice={rememberChoice}
                    onRememberChoiceChange={setRememberChoice}
                    disabled={loading}
                />
            </form>

            <QrCodeModal
                open={!!qrData}
                onClose={() => setQrData(null)}
                signedData={qrData}
                file={{ name: 'Carga remota' }}
                title="Escanea para cargar"
                description="Escanea este código con la cámara de tu teléfono para subir un archivo directamente al catálogo seleccionado."
            />
        </Modal>
    );
};
