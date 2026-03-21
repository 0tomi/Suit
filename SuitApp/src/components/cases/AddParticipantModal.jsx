import { useEffect, useId, useReducer, useRef } from 'react';
import { useUsers } from '../../context/UsersContext';
import { addParticipant } from '../../services/caseService';
import { Search, Shield, X, Loader2 } from 'lucide-react';

const PERMISSION_LEVELS = [
    { value: 'read', label: 'Solo Lectura (Ver)' },
    { value: 'write', label: 'Escritura (Editar y Gestionar Docs)' },
    { value: 'admin', label: 'Administrador (Control Total)' }
];

const MODAL_INITIAL_STATE = { searchTerm: '', selectedUser: null, permissionLevel: 'read', loading: false };

function modalReducer(state, action) {
    switch (action.type) {
        case 'SET_SEARCH':     return { ...state, searchTerm: action.payload };
        case 'SET_USER':       return { ...state, selectedUser: action.payload };
        case 'SET_PERMISSION': return { ...state, permissionLevel: action.payload };
        case 'SET_LOADING':    return { ...state, loading: action.payload };
        // Resetea todos los campos en un único dispatch al cerrar el modal.
        case 'RESET':          return MODAL_INITIAL_STATE;
        default:               return state;
    }
}

export default function AddParticipantModal({ open = false, caseId, onClose, onSuccess, openDialog, closeDialog }) {
    const searchInputId = useId();
    const permissionGroupName = useId();
    const searchInputRef = useRef(null);
    const { users } = useUsers();

    const [state, dispatch] = useReducer(modalReducer, MODAL_INITIAL_STATE);
    const { searchTerm, selectedUser, permissionLevel, loading } = state;
    const setSearchTerm    = (v) => dispatch({ type: 'SET_SEARCH',     payload: v });
    const setSelectedUser  = (v) => dispatch({ type: 'SET_USER',       payload: v });
    const setPermissionLevel = (v) => dispatch({ type: 'SET_PERMISSION', payload: v });
    const setLoading       = (v) => dispatch({ type: 'SET_LOADING',    payload: v });

    useEffect(() => {
        if (!open) return;
        if (selectedUser) return;
        searchInputRef.current?.focus();
    }, [open, selectedUser]);

    useEffect(() => {
        if (open) return;
        dispatch({ type: 'RESET' });
    }, [open]);

    const filteredUsers = users?.filter(u =>
        u.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        u.tag?.toLowerCase().includes(searchTerm.toLowerCase())
    ) || [];

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedUser) return;

        setLoading(true);
        try {
            const res = await addParticipant(caseId, selectedUser.tag, permissionLevel);
            if (res.ok) {
                onSuccess?.();
                onClose?.();
            } else {
                openDialog({
                    title: 'Error',
                    desc: res.error || 'No se pudo agregar al participante.',
                    type: 'danger',
                    onConfirm: closeDialog,
                    confirmText: 'Aceptar'
                });
            }
        } catch {
            openDialog({
                title: 'Error de Red',
                desc: 'Ocurrió un error al contactar al servidor.',
                type: 'danger',
                onConfirm: closeDialog,
                confirmText: 'Aceptar'
            });
        } finally {
            setLoading(false);
        }
    };

    if (!open) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-in fade-in duration-200">
            <button
                type="button"
                aria-label="Cerrar modal de participante"
                onClick={onClose}
                className="absolute inset-0 bg-black/50 backdrop-blur-sm"
            />
            <div className="relative bg-(--bg-card) rounded-xl shadow-xl w-full max-w-lg overflow-hidden animate-in zoom-in-95 duration-200">
                <div className="p-4 border-b border-(--border-default) flex justify-between items-center bg-(--bg-header)">
                    <h3 className="font-semibold text-(--text-primary) flex items-center gap-2">
                        <Shield size={18} className="text-indigo-600" />
                        Agregar Participante
                    </h3>
                    <button onClick={onClose} className="text-(--text-tertiary) hover:text-(--text-primary) transition-colors p-1 rounded-md hover:bg-(--bg-card-hover)">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6" noValidate>
                    {/* User Search */}
                    <div className="space-y-3">
                        {!selectedUser ? (
                            <label htmlFor={searchInputId} className="text-sm font-medium text-(--text-secondary)">Buscar Usuario</label>
                        ) : (
                            <p className="text-sm font-medium text-(--text-secondary)">Usuario seleccionado</p>
                        )}
                        {!selectedUser ? (
                            <div className="relative">
                                <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-(--text-tertiary)" />
                                <input
                                    id={searchInputId}
                                    ref={searchInputRef}
                                    type="text"
                                    placeholder="Buscar por nombre o tag..."
                                    value={searchTerm}
                                    onChange={(e) => setSearchTerm(e.target.value)}
                                    className="w-full pl-9 pr-4 py-2 border border-(--border-default) rounded-lg bg-(--bg-input) text-(--text-primary) focus:ring-2 focus:ring-indigo-500 outline-none text-sm"
                                />
                                {searchTerm.trim() && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-(--bg-card) border border-(--border-default) shadow-lg rounded-lg overflow-hidden z-10 max-h-48 overflow-y-auto">
                                        {filteredUsers.length > 0 ? (
                                            <ul className="divide-y divide-(--border-subtle)">
                                                {filteredUsers.map(user => (
                                                    <li key={'usr-' + user.id}>
                                                        <button
                                                            type="button"
                                                            onClick={() => setSelectedUser(user)}
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
                        ) : (
                            <div className="flex items-center justify-between p-3 border border-indigo-200 bg-indigo-50 rounded-lg">
                                <div className="flex items-center gap-3">
                                    <div className="h-8 w-8 rounded-full bg-indigo-200 text-indigo-700 flex items-center justify-center font-bold text-sm">
                                        {selectedUser.name.charAt(0).toUpperCase()}
                                    </div>
                                    <div>
                                        <p className="text-sm font-medium text-(--text-primary)">{selectedUser.name}</p>
                                        <p className="text-xs text-indigo-600 font-medium">@{selectedUser.tag}</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setSelectedUser(null)}
                                    className="text-gray-400 hover:text-red-500 p-1 transition-colors"
                                    title="Cambiar usuario"
                                >
                                    <X size={16} />
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Permission Selector */}
                    <fieldset className="space-y-3">
                        <legend className="text-sm font-medium text-(--text-secondary)">Nivel de Permiso</legend>
                        <div className="grid gap-2">
                            {PERMISSION_LEVELS.map(level => (
                                <label
                                    key={level.value}
                                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${permissionLevel === level.value
                                        ? 'border-indigo-500 bg-indigo-500/10'
                                        : 'border-(--border-default) hover:bg-(--bg-card-hover)'
                                        }`}
                                >
                                    <input
                                        type="radio"
                                        name={permissionGroupName}
                                        value={level.value}
                                        checked={permissionLevel === level.value}
                                        onChange={(e) => setPermissionLevel(e.target.value)}
                                        className="text-indigo-600 focus:ring-indigo-500"
                                    />
                                    <span className="text-sm font-medium text-(--text-secondary)">{level.label}</span>
                                </label>
                            ))}
                        </div>
                    </fieldset>

                    {/* Actions */}
                    <div className="pt-4 flex justify-center border-t border-(--border-subtle)">
                        <button
                            type="submit"
                            disabled={!selectedUser || loading}
                            className={`px-4 py-2 text-sm font-medium text-white rounded-lg flex items-center gap-2 transition-colors ${!selectedUser || loading
                                ? 'bg-indigo-400 cursor-not-allowed'
                                : 'bg-indigo-600 hover:bg-indigo-700'
                                }`}
                        >
                            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Confirmar'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
