import { useId, useReducer, useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { useRoles } from '../../context/RolesContext';
import { createParte } from '../../services/parteService.js';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { usePartes } from '../../context/PartesContext.jsx';
import { showAppToast } from '../ui/show-app-toast';
import { createLogger } from '../../services/logService';

const logger = createLogger('NewParteModal');

const formInitial = {
    nombre: '',
    apellido: '',
    email: '',
    telefono: '',
    rol_id: '',
};

function formReducer(state, action) {
    switch (action.type) {
        case 'SET_FIELD':
            return { ...state, [action.field]: action.payload };
        case 'RESET':
            return formInitial;
        default:
            return state;
    }
}

function extractParteFromResponse(data) {
    if (!data || typeof data !== 'object') return null;

    if (data.id) return data;
    if (data.parte && typeof data.parte === 'object') return extractParteFromResponse(data.parte);
    if (data.data && typeof data.data === 'object') return extractParteFromResponse(data.data);

    return null;
}

function validateParteForm(form) {
    const trimmedNombre = form.nombre.trim();
    const trimmedEmail = form.email.trim();
    const errors = {};

    if (!trimmedNombre) {
        errors.nombre = 'El nombre es obligatorio.';
    }

    const trimmedApellido = form.apellido.trim();
    if (!trimmedApellido) {
        errors.apellido = 'El apellido es obligatorio.';
    }

    if (!form.rol_id) {
        errors.rol_id = 'Seleccioná un rol para la parte.';
    }

    if (trimmedEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
        errors.email = 'Ingresá un email válido o dejá el campo vacío.';
    }

    return errors;
}

function notifyParteFormError(message) {
    showAppToast({
        title: 'No se pudo crear la parte',
        description: message,
        variant: 'danger',
    });
}

export function NewParteModal({ onClose, closeModal, onParteCreated }) {
    const formId = useId();
    const { roles } = useRoles();
    const { refreshPartes, loadLocalPartes } = usePartes();
    const [form, dispatch] = useReducer(formReducer, formInitial);
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const isStackedModal = typeof closeModal === 'function';
    const handleClose = closeModal || onClose;

    const handleFieldChange = (field) => (e) => {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
        if (formError) setFormError('');
        dispatch({ type: 'SET_FIELD', field, payload: e.target.value });
    };

    const handleSelectChange = (field) => (value) => {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
        if (formError) setFormError('');
        dispatch({ type: 'SET_FIELD', field, payload: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        const validationErrors = validateParteForm(form);
        if (Object.keys(validationErrors).length > 0) {
            const validationMessage = Object.values(validationErrors).join(' ');
            setFieldErrors(validationErrors);
            setFormError(validationMessage);
            notifyParteFormError(validationMessage);
            return;
        }

        setLoading(true);

        const payload = {
            nombre: form.nombre.trim(),
            apellido: form.apellido.trim() || '',
            email: form.email.trim() || null,
            telefono: form.telefono.trim() || null,
            rol_id: form.rol_id ? Number(form.rol_id) : null,
        };

        try {
            const result = await createParte(payload);
            if (result.ok) {
                const createdParte = extractParteFromResponse(result.data);
                const createdPartePayload = createdParte ? { ...payload, ...createdParte } : { ...payload, ...result.data };

                try {
                    await loadLocalPartes();
                    void refreshPartes();
                } catch (cacheError) {
                    logger.warn('loadLocalPartes failed after create — fallback a refreshPartes', cacheError);
                    await refreshPartes();
                }

                showAppToast({ title: 'Éxito', description: 'Parte creada correctamente.', variant: 'success' });
                setFormError('');
                setFieldErrors({});
                if (onParteCreated) {
                    onParteCreated(createdPartePayload);
                }
                dispatch({ type: 'RESET' });
                handleClose?.();
            } else {
                const serverMessage = result.error || 'No se pudo crear la parte.';
                setFormError(serverMessage);
                notifyParteFormError(serverMessage);
            }
        } catch (err) {
            logger.error('Error creating parte', err);
            const networkMessage = 'Ocurrió un error al contactar al servidor.';
            setFormError(networkMessage);
            notifyParteFormError(networkMessage);
        } finally {
            setLoading(false);
        }
    };

    const formContent = (
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {formError ? (
                <div
                    data-testid="new-parte-error-banner"
                    className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                    {formError}
                </div>
            ) : null}
            <div className="grid grid-cols-2 gap-4">
                <div>
                    <Label htmlFor={`${formId}-nombre`}>Nombre <span className="text-red-500">*</span></Label>
                    <Input
                        id={`${formId}-nombre`}
                        value={form.nombre}
                        onChange={handleFieldChange('nombre')}
                        aria-invalid={Boolean(fieldErrors.nombre)}
                        data-testid="new-parte-nombre-input"
                        className={fieldErrors.nombre ? 'border-red-300 focus:ring-red-500' : ''}
                        required
                    />
                    {fieldErrors.nombre ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.nombre}</p>
                    ) : null}
                </div>
                <div>
                    <Label htmlFor={`${formId}-apellido`}>Apellido <span className="text-red-500">*</span></Label>
                    <Input
                        id={`${formId}-apellido`}
                        value={form.apellido}
                        onChange={handleFieldChange('apellido')}
                        aria-invalid={Boolean(fieldErrors.apellido)}
                        data-testid="new-parte-apellido-input"
                        className={fieldErrors.apellido ? 'border-red-300 focus:ring-red-500' : ''}
                        required
                    />
                    {fieldErrors.apellido ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.apellido}</p>
                    ) : null}
                </div>
            </div>
            <div>
                <Label htmlFor={`${formId}-rol`}>Rol <span className="text-red-500">*</span></Label>
                <Select onValueChange={handleSelectChange('rol_id')} value={form.rol_id}>
                    <SelectTrigger
                        id={`${formId}-rol`}
                        aria-invalid={Boolean(fieldErrors.rol_id)}
                        data-testid="new-parte-rol-trigger"
                        className={fieldErrors.rol_id ? 'border-red-300 focus:ring-red-500' : ''}
                    >
                        <SelectValue placeholder="Seleccionar rol..." />
                    </SelectTrigger>
                    <SelectContent>
                        {roles.map(rol => <SelectItem key={rol.id} value={String(rol.id)}>{rol.titulo}</SelectItem>)}
                    </SelectContent>
                </Select>
                {fieldErrors.rol_id ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.rol_id}</p>
                ) : null}
            </div>
            <div>
                <Label htmlFor={`${formId}-email`}>Email</Label>
                <Input
                    id={`${formId}-email`}
                    type="email"
                    value={form.email}
                    onChange={handleFieldChange('email')}
                    aria-invalid={Boolean(fieldErrors.email)}
                    className={fieldErrors.email ? 'border-red-300 focus:ring-red-500' : ''}
                />
                {fieldErrors.email ? (
                    <p className="mt-1 text-xs text-red-600">{fieldErrors.email}</p>
                ) : null}
            </div>
            <div>
                <Label htmlFor={`${formId}-telefono`}>Teléfono</Label>
                <Input id={`${formId}-telefono`} value={form.telefono} onChange={handleFieldChange('telefono')} />
            </div>
        </form>
    );

    const footer = (
        <div className="flex w-full justify-center">
            <Button 
                type="button" 
                onClick={handleSubmit} 
                disabled={loading} 
                icon={UserPlus}
                className="px-8"
                data-testid="new-parte-submit"
            >
                {loading ? 'Creando...' : 'Crear Parte'}
            </Button>
        </div>
    );

    if (isStackedModal) {
        return (
            <div className="w-full max-w-md overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-(--border-subtle) bg-(--bg-header) px-6 py-4">
                    <div className="min-w-0">
                        <h2 className="text-xl font-semibold text-(--text-primary)">Crear Nueva Parte</h2>
                        <p className="mt-1 text-sm text-(--text-secondary)">Cargá una parte del estudio sin salir del flujo actual.</p>
                    </div>
                    <button
                        onClick={handleClose}
                        type="button"
                        className="text-(--text-tertiary) hover:text-red-500 transition-colors p-1 rounded-md hover:bg-(--bg-card-hover)"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="p-6">
                    {formContent}
                </div>
                <div className="border-t border-(--border-subtle) bg-(--bg-header) px-6 py-4 flex justify-center">
                    {footer}
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white rounded-xl shadow-xl overflow-hidden w-full max-w-md animate-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between gap-4 border-b border-gray-100 bg-gray-50 px-6 py-4">
                <h2 className="text-xl font-semibold text-gray-900">Crear Nueva Parte</h2>
                <button
                    onClick={handleClose}
                    type="button"
                    className="text-gray-400 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-gray-100"
                >
                    <X size={20} />
                </button>
            </div>
            <div className="p-6">
                {formContent}
            </div>
            <div className="border-t border-gray-100 bg-gray-50 px-6 py-4 flex justify-center">
                {footer}
            </div>
        </div>
    );
}
