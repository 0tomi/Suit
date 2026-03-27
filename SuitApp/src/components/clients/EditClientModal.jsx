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

    useEffect(() => {
        setFormData(buildInitialClientFormData(clientData));
    }, [clientData]);

    const handleInputChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
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
                            className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor={`${formId}-last-name`} className="text-sm font-medium text-(--text-secondary)">Apellido *</label>
                        <input
                            id={`${formId}-last-name`}
                            required
                            name="last_name"
                            value={formData.last_name || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                        <label htmlFor={`${formId}-identification-number`} className="text-sm font-medium text-(--text-secondary)">DNI / CUIT</label>
                        <input
                            id={`${formId}-identification-number`}
                            name="identification_number"
                            value={formData.identification_number || ''}
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
                                <SelectValue placeholder="Seleccionar género..." />
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
                        <label htmlFor={`${formId}-email`} className="text-sm font-medium text-(--text-secondary)">Email</label>
                        <input
                            id={`${formId}-email`}
                            type="email"
                            name="email"
                            value={formData.email || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                        />
                    </div>
                    <div className="space-y-2">
                        <label htmlFor={`${formId}-phone`} className="text-sm font-medium text-(--text-secondary)">Teléfono</label>
                        <input
                            id={`${formId}-phone`}
                            name="phone"
                            value={formData.phone || ''}
                            onChange={handleInputChange}
                            className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                        />
                    </div>
                </div>

                <div className="space-y-2">
                    <label htmlFor={`${formId}-address`} className="text-sm font-medium text-(--text-secondary)">Dirección</label>
                    <input
                        id={`${formId}-address`}
                        name="address"
                        value={formData.address || ''}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                    />
                </div>

                <div className="space-y-2">
                    <label htmlFor={`${formId}-notes`} className="text-sm font-medium text-(--text-secondary)">Notas (Internas)</label>
                    <textarea
                        id={`${formId}-notes`}
                        name="notes"
                        value={formData.notes || ''}
                        onChange={handleInputChange}
                        rows={3}
                        className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none resize-none"
                    />
                </div>
            </form>
        </Modal>
    );
};
