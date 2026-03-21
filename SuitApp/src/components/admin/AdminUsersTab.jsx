import { useMemo, useState } from 'react';
import { Eye, Plus, Trash2, Pencil } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useUsers } from '../../context/UsersContext.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { getUserProfile, registerUser, deleteUser, updateUser } from '../../services/adminUserService.js';
import AdminUserDetailModal from './AdminUserDetailModal.jsx';
import AdminCreateUserModal from './AdminCreateUserModal.jsx';
import AdminEditUserModal from './AdminEditUserModal.jsx';

const ROLE_LABELS = {
    admin: 'Admin',
    lawyer: 'Abogado',
    user: 'Usuario',
};

const AdminUsersTab = ({ openDialog, closeDialog, setDialogLoading }) => {
    const { user } = useAuth();
    const { users, refreshUsers, syncing, initialized } = useUsers();
    const [detailOpen, setDetailOpen] = useState(false);
    const [detailLoading, setDetailLoading] = useState(false);
    const [selectedProfile, setSelectedProfile] = useState(null);
    const [createOpen, setCreateOpen] = useState(false);
    const [creating, setCreating] = useState(false);
    const [editOpen, setEditOpen] = useState(false);
    const [editing, setEditing] = useState(false);
    const [selectedUserToEdit, setSelectedUserToEdit] = useState(null);

    const orderedUsers = useMemo(() => {
        const list = Array.isArray(users) ? [...users] : [];
        return list.sort((a, b) => {
            if (a.role === b.role) return String(a.tag || '').localeCompare(String(b.tag || ''));
            if (a.role === 'admin') return -1;
            if (b.role === 'admin') return 1;
            if (a.role === 'lawyer') return -1;
            if (b.role === 'lawyer') return 1;
            return 0;
        });
    }, [users]);

    const openUserDetails = async (targetUser) => {
        setDetailOpen(true);
        setDetailLoading(true);
        setSelectedProfile(null);
        try {
            const profile = await getUserProfile(targetUser.id);
            setSelectedProfile(profile);
        } catch (error) {
            setDetailOpen(false);
            openDialog({
                title: 'Error al cargar usuario',
                desc: error.message || 'No se pudo obtener el detalle del usuario.',
                type: 'danger',
                confirmText: 'Aceptar',
                onConfirm: closeDialog,
            });
        } finally {
            setDetailLoading(false);
        }
    };

    const handleCreateUser = async (payload) => {
        setCreating(true);
        try {
            await registerUser(payload);
            await refreshUsers();
            setCreateOpen(false);
            showAppToast({
                title: 'Usuario creado',
                description: `Se registró ${payload.tag} correctamente.`,
                variant: 'success',
            });
        } catch (error) {
            showAppToast({
                title: 'Error al crear usuario',
                description: error.message || 'No se pudo registrar el usuario.',
                variant: 'danger',
            });
        } finally {
            setCreating(false);
        }
    };

    const openEditModal = (targetUser) => {
        setSelectedUserToEdit(targetUser);
        setEditOpen(true);
    };

    const handleEditUser = async (currentTag, payload) => {
        setEditing(true);
        try {
            await updateUser(currentTag, payload);
            await refreshUsers();
            setEditOpen(false);
            showAppToast({
                title: 'Usuario actualizado',
                description: payload.password
                    ? 'Los datos y la contraseña del usuario se guardaron correctamente.'
                    : 'Los datos del usuario se guardaron correctamente.',
                variant: 'success',
            });
        } catch (error) {
            showAppToast({
                title: 'Error al actualizar',
                description: error.message || 'No se pudo actualizar el usuario.',
                variant: 'danger',
            });
        } finally {
            setEditing(false);
        }
    };

    const requestDeleteUser = (targetUser) => {
        openDialog({
            title: '¿Eliminar usuario?',
            desc: `Se dará de baja a ${targetUser.tag || targetUser.name || `Usuario #${targetUser.id}`}.`,
            type: 'danger',
            confirmText: 'Eliminar',
            onConfirm: async () => {
                setDialogLoading(true);
                try {
                    await deleteUser(targetUser.id);
                    await refreshUsers();
                    closeDialog();
                    showAppToast({
                        title: 'Usuario eliminado',
                        description: `${targetUser.tag || targetUser.name || `Usuario #${targetUser.id}`} fue dado de baja.`,
                        variant: 'success',
                    });
                } catch (error) {
                    setDialogLoading(false);
                    openDialog({
                        title: 'Error al eliminar',
                        desc: error.message || 'No se pudo eliminar el usuario.',
                        type: 'danger',
                        confirmText: 'Aceptar',
                        onConfirm: closeDialog,
                    });
                }
            },
        });
    };

    return (
        <>
            <div className="p-6 border-b border-(--border-default) bg-(--bg-card-hover)">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                    <div>
                        <h2 className="text-xl font-semibold text-(--text-primary)">Gestión de Usuarios</h2>
                        <p className="text-sm text-(--text-secondary) mt-1">Visualiza, registra y elimina usuarios del sistema.</p>
                    </div>
                    <button
                        type="button"
                        id="admin-users-create-button"
                        onClick={() => setCreateOpen(true)}
                        className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        <Plus className="h-4 w-4" />
                        Dar de alta usuario
                    </button>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-(--bg-header) text-(--text-secondary) font-medium border-b border-(--border-default)">
                        <tr>
                            <th className="p-4">Tag</th>
                            <th className="p-4">Nombre</th>
                            <th className="p-4">Rol</th>
                            <th className="p-4">Email</th>
                            <th className="p-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-(--border-subtle)">
                        {!initialized && orderedUsers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center p-8 text-(--text-secondary)">Cargando usuarios...</td>
                            </tr>
                        ) : orderedUsers.length === 0 ? (
                            <tr>
                                <td colSpan={5} className="text-center p-8 text-(--text-secondary)">No hay usuarios disponibles.</td>
                            </tr>
                        ) : (
                            orderedUsers.map((rowUser) => {
                                const isSelf = String(rowUser.id) === String(user?.id);
                                return (
                                    <tr key={rowUser.id} className="hover:bg-(--bg-card-hover)">
                                        <td className="p-4 text-(--text-primary) font-medium">{rowUser.tag || '—'}</td>
                                        <td className="p-4 text-(--text-primary)">{rowUser.name || 'Sin nombre'}</td>
                                        <td className="p-4 text-(--text-secondary)">{ROLE_LABELS[rowUser.role] || rowUser.role || '—'}</td>
                                        <td className="p-4 text-(--text-secondary)">{rowUser.email || '—'}</td>
                                        <td className="p-4">
                                            <div className="flex items-center justify-end gap-1">
                                                <button
                                                    type="button"
                                                    onClick={() => openUserDetails(rowUser)}
                                                    className="p-2 text-(--text-tertiary) hover:text-blue-600 hover:bg-blue-500/10 rounded-lg"
                                                    title="Ver detalle"
                                                >
                                                    <Eye className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openEditModal(rowUser)}
                                                    className="p-2 text-(--text-tertiary) hover:text-green-600 hover:bg-green-500/10 rounded-lg"
                                                    title="Editar usuario"
                                                >
                                                    <Pencil className="h-4 w-4" />
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => requestDeleteUser(rowUser)}
                                                    disabled={isSelf || syncing}
                                                    className="p-2 text-(--text-tertiary) hover:text-red-600 hover:bg-red-500/10 rounded-lg disabled:opacity-40 disabled:hover:text-(--text-tertiary) disabled:hover:bg-transparent"
                                                    title={isSelf ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                );
                            })
                        )}
                    </tbody>
                </table>
            </div>

            <AdminUserDetailModal
                open={detailOpen}
                onClose={() => setDetailOpen(false)}
                profile={selectedProfile}
                loading={detailLoading}
            />

            <AdminCreateUserModal
                open={createOpen}
                onClose={() => setCreateOpen(false)}
                onCreate={handleCreateUser}
                creating={creating}
            />

            <AdminEditUserModal
                open={editOpen}
                onClose={() => setEditOpen(false)}
                onEdit={handleEditUser}
                editing={editing}
                user={selectedUserToEdit}
            />
        </>
    );
};

export default AdminUsersTab;
