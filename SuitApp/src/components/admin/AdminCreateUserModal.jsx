import { useState } from 'react';
import { Modal } from '../ui/Modal.jsx';

const ROLE_OPTIONS = [
    { value: 'user', label: 'Usuario' },
    { value: 'lawyer', label: 'Abogado' },
    { value: 'admin', label: 'Admin' },
];

const INITIAL_FORM = {
    name: '',
    tag: '',
    password: '',
    role: 'user',
    email: '',
};

const AdminCreateUserModalContent = ({ open, onClose, onCreate, creating }) => {
    const [form, setForm] = useState(INITIAL_FORM);
    const [error, setError] = useState('');



    const handleSubmit = async (event) => {
        event.preventDefault();
        const name = form.name.trim();
        const tag = form.tag.trim();

        if (!name || !tag || !form.password || !form.role) {
            setError('Completa los campos obligatorios: nombre, tag, contraseña y rol.');
            return;
        }
        if (form.password.length < 8) {
            setError('La contraseña debe tener al menos 8 caracteres.');
            return;
        }
        setError('');
        await onCreate({
            name,
            tag,
            password: form.password,
            role: form.role,
            email: form.email.trim() || null,
        });
    };

    const footer = (
        <button
            type="submit"
            form="admin-create-user-form"
            disabled={creating}
            className="rounded-lg bg-blue-600 px-8 py-2.5 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60 transition-colors shadow-sm"
        >
            {creating ? 'Creando...' : 'Crear usuario'}
        </button>
    );

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Registrar usuario"
            maxWidth="max-w-2xl"
            footer={footer}
            footerAlignment="justify-center"
        >
            <form id="admin-create-user-form" onSubmit={handleSubmit} className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label htmlFor="admin-user-name" className="block text-sm font-medium text-(--text-secondary) mb-1">Nombre *</label>
                        <input
                            id="admin-user-name"
                            type="text"
                            value={form.name}
                            onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Nombre completo"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-user-tag" className="block text-sm font-medium text-(--text-secondary) mb-1">Tag *</label>
                        <input
                            id="admin-user-tag"
                            type="text"
                            value={form.tag}
                            onChange={(event) => setForm((current) => ({ ...current, tag: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="#LAW123"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-user-password" className="block text-sm font-medium text-(--text-secondary) mb-1">Contraseña *</label>
                        <input
                            id="admin-user-password"
                            type="password"
                            value={form.password}
                            onChange={(event) => setForm((current) => ({ ...current, password: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="Minimo 8 caracteres"
                        />
                    </div>
                    <div>
                        <label htmlFor="admin-user-role" className="block text-sm font-medium text-(--text-secondary) mb-1">Rol *</label>
                        <select
                            id="admin-user-role"
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
                    <div className="md:col-span-2">
                        <label htmlFor="admin-user-email" className="block text-sm font-medium text-(--text-secondary) mb-1">Email (opcional)</label>
                        <input
                            id="admin-user-email"
                            type="email"
                            value={form.email}
                            onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))}
                            className="w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) focus:outline-none focus:ring-2 focus:ring-blue-500"
                            placeholder="correo@dominio.com"
                        />
                    </div>

                </div>
                {error && (
                    <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-600">
                        {error}
                    </div>
                )}
            </form>
        </Modal>
    );
};

const AdminCreateUserModal = (props) => {
    const modalStateKey = props.open ? 'admin-create-user-open' : 'admin-create-user-closed';
    return <AdminCreateUserModalContent key={modalStateKey} {...props} />;
};

export default AdminCreateUserModal;
