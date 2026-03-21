import { useId, useState } from 'react';
import { X, UserPlus } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { createClient } from '../../services/clientService';
import { useClients } from '../../context/ClientsContext';
import { showAppToast } from '../ui/show-app-toast';
import { buildClientCacheRow } from '../../services/sync/clientSyncService.js';
import { createLogger } from '../../services/logService.js';
const logger = createLogger('new-client-modal');

const INITIAL_FORM = {
    first_name: '',
    last_name: '',
    identification_number: '',
    email: '',
    phone: '',
    address: '',
    type: 'person',
    notes: '',
};

function extractClientFromResponse(data) {
    if (!data || typeof data !== 'object') return null;

    if (data.id) return data;
    if (data.client && typeof data.client === 'object') return data.client;
    if (data.data && typeof data.data === 'object') return extractClientFromResponse(data.data);

    return null;
}

export const NewClientModal = ({ open = false, onClose, closeModal, onSuccess }) => {
    const formId = useId();
    const { refreshClients, loadLocalData } = useClients();
    const [formData, setFormData] = useState(INITIAL_FORM);
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const isStackedModal = typeof closeModal === 'function';
    const handleClose = closeModal || onClose;

    const validateForm = () => {
        const errors = {};
        if (!formData.first_name?.trim()) {
            errors.first_name = 'El nombre o razón social es obligatorio.';
        }
        if (!formData.last_name?.trim()) {
            errors.last_name = 'El apellido es obligatorio.';
        }
        if (formData.email?.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
            errors.email = 'El formato del email no es válido.';
        }
        return errors;
    };

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            const firstError = Object.values(errors)[0];
            showAppToast({
                title: 'Error de validación',
                description: firstError,
                variant: 'danger',
            });
            return;
        }

        setLoading(true);
        const payload = {
            ...formData,
            identification_number: formData.identification_number?.trim() || null,
            email: formData.email?.trim() || null,
            phone: formData.phone?.trim() || null,
            address: formData.address?.trim() || null,
            notes: formData.notes?.trim() || null,
        };

        try {
            const result = await createClient(payload);
            if (result.ok) {
                const createdClient = extractClientFromResponse(result.data);
                const createdClientPayload = createdClient
                    ? { ...payload, ...createdClient }
                    : null;

                try {
                    if (createdClient?.id && window.electronAPI?.db) {
                        const clientForCache = {
                            status: 'active',
                            ...payload,
                            ...createdClient,
                        };

                        await window.electronAPI.db.upsertMany('clients', [buildClientCacheRow(clientForCache)]);
                        await loadLocalData();
                        void refreshClients();
                    } else {
                        await refreshClients();
                    }
                } catch (cacheError) {
                    void logger.warn('Local client cache update failed, falling back to refresh', cacheError);
                    await refreshClients();
                }

                showAppToast({
                    title: 'Éxito',
                    description: 'Cliente creado correctamente.',
                    variant: 'success',
                });
                setFormData(INITIAL_FORM);
                setFieldErrors({});
                onSuccess?.(createdClientPayload);
                handleClose?.();
            } else {
                showAppToast({
                    title: 'Error',
                    description: result.error || 'Error al crear cliente',
                    variant: 'danger',
                });
            }
        } catch {
            showAppToast({
                title: 'Error',
                description: 'Ocurrió un error al contactar al servidor',
                variant: 'danger',
            });
        } finally {
            setLoading(false);
        }
    };

    const footer = (
        <div className="flex w-full justify-center">
            <Button 
                variant="primary" 
                onClick={handleSubmit} 
                isLoading={loading}
                icon={UserPlus}
                className="px-8"
            >
                Crear Cliente
            </Button>
        </div>
    );

    const formContent = (
        <form id="new-client-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label htmlFor={`${formId}-first-name`} className="text-sm font-medium text-(--text-secondary)">Nombre (O Razón Social) *</label>
                    <input
                        id={`${formId}-first-name`}
                        name="first_name"
                        value={formData.first_name}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none ${
                            fieldErrors.first_name ? 'border-red-500 focus:ring-red-500' : 'border-(--border-default)'
                        }`}
                        placeholder="Ej: Juan"
                    />
                    {fieldErrors.first_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.first_name}</p>}
                </div>
                <div className="space-y-2">
                    <label htmlFor={`${formId}-last-name`} className="text-sm font-medium text-(--text-secondary)">Apellido *</label>
                    <input
                        id={`${formId}-last-name`}
                        name="last_name"
                        value={formData.last_name}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none ${
                            fieldErrors.last_name ? 'border-red-500 focus:ring-red-500' : 'border-(--border-default)'
                        }`}
                        placeholder="Ej: Pérez"
                    />
                    {fieldErrors.last_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.last_name}</p>}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label htmlFor={`${formId}-identification-number`} className="text-sm font-medium text-(--text-secondary)">DNI / CUIT</label>
                    <input
                        id={`${formId}-identification-number`}
                        name="identification_number"
                        value={formData.identification_number}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                        placeholder="Sin puntos ni guiones"
                    />
                </div>
                <div className="space-y-2">
                    <label htmlFor={`${formId}-type`} className="text-sm font-medium text-(--text-secondary)">Tipo *</label>
                    <select
                        id={`${formId}-type`}
                        required
                        name="type"
                        value={formData.type}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                    >
                        <option value="person">Persona Física</option>
                        <option value="company">Empresa / Persona Jurídica</option>
                    </select>
                </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label htmlFor={`${formId}-email`} className="text-sm font-medium text-(--text-secondary)">Email</label>
                    <input
                        id={`${formId}-email`}
                        type="email"
                        name="email"
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none ${
                            fieldErrors.email ? 'border-red-500 focus:ring-red-500' : 'border-(--border-default)'
                        }`}
                        placeholder="correo@ejemplo.com"
                    />
                    {fieldErrors.email && <p className="text-xs text-red-500 mt-1">{fieldErrors.email}</p>}
                </div>
                <div className="space-y-2">
                    <label htmlFor={`${formId}-phone`} className="text-sm font-medium text-(--text-secondary)">Teléfono</label>
                    <input
                        id={`${formId}-phone`}
                        name="phone"
                        value={formData.phone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                        placeholder="Ej: 1123456789"
                    />
                </div>
            </div>

            <div className="space-y-2">
                <label htmlFor={`${formId}-address`} className="text-sm font-medium text-(--text-secondary)">Dirección</label>
                <input
                    id={`${formId}-address`}
                    name="address"
                    value={formData.address}
                    onChange={handleInputChange}
                    className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                    placeholder="Calle, Número, Ciudad"
                />
            </div>

            <div className="space-y-2">
                <label htmlFor={`${formId}-notes`} className="text-sm font-medium text-(--text-secondary)">Notas (Internas)</label>
                <textarea
                    id={`${formId}-notes`}
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none resize-none"
                    placeholder="Información adicional relevante..."
                />
            </div>
        </form>
    );

    if (isStackedModal) {
        return (
            <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-2xl">
                <div className="flex items-center justify-between gap-4 border-b border-(--border-subtle) bg-(--bg-header) px-6 py-4">
                    <div className="min-w-0">
                        <h2 className="text-xl font-bold text-(--text-primary)">Nuevo Cliente</h2>
                        <p className="mt-1 text-sm text-(--text-secondary)">Cargá el cliente sin salir del selector actual.</p>
                    </div>
                    <button
                        onClick={handleClose}
                        type="button"
                        className="text-(--text-tertiary) hover:text-red-500 transition-colors p-1 rounded-md hover:bg-(--bg-card-hover)"
                    >
                        <X size={20} />
                    </button>
                </div>
                <div className="flex-1 overflow-y-auto p-6">
                    {formContent}
                </div>
                <div className="flex justify-center border-t border-(--border-subtle) bg-(--bg-header) px-6 py-4">
                    {footer}
                </div>
            </div>
        );
    }

    return (
        <Modal
            open={open}
            onClose={handleClose}
            title="Nuevo Cliente"
            subtitle="Cargá el cliente sin salir del selector actual."
            maxWidth="max-w-xl"
            footer={footer}
        >
            {formContent}
        </Modal>
    );
};
