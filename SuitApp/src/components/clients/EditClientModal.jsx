import { useEffect, useId, useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select.jsx';
import { updateClient } from '../../services/clientService';
import { useClients } from '../../context/ClientsContext';
import { showAppToast } from '../ui/show-app-toast';
import { CLIENT_GENDER_OPTIONS, DEFAULT_CLIENT_GENDER } from '../../constants/clientGender.js';

/**
 * Completa el formulario con defaults que cumplen el contrato actual de clientes.
 */
function buildInitialClientFormData(clientData = {}) {
    return {
        ...clientData,
        type: clientData.type || 'person',
        gender: clientData.gender || DEFAULT_CLIENT_GENDER,
    };
}

export const EditClientModal = ({ open, onClose, clientData, onUpdate }) => {
    const formId = useId();
    const { refreshClients } = useClients();
    const [formData, setFormData] = useState(() => buildInitialClientFormData(clientData));
    const [loading, setLoading] = useState(false);
    const [skipEmail, setSkipEmail] = useState(false);
    const [skipPhone, setSkipPhone] = useState(false);
    const [skipAddress, setSkipAddress] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});

    useEffect(() => {
        setFormData(buildInitialClientFormData(clientData));
        setSkipEmail(false);
        setSkipPhone(false);
        setSkipAddress(false);
        setFieldErrors({});
    }, [clientData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        let filtered = value;
        if (name === 'first_name' || name === 'last_name') {
            filtered = value.replace(/[0-9]/g, '');
        } else if (name === 'phone') {
            filtered = value.replace(/[a-zA-Z]/g, '');
        } else if (name === 'identification_number') {
            filtered = value.replace(/\D/g, '').slice(0, 11);
        }
        if (fieldErrors[name]) {
            setFieldErrors(prev => ({ ...prev, [name]: undefined }));
        }
        setFormData(prev => ({ ...prev, [name]: filtered }));
    };

    const validateForm = () => {
        const errors = {};
        if (!formData.first_name?.trim()) errors.first_name = 'El nombre es obligatorio.';
        if (!formData.last_name?.trim()) errors.last_name = 'El apellido es obligatorio.';
        
        if (!skipEmail) {
            if (!formData.email?.trim()) {
                errors.email = 'Falta cargar el email';
            } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
                errors.email = 'El formato del email no es válido.';
            }
        }
        if (!skipPhone && !formData.phone?.trim()) {
            errors.phone = 'Falta cargar el teléfono';
        }
        if (!skipAddress && !formData.address?.trim()) {
            errors.address = 'Falta cargar la dirección';
        }

        return errors;
    };

    const isWarningError = (msg) => msg?.startsWith('Falta cargar');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        const errors = validateForm();
        if (Object.keys(errors).length > 0) {
            setFieldErrors(errors);
            showAppToast({
                title: 'Error de validación',
                description: Object.values(errors)[0],
                variant: 'danger',
            });
            return;
        }

        setLoading(true);

        try {
            const result = await updateClient(clientData.id, formData);
            if (result.ok) {
                showAppToast({
                    title: 'Éxito',
                    description: 'Cliente actualizado correctamente.',
                    variant: 'success',
                });
                await refreshClients();
                if (onUpdate) onUpdate(result.data);
                onClose();
            } else {
                showAppToast({
                    title: 'Error',
                    description: result.error || 'Error al actualizar cliente',
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

    return (
        <Modal
            open={open}
            onClose={onClose}
            title="Editar Cliente"
            maxWidth="max-w-xl"
            footer={
                <Button variant="primary" onClick={handleSubmit} isLoading={loading}>
                    Guardar Cambios
                </Button>
            }
        >
            <form id="edit-client-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label htmlFor={`${formId}-first-name`} className="text-sm font-medium text-(--text-secondary)">Nombre (O Razón Social) *</label>
                        <input
                            id={`${formId}-first-name`}
                            required
                            name="first_name"
                            value={formData.first_name || ''}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none ${
                                fieldErrors.first_name ? 'border-red-500 focus:ring-red-500' : 'border-(--border-default)'
                            }`}
                        />
                        {fieldErrors.first_name && <p className="text-xs text-red-500 mt-1">{fieldErrors.first_name}</p>}
                    </div>
                    <div className="space-y-2">
                        <label htmlFor={`${formId}-last-name`} className="text-sm font-medium text-(--text-secondary)">Apellido *</label>
                        <input
                            id={`${formId}-last-name`}
                            required
                            name="last_name"
                            value={formData.last_name || ''}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none ${
                                fieldErrors.last_name ? 'border-red-500 focus:ring-red-500' : 'border-(--border-default)'
                            }`}
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
                            value={formData.identification_number || ''}
                            inputMode="numeric"
                            onKeyDown={(e) => {
                                if (['e', 'E', '+', '-', '.', ','].includes(e.key)) {
                                    e.preventDefault();
                                }
                            }}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor={`${formId}-gender`} className="text-sm font-medium text-(--text-secondary)">Género *</label>
                        <Select
                            value={formData.gender || DEFAULT_CLIENT_GENDER}
                            onValueChange={(value) => setFormData(prev => ({ ...prev, gender: value }))}
                        >
                            <SelectTrigger id={`${formId}-gender`} aria-label="Género">
                                <SelectValue placeholder="Elegir..." />
                            </SelectTrigger>
                            <SelectContent>
                                {CLIENT_GENDER_OPTIONS.map((option) => (
                                    <SelectItem key={option.value} value={option.value}>
                                        {option.label}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label htmlFor={`${formId}-type`} className="text-sm font-medium text-(--text-secondary)">Tipo *</label>
                        <select
                            id={`${formId}-type`}
                            required
                            name="type"
                            value={formData.type || 'person'}
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
                        <div className="flex items-center justify-between">
                            <label htmlFor={`${formId}-email`} className="text-sm font-medium text-(--text-secondary)">Email</label>
                            <label className="flex items-center gap-1.5 text-xs text-(--text-tertiary) cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={skipEmail}
                                    onChange={(e) => {
                                        setSkipEmail(e.target.checked);
                                        if (e.target.checked) {
                                            setFormData(prev => ({ ...prev, email: '' }));
                                            setFieldErrors(prev => ({ ...prev, email: undefined }));
                                        }
                                    }}
                                    className="rounded"
                                />
                                No cargar
                            </label>
                        </div>
                        <input
                            id={`${formId}-email`}
                            type="email"
                            name="email"
                            disabled={skipEmail}
                            value={formData.email || ''}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none transition-colors ${
                                skipEmail ? 'opacity-40 cursor-not-allowed border-(--border-default)' :
                                fieldErrors.email ? (isWarningError(fieldErrors.email) ? 'border-yellow-500 focus:ring-yellow-500' : 'border-red-500 focus:ring-red-500') : 'border-(--border-default)'
                            }`}
                        />
                        {fieldErrors.email && <p className={`text-xs mt-1 ${isWarningError(fieldErrors.email) ? 'text-yellow-600 font-medium' : 'text-red-500'}`}>{fieldErrors.email}</p>}
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <label htmlFor={`${formId}-phone`} className="text-sm font-medium text-(--text-secondary)">Teléfono</label>
                            <label className="flex items-center gap-1.5 text-xs text-(--text-tertiary) cursor-pointer select-none">
                                <input
                                    type="checkbox"
                                    checked={skipPhone}
                                    onChange={(e) => {
                                        setSkipPhone(e.target.checked);
                                        if (e.target.checked) {
                                            setFormData(prev => ({ ...prev, phone: '' }));
                                            setFieldErrors(prev => ({ ...prev, phone: undefined }));
                                        }
                                    }}
                                    className="rounded"
                                />
                                No cargar
                            </label>
                        </div>
                        <input
                            id={`${formId}-phone`}
                            name="phone"
                            disabled={skipPhone}
                            value={formData.phone || ''}
                            onChange={handleInputChange}
                            className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none transition-colors ${
                                skipPhone ? 'opacity-40 cursor-not-allowed border-(--border-default)' :
                                fieldErrors.phone ? (isWarningError(fieldErrors.phone) ? 'border-yellow-500 focus:ring-yellow-500' : 'border-red-500 focus:ring-red-500') : 'border-(--border-default)'
                            }`}
                        />
                        {fieldErrors.phone && <p className={`text-xs mt-1 ${isWarningError(fieldErrors.phone) ? 'text-yellow-600 font-medium' : 'text-red-500'}`}>{fieldErrors.phone}</p>}
                    </div>
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor={`${formId}-address`} className="text-sm font-medium text-(--text-secondary)">Dirección</label>
                        <label className="flex items-center gap-1.5 text-xs text-(--text-tertiary) cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={skipAddress}
                                onChange={(e) => {
                                    setSkipAddress(e.target.checked);
                                    if (e.target.checked) {
                                        setFormData(prev => ({ ...prev, address: '' }));
                                    }
                                }}
                                className="rounded"
                            />
                            No cargar
                        </label>
                    </div>
                    <input
                        id={`${formId}-address`}
                        name="address"
                        disabled={skipAddress}
                        value={formData.address || ''}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 text-(--text-primary) outline-none transition-colors ${
                            skipAddress ? 'opacity-40 cursor-not-allowed border-(--border-default)' :
                            fieldErrors.address ? (isWarningError(fieldErrors.address) ? 'border-yellow-500 focus:ring-yellow-500' : 'border-red-500 focus:ring-red-500') : 'border-(--border-default) focus:ring-blue-500'
                        }`}
                    />
                    {fieldErrors.address && <p className={`text-xs mt-1 ${isWarningError(fieldErrors.address) ? 'text-yellow-600 font-medium' : 'text-red-500'}`}>{fieldErrors.address}</p>}
                </div>

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor={`${formId}-notes`} className="text-sm font-medium text-(--text-secondary)">Notas (Internas)</label>
                    </div>
                    <textarea
                        id={`${formId}-notes`}
                        name="notes"
                        value={formData.notes || ''}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none resize-none transition-colors"
                    />
                </div>
            </form>
        </Modal>
    );
};
