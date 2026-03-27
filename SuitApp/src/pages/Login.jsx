import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useApi } from '../context/ApiContext';
import { Eye, EyeOff, Briefcase, Loader2, Server } from 'lucide-react';
import { unstable_PasswordToggleField as PasswordToggleField } from 'radix-ui';

const Login = () => {
    const tagInputId = useId();
    const passwordInputId = useId();
    const tagInputRef = useRef(null);
    const [tag, setTag] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();
    const { connected, setShowSetup } = useApi();

    useEffect(() => {
        tagInputRef.current?.focus();
    }, []);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!tag || !password) {
            setError('Completa todos los campos');
            return;
        }
        if (!connected) {
            setError('No hay conexión con el servidor. Configure la conexión primero.');
            return;
        }

        setError('');
        setLoading(true);

        const result = await login(tag, password);
        setLoading(false);

        if (result.success) {
            navigate('/agenda');
        } else {
            setError(result.error || 'Credenciales incorrectas');
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-4">
            <div className="bg-(--bg-card) rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
                {/* Header */}
                <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-8 text-center">
                    <Briefcase className="h-12 w-12 text-white mx-auto mb-3" />
                    <h1 className="text-2xl font-bold text-white">Suit</h1>
                    <p className="text-blue-100 text-sm mt-1">Gestión Legal Integral</p>
                </div>

                {/* Connection status */}
                <div className="px-8 pt-4">
                    <button
                        type="button"
                        onClick={() => setShowSetup(true)}
                        className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${connected
                            ? 'bg-green-500/10 text-green-600 border border-green-500/20 hover:bg-green-500/20'
                            : 'bg-red-500/10 text-red-600 border border-red-500/20 hover:bg-red-500/20'
                            }`}
                    >
                        <span className="flex items-center gap-2">
                            <Server className="w-4 h-4" />
                            {connected
                                ? 'Conectado a SuitAPP con éxito.' //`Conectado a ${apiHost}:${apiPort}`
                                : 'Sin conexión al servidor.'
                            }
                        </span>
                        <span className="text-xs underline">Cambiar</span>
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-8 space-y-5" noValidate>
                    <div>
                        <label htmlFor={tagInputId} className="block text-sm font-medium text-(--text-primary) mb-1.5">Nombre de usuario</label>
                        <input
                            id={tagInputId}
                            ref={tagInputRef}
                            type="text"
                            data-testid="login-username"
                            className="bg-(--bg-input) text-(--text-primary) w-full px-4 py-2.5 border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                            placeholder="Tu tag de usuario"
                            value={tag}
                            onChange={(e) => setTag(e.target.value)}
                        />
                    </div>
                    <div>
                        <label htmlFor={passwordInputId} className="block text-sm font-medium text-(--text-primary) mb-1.5">Contraseña</label>
                        <PasswordToggleField.Root>
                            <div className="relative">
                                <PasswordToggleField.Input
                                    id={passwordInputId}
                                    data-testid="login-password"
                                    className="bg-(--bg-input) text-(--text-primary) w-full px-4 py-2.5 border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all pr-12"
                                    placeholder="Tu contraseña"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <PasswordToggleField.Toggle className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-300 transition-colors cursor-pointer flex items-center justify-center">
                                    <PasswordToggleField.Icon
                                        visible={<Eye className="w-5 h-5" />}
                                        hidden={<EyeOff className="w-5 h-5" />}
                                    />
                                </PasswordToggleField.Toggle>
                            </div>
                        </PasswordToggleField.Root>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600 text-sm">
                            {error}
                        </div>
                    )}

                    <button
                        type="submit"
                        data-testid="login-submit"
                        disabled={loading || !connected}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white py-3 rounded-lg font-semibold shadow-lg transition-all disabled:opacity-60 flex items-center justify-center gap-2"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="w-4 h-4 animate-spin" />
                                Iniciando sesión...
                            </>
                        ) : (
                            'Iniciar Sesión'
                        )}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default Login;
