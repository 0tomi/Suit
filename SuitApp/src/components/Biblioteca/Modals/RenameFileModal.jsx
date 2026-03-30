import { useState, useEffect } from 'react';
import {
    FileText, FileImage, FileSpreadsheet, FileIcon,
    Calendar, HardDrive, User, Tag, Loader2, Trash2, QrCode,
} from 'lucide-react';
import { Modal } from '../../ui/Modal';
import { Button } from '../../ui/Button';
import { QrCodeModal } from './QrCodeModal';
import { FilePermissionsSelector } from '../FilePermissionsSelector';
import { usePublicFiles } from '../../../context/PublicFilesContext';
import { useUsers } from '../../../context/UsersContext';
import { showAppToast } from '../../ui/show-app-toast';

// --- Utilidades locales ---

const formatBytes = (bytes, decimals = 2) => {
    if (!+bytes) return '0 Bytes';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
};

const getFileIcon = (mimeType) => {
    if (!mimeType) return FileIcon;
    if (mimeType.includes('image/')) return FileImage;
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel') || mimeType.includes('csv')) return FileSpreadsheet;
    return FileText;
};

/** Extrae la extensión de un nombre de archivo y la devuelve en mayúsculas. */
const getExtension = (name) => {
    if (!name) return 'FILE';
    const parts = name.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : 'FILE';
};

const formatDate = (dateStr) => {
    if (!dateStr) return 'Desconocida';
    return new Date(dateStr).toLocaleDateString('es-AR', {
        day: '2-digit', month: 'long', year: 'numeric',
    });
};

// ---

/**
 * FileInfoModal — Modal de información y edición de un archivo de la Biblioteca.
 *
 * Determina el nivel de acceso al abrir:
 *   - isOwnerOrAdmin: derivado localmente (file.user_id === currentUser.id || role === 'admin').
 *   - canEdit: igual a isOwnerOrAdmin por ahora.
 *     TODO: Integrar GET /public-files/{id}/my-access cuando el backend lo implemente,
 *           para también habilitar edición a usuarios con can_update=true.
 *
 * Si canEdit=true: desbloquea nombre, catálogo y botón eliminar.
 * Si isOwnerOrAdmin=true: además muestra el selector de permisos.
 */
export const FileInfoModal = ({
    open,
    file,
    catalogs,
    onClose,
    onRename,
    onDelete,
}) => {
    const { getMyPermissions, getPermissions, setPermissions, revokePermission, generateSignedLink } = usePublicFiles();
    const { users } = useUsers();

    const [name, setName] = useState('');
    const [catalogId, setCatalogId] = useState('');

    // QR & Signed link states
    const [showingQr, setShowingQr] = useState(false);
    const [signedData, setSignedData] = useState(null);
    const [generatingLink, setGeneratingLink] = useState(false);

    // Permisos de otros usuarios sobre este archivo (solo cargados si isOwnerOrAdmin)
    const [permissions, setPermissionsList] = useState([]);
    const [originalPermissions, setOriginalPermissions] = useState([]);

    // Estados de acceso determinados al abrir el modal
    const [isOwnerOrAdmin, setIsOwnerOrAdmin] = useState(false);
    const [canEdit, setCanEdit] = useState(false);

    const [checkingAccess, setCheckingAccess] = useState(false);
    const [loadingPermissions, setLoadingPermissions] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (open && file) {
            setName(file.name || '');
            setCatalogId(file.public_file_catalog_id ? String(file.public_file_catalog_id) : '');
            setPermissionsList([]);
            setOriginalPermissions([]);
            checkAccess();
        } else {
            setIsOwnerOrAdmin(false);
            setCanEdit(false);
            setPermissionsList([]);
            setOriginalPermissions([]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, file]);

    /**
     * Determina el nivel de acceso del usuario sobre este archivo.
     *
     * `file.is_owner_or_admin` se calcula localmente en PublicFilesContext al leer del cache
     * (user.role === 'admin' || file.user_id === user.id) — no requiere llamadas adicionales a la API.
     *
     * Si es owner/admin: carga la lista de permisos de terceros (GET /permissions).
     * Si no lo es: consulta GET /my-permissions para saber si tiene can_update.
     */
    const checkAccess = async () => {
        setCheckingAccess(true);

        const ownerOrAdmin = Boolean(file.is_owner_or_admin);
        setIsOwnerOrAdmin(ownerOrAdmin);

        if (ownerOrAdmin) {
            setCanEdit(true);
            await loadPermissions();
        } else {
            const myPerms = await getMyPermissions(file.id);
            setCanEdit(myPerms.ok && myPerms.data?.can_update === true);
        }

        setCheckingAccess(false);
    };

    /** Carga los permisos del archivo desde la API (solo owner/admin puede hacer esto). */
    const loadPermissions = async () => {
        setLoadingPermissions(true);
        try {
            const result = await getPermissions(file.id);
            const loaded = result.ok ? (result.data || []) : [];
            setPermissionsList(loaded);
            setOriginalPermissions(loaded);
        } catch {
            setPermissionsList([]);
            setOriginalPermissions([]);
        } finally {
            setLoadingPermissions(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!name.trim() || !file) return;

        setSaving(true);
        try {
            const newName = name.trim();
            const newCatalogId = catalogId ? Number(catalogId) : null;
            const hasRenameChanges =
                newName !== file.name ||
                newCatalogId !== (file.public_file_catalog_id || null);

            if (hasRenameChanges) {
                // onRename lanza error si falla; el padre muestra el toast de error
                await onRename({ id: file.id, name: newName, catalogId: newCatalogId });
                onClose();
                return;
            }

            // Solo permisos (sin cambios de nombre/catálogo)
            if (isOwnerOrAdmin) {
                let hasPermissionChanges = false;
                const promises = [];
                const currentIds = new Set(permissions.map((p) => String(p.user_id)));

                for (const orig of originalPermissions) {
                    if (!currentIds.has(String(orig.user_id))) {
                        promises.push(revokePermission(file.id, orig.user_id));
                        hasPermissionChanges = true;
                    }
                }
                for (const p of permissions) {
                    const orig = originalPermissions.find((o) => String(o.user_id) === String(p.user_id));
                    if (!orig || orig.can_update !== p.can_update || orig.can_delete !== p.can_delete) {
                        promises.push(setPermissions(file.id, {
                            user_id: Number(p.user_id),
                            can_update: Boolean(p.can_update),
                            can_delete: Boolean(p.can_delete),
                        }));
                        hasPermissionChanges = true;
                    }
                }

                if (promises.length > 0) {
                    await Promise.all(promises);
                    showAppToast({ title: 'Permisos actualizados', variant: 'success' });
                }

                if (hasPermissionChanges) {
                    onClose();
                    return;
                }
            }

            onClose();
        } catch (error) {
            let description = 'No pudimos guardar los cambios. Intenta de nuevo en unos momentos.';
            
            if (error.message?.includes('403')) {
                description = 'No tienes los permisos necesarios para modificar este archivo.';
            } else if (error.message?.includes('422')) {
                description = 'El nombre del archivo ya existe o contiene caracteres no permitidos. Por favor, revísalo.';
            } else if (error.message?.includes('500')) {
                description = 'El servidor tuvo un problema al procesar los cambios. Por favor, contacta a soporte.';
            }

            showAppToast({
                title: 'Error al guardar',
                description,
                variant: 'danger',
            });
        } finally {
            setSaving(false);
        }
    };

    const handleGenerateQr = async () => {
        if (!file?.id) return;
        setGeneratingLink(true);
        try {
            const result = await generateSignedLink(file.id);
            setSignedData(result);
            setShowingQr(true);
        } catch (error) {
            let description = 'No se pudo generar el código de descarga. Intenta de nuevo en unos momentos.';
            
            if (error.message?.includes('403')) {
                description = 'No tienes autorización para generar enlaces de descarga para este archivo.';
            } else if (error.message?.includes('401')) {
                description = 'Tu sesión ha expirado. Por favor, vuelve a ingresar.';
            }

            showAppToast({ 
                title: 'Error al generar enlace', 
                description, 
                variant: 'danger' 
            });
        } finally {
            setGeneratingLink(false);
        }
    };

    // Datos derivados del archivo para mostrar en la sección de info
    const ownerUser = users?.find((u) => String(u.id) === String(file?.user_id));
    const ownerName = ownerUser
        ? `${ownerUser.name}${ownerUser.last_name ? ' ' + ownerUser.last_name : ''}`
        : 'Desconocido';
    const extension = getExtension(file?.name);
    const IconComponent = getFileIcon(file?.mime_type);
    const catalogName = catalogs?.find((c) => String(c.id) === String(file?.public_file_catalog_id))?.name || 'General';

    const isLoading = checkingAccess || loadingPermissions;

    const footer = (
        <>
            <Button
                variant="secondary"
                onClick={handleGenerateQr}
                disabled={generatingLink || saving}
                isLoading={generatingLink}
                icon={QrCode}
            >
                Generar QR
            </Button>
            {canEdit && (
                <>
                    <Button
                        variant="danger"
                        onClick={() => onDelete(file)}
                        disabled={saving || generatingLink}
                        isLoading={saving}
                        icon={Trash2}
                    >
                        Eliminar
                    </Button>
                    <Button
                        type="submit"
                        form="file-info-form"
                        disabled={saving || !name.trim() || isLoading || generatingLink}
                        isLoading={saving}
                    >
                        Guardar Cambios
                    </Button>
                </>
            )}
        </>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Información del Archivo"
            maxWidth={isOwnerOrAdmin ? 'max-w-2xl' : 'max-w-lg'}
            footer={footer}
        >
            {/* Encabezado con ícono y nombre */}
            <div className="flex items-center gap-4 p-4 bg-(--bg-input) rounded-xl border border-(--border-subtle) mb-4">
                <div className="p-3 bg-blue-500/10 rounded-xl text-blue-500 shrink-0">
                    <IconComponent size={28} />
                </div>
                <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-(--text-primary) truncate text-base">{file?.name}</h3>
                    <div className="flex items-center flex-wrap gap-x-3 gap-y-1 mt-1">
                        <span className="text-xs font-bold uppercase bg-blue-500/10 text-blue-600 px-2 py-0.5 rounded-full">
                            {extension}
                        </span>
                        <span className="text-xs text-(--text-tertiary) flex items-center gap-1">
                            <HardDrive size={11} />
                            {formatBytes(file?.size)}
                        </span>
                        <span className="text-xs text-(--text-tertiary) flex items-center gap-1">
                            <Calendar size={11} />
                            {formatDate(file?.created_at)}
                        </span>
                    </div>
                </div>
            </div>

            {/* Metadata: propietario y catálogo */}
            <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="flex items-center gap-2 p-3 bg-(--bg-input) rounded-lg border border-(--border-subtle)">
                    <User size={14} className="text-(--text-tertiary) shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xs text-(--text-tertiary)">Propietario</p>
                        <p className="text-sm font-medium text-(--text-primary) truncate">{ownerName}</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 p-3 bg-(--bg-input) rounded-lg border border-(--border-subtle)">
                    <Tag size={14} className="text-(--text-tertiary) shrink-0" />
                    <div className="min-w-0">
                        <p className="text-xs text-(--text-tertiary)">Catálogo</p>
                        <p className="text-sm font-medium text-(--text-primary) truncate">{catalogName}</p>
                    </div>
                </div>
            </div>

            {/* Sección de edición (solo si canEdit) */}
            {isLoading ? (
                <div className="flex justify-center py-6 border-t border-(--border-subtle)">
                    <Loader2 className="h-6 w-6 animate-spin text-indigo-500" />
                </div>
            ) : canEdit ? (
                <form id="file-info-form" onSubmit={handleSubmit} className="space-y-4 border-t border-(--border-subtle) pt-4">
                    <div>
                        <label htmlFor="info-name" className="block text-sm font-medium text-(--text-secondary) mb-1">
                            Nombre del archivo
                        </label>
                        <input
                            id="info-name"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            placeholder="Nombre con extensión (ej. contrato.pdf)"
                            autoFocus
                        />
                    </div>
                    <div>
                        <label htmlFor="info-catalog" className="block text-sm font-medium text-(--text-secondary) mb-1">
                            Catálogo
                        </label>
                        <select
                            id="info-catalog"
                            value={catalogId}
                            onChange={(e) => setCatalogId(e.target.value)}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                            <option value="">General</option>
                            {catalogs.map((c) => (
                                <option key={c.id} value={c.id}>{c.name}</option>
                            ))}
                        </select>
                    </div>

                    {/* Gestión de permisos: solo para owner/admin */}
                    {isOwnerOrAdmin && (
                        <FilePermissionsSelector
                            permissions={permissions}
                            onChange={setPermissionsList}
                            excludeUserIds={[String(file?.user_id)]}
                        />
                    )}
                </form>
            ) : null}

            <QrCodeModal 
                open={showingQr} 
                file={file} 
                signedData={signedData} 
                onClose={() => setShowingQr(false)} 
            />
        </Modal>
    );
};

// Re-export con el nombre anterior para compatibilidad con imports existentes
export { FileInfoModal as RenameFileModal };
