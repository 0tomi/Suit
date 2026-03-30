import { useMemo, useState } from 'react';
import { Eye, Plus, Trash2, Pencil, Users, UserPlus, ShieldAlert, Activity } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useUsers } from '../../context/UsersContext.jsx';
import { showAppToast } from '../ui/show-app-toast.jsx';
import { getUserProfile, registerUser, deleteUser, updateUser } from '../../services/adminUserService.js';
import AdminUserDetailModal from './AdminUserDetailModal.jsx';
import AdminCreateUserModal from './AdminCreateUserModal.jsx';
import AdminEditUserModal from './AdminEditUserModal.jsx';
import { Table } from '../ui/Table.jsx';
import { Button } from '../ui/Button.jsx';

const ROLE_LABELS = {
    admin: 'Admin',
    lawyer: 'Abogado',
    user: 'Usuario',
};

const COLUMNS = [
    { key: 'tag', header: 'Tag' },
    { key: 'name', header: 'Nombre' },
    { key: 'role', header: 'Rol' },
    { key: 'email', header: 'Email' },
    { key: 'acciones', header: 'Acciones', align: 'right' },
];

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

    const stats = useMemo(() => {
        const total = orderedUsers.length;
        const admins = orderedUsers.filter(u => u.role === 'admin').length;
        return { total, admins };
    }, [orderedUsers]);

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
            <div className="space-y-6">
                <section className="relative overflow-hidden rounded-2xl border border-(--border-default) bg-(--bg-card)">
                    <div className="pointer-events-none absolute inset-0">
                        <div className="absolute -left-12 top-0 h-40 w-40 rounded-full bg-blue-500/10 blur-3xl" />
                        <div className="absolute right-0 top-0 h-48 w-48 rounded-full bg-indigo-500/10 blur-3xl" />
                    </div>
                    <div className="relative flex flex-col gap-5 p-6 lg:flex-row lg:items-center lg:justify-between">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-300">
                                <Users className="h-3.5 w-3.5" />
                                Gestión de Usuarios
                            </div>
                            <h2 className="mt-3 text-2xl font-semibold text-(--text-primary)">Nómina administrativa</h2>
                            <p className="mt-2 text-sm text-(--text-secondary)">
                                Visualiza, registra y elimina usuarios del sistema con acceso centralizado.
                            </p>
                        </div>
                        <Button
                            variant="primary"
                            icon={UserPlus}
                            id="admin-users-create-button"
                            onClick={() => setCreateOpen(true)}
                        >
                            Dar de alta usuario
                        </Button>
                    </div>
                </section>

                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <div className="space-y-4">
                        <Table
                            columns={COLUMNS}
                            isEmpty={initialized && orderedUsers.length === 0}
                            emptyMessage="No hay usuarios disponibles."
                        >
                            {!initialized && orderedUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="text-center p-10 text-(--text-secondary)">Cargando usuarios...</td>
                                </tr>
                            ) : (
                                orderedUsers.map((rowUser) => {
                                    const isSelf = String(rowUser.id) === String(user?.id);
                                    return (
                                        <tr key={rowUser.id} className="hover:bg-(--bg-card-hover)">
                                            <td className="px-6 py-4 text-(--text-primary) font-medium">{rowUser.tag || '—'}</td>
                                            <td className="px-6 py-4 text-(--text-primary)">{rowUser.name || 'Sin nombre'}</td>
                                            <td className="px-6 py-4 text-secondary">{ROLE_LABELS[rowUser.role] || rowUser.role || '—'}</td>
                                            <td className="px-6 py-4 text-secondary">{rowUser.email || '—'}</td>
                                            <td className="px-6 py-4 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={Eye}
                                                        onClick={() => openUserDetails(rowUser)}
                                                        title="Ver detalle"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={Pencil}
                                                        onClick={() => openEditModal(rowUser)}
                                                        title="Editar usuario"
                                                    />
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        icon={Trash2}
                                                        onClick={() => requestDeleteUser(rowUser)}
                                                        disabled={isSelf || syncing}
                                                        className="text-red-600 hover:bg-red-500/10"
                                                        title={isSelf ? 'No puedes eliminar tu propio usuario' : 'Eliminar usuario'}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </Table>
                    </div>

                    <aside className="space-y-4">
                        <div className="rounded-2xl border border-(--border-default) bg-(--bg-card) p-5 shadow-sm">
                            <div className="flex items-center gap-2">
                                <Activity className="h-5 w-5 text-blue-500" />
                                <h3 className="text-lg font-semibold text-(--text-primary)">Estadísticas</h3>
                            </div>
                            <div className="mt-4 grid grid-cols-2 gap-3">
                                <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) p-4 text-center">
                                    <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">Total</p>
                                    <p className="mt-1 text-2xl font-bold text-(--text-primary)">{stats.total}</p>
                                </div>
                                <div className="rounded-xl border border-(--border-subtle) bg-(--bg-card-hover) p-4 text-center">
                                    <p className="text-xs uppercase tracking-wider text-(--text-tertiary)">Admins</p>
                                    <p className="mt-1 text-2xl font-bold text-(--text-primary)">{stats.admins}</p>
                                </div>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-blue-500/20 bg-blue-500/5 p-5 shadow-sm">
                            <div className="flex items-center gap-2 text-blue-600 dark:text-blue-400">
                                <ShieldAlert className="h-5 w-5" />
                                <h3 className="text-lg font-semibold">Seguridad</h3>
                            </div>
                            <p className="mt-2 text-sm text-(--text-secondary) leading-relaxed">
                                Los cambios en los roles de usuario afectan los permisos de acceso a módulos sensibles. Asegurate de validar la identidad antes de asignar roles administrativos.
                            </p>
                        </div>
                    </aside>
                </div>
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
