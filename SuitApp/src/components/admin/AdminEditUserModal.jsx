import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';

const ROLE_OPTIONS = [
    { value: 'user', label: 'Usuario' },
    { value: 'lawyer', label: 'Abogado' },
    { value: 'admin', label: 'Admin' },
];

// Deriva el estado inicial del formulario desde el usuario para evitar sincronizar props con efectos.
const buildInitialForm = (user) => ({
    name: user?.name || '',
    tag: user?.tag || '',
    role: user?.role || 'user',
    email: user?.email || '',
    password: '',
    passwordConfirmation: '',
});

// Construye el payload mínimo para no mandar cambios inexistentes al endpoint de edición.
function buildUpdatePayload(form, user) {
    const payload = {};
    const name = form.name.trim();
    const tag = form.tag.trim();
    const nextEmail = form.email.trim() || null;

    if (name !== user.name) payload.name = name;
    if (tag !== user.tag) payload.tag = tag;
    if (form.role !== user.role) payload.role = form.role;
    if (nextEmail !== user.email) payload.email = nextEmail;

    if (form.password) {
        payload.password = form.password;
    }

    return payload;
}

const AdminEditUserModalContent = ({ open, onClose, onEdit, editing, user }) => {
    const [form, setForm] = useState(() => buildInitialForm(user));
    const [error, setError] = useState('');

    const handleSubmit = async (event) => {
        event.preventDefault();
        const name = form.name.trim();
        const tag = form.tag.trim();

        if (!name || !tag || !form.role) {
            setError('Completa los campos obligatorios: nombre, tag y rol.');
            return;
        }

        if (form.password && form.password.length < 8) {
            setError('La nueva contraseña debe tener al menos 8 caracteres.');
            return;
        }

        if (form.password !== form.passwordConfirmation) {
            setError('La confirmación de la contraseña no coincide.');
            return;
        }

        setError('');

        await onEdit(user.tag, buildUpdatePayload(form, user));
    };

    const footer = (
        <button
            type="submit"
            form="admin-edit-user-form"
            disabled={editing}
            className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
        >
            {editing ? 'Guardando...' : 'Guardar cambios'}
        </button>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title={`Editar Usuario: ${user?.tag || ''}`}
            maxWidth="max-w-2xl"
            footer={footer}
            footerAlignment="justify-center"
        >
            <form id="admin-edit-user-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="admin-edit-user-name" className="block text-sm font-medium text-(--text-secondary) mb-1">Nombre *</label>
                        <input
                            id="admin-edit-user-name"
                            type="text"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nombre completo"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-edit-user-tag" className="block text-sm font-medium text-(--text-secondary) mb-1">Tag *</label>
                        <input
                            id="admin-edit-user-tag"
                            type="text"
                            value={form.tag}
                            onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Tag del usuario (ej. L-1234)"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-edit-user-role" className="block text-sm font-medium text-(--text-secondary) mb-1">Rol *</label>
                        <select
                            id="admin-edit-user-role"
                            value={form.role}
                            onChange={(event) => setForm((current) => ({ ...current, role: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {ROLE_OPTIONS.map((role) => (
                                <option key={role.value} value={role.value}>
                                    {role.label}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label htmlFor="admin-edit-user-email" className="block text-sm font-medium text-(--text-secondary) mb-1">Email (opcional)</label>
                        <input
                            id="admin-edit-user-email"
                            type="email"
                            value={form.email}
                            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="correo@dominio.com"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-edit-user-password" className="block text-sm font-medium text-(--text-secondary) mb-1">Nueva contraseña (opcional)</label>
                        <input
                            id="admin-edit-user-password"
                            type="password"
                            autoComplete="new-password"
                            value={form.password}
                            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Dejar vacio para conservar la actual"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-edit-user-password-confirmation" className="block text-sm font-medium text-(--text-secondary) mb-1">Confirmar nueva contraseña</label>
                        <input
                            id="admin-edit-user-password-confirmation"
                            type="password"
                            autoComplete="new-password"
                            value={form.passwordConfirmation}
                            onChange={(event) => setForm((current) => ({ ...current, passwordConfirmation: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Repite la nueva contraseña"
                        />
                    </div>
                </div>
                <p className="text-xs text-(--text-secondary)">
                    Si dejas ambos campos vacios, la contraseña actual del usuario no se modifica.
                </p>
                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
};

const AdminEditUserModal = (props) => {
    const userIdentity = props.user?.id ?? props.user?.tag ?? 'admin-edit-user';
    const modalStateKey = `${userIdentity}-${props.open ? 'open' : 'closed'}`;
    return <AdminEditUserModalContent key={modalStateKey} {...props} />;
};

export default AdminEditUserModal;
