import { useState, useId } from 'react';
import { Search, X, Shield } from 'lucide-react';
import { useUsers } from '../../context/UsersContext';

export const FilePermissionsSelector = ({
    permissions = [],
    onChange,
    showRememberChoice = false,
    rememberChoice = false,
    onRememberChoiceChange,
    disabled = false,
    excludeUserIds = []
}) => {
    const { users } = useUsers();
    const [searchTerm, setSearchTerm] = useState('');
    const searchInputId = useId();

    const filteredUsers = users?.filter(u =>
        !excludeUserIds.includes(String(u.id)) &&
        !permissions.some(p => String(p.user_id) === String(u.id)) &&
        (u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
         u.tag?.toLowerCase().includes(searchTerm.toLowerCase()))
    ) || [];

    const handleSelectUser = (user) => {
        onChange([...permissions, { user_id: user.id, can_update: false, can_delete: false, user }]);
        setSearchTerm('');
    };

    const handleRemoveUser = (userId) => {
        onChange(permissions.filter(p => String(p.user_id) !== String(userId)));
    };

    const handleTogglePermission = (userId, field) => {
        onChange(permissions.map(p => {
            if (String(p.user_id) === String(userId)) {
                return { ...p, [field]: !p[field] };
            }
            return p;
        }));
    };

    return (
        <div className="border-t border-(--border-subtle) pt-4">
            <h4 className="text-sm font-medium text-(--text-primary) mb-3 flex items-center gap-2">
                <Shield className="h-4 w-4 text-indigo-500" />
                Permisos del archivo
            </h4>
            
            {/* User Search */}
            <div className="space-y-3 mb-4">
                <div className="relative">
                    <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-tertiary)" />
                    <input
                        id={searchInputId}
                        type="text"
                        placeholder="Buscar usuarios para darles permiso..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        disabled={disabled}
                        className="w-full pl-9 pr-4 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-indigo-500 outline-none text-sm disabled:opacity-60"
                    />
                    {searchTerm.trim() && !disabled && (
                        <div className="absolute top-full left-0 right-0 mt-1 bg-(--bg-card) border border-(--border-default) shadow-lg rounded-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                            {filteredUsers.length > 0 ? (
                                <ul className="divide-y divide-(--border-subtle)">
                                    {filteredUsers.map(user => (
                                        <li key={'usr-' + user.id}>
                                            <button
                                                type="button"
                                                onClick={() => handleSelectUser(user)}
                                                className="w-full px-4 py-3 text-left hover:bg-(--bg-card-hover) transition-colors"
                                            >
                                                <p className="font-medium text-(--text-primary) text-sm">{user.name}</p>
                                                <p className="text-xs text-(--text-secondary)">@{user.tag}</p>
                                            </button>
                                        </li>
                                    ))}
                                </ul>
                            ) : (
                                <div className="p-4 text-center text-sm text-(--text-secondary)">
                                    No se encontraron usuarios.
                                </div>
                            )}
                        </div>
                    )}
                </div>
            </div>

            {/* Selected Users */}
            {permissions.length > 0 && (
                <div className="space-y-2 mb-4 max-h-[250px] overflow-y-auto pr-2">
                    {permissions.map((p) => (
                        <div key={p.user_id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-(--border-default) rounded-lg bg-(--bg-card) gap-3 sm:gap-0">
                            <div className="flex items-center gap-3">
                                <div className="h-8 w-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                    {p.user?.name?.charAt(0).toUpperCase() || '?'}
                                </div>
                                <div>
                                    <p className="text-sm font-medium text-(--text-primary)">{p.user?.name || 'Cargando...'}</p>
                                    <p className="text-xs text-(--text-secondary)">@{p.user?.tag || '...'}</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-4">
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={p.can_update}
                                        onChange={() => handleTogglePermission(p.user_id, 'can_update')}
                                        disabled={disabled}
                                        className="rounded border-(--border-default) text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                                    />
                                    <span className="text-sm text-(--text-secondary)">Modificar</span>
                                </label>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={p.can_delete}
                                        onChange={() => handleTogglePermission(p.user_id, 'can_delete')}
                                        disabled={disabled}
                                        className="rounded border-(--border-default) text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                                    />
                                    <span className="text-sm text-(--text-secondary)">Eliminar</span>
                                </label>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveUser(p.user_id)}
                                    disabled={disabled}
                                    className="text-(--text-tertiary) hover:text-red-500 p-1 transition-colors disabled:opacity-60"
                                    title="Quitar usuario"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {showRememberChoice && (
                <div className="flex items-center gap-2 mt-4">
                    <input
                        id="remember-choices"
                        type="checkbox"
                        checked={rememberChoice}
                        onChange={(e) => onRememberChoiceChange(e.target.checked)}
                        disabled={disabled}
                        className="rounded border-(--border-default) text-indigo-600 focus:ring-indigo-500 disabled:opacity-60"
                    />
                    <label htmlFor="remember-choices" className="text-sm text-(--text-secondary) cursor-pointer">
                        Recordar mi elección para futuras subidas
                    </label>
                </div>
            )}
        </div>
    );
};
