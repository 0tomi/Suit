import { useEffect, useId, useState } from 'react';
import { UserPlus, X } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select.jsx';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { showAppToast } from '../ui/show-app-toast';
import { getApiErrorMessage } from '../../utils/apiErrorMessage.js';
import { CLIENT_GENDER_OPTIONS } from '../../constants/clientGender.js';
import { PERSON_FORM_INITIAL_VALUES } from '../../services/personAdapters.js';

function formatCuit(digits) {
    const normalizedDigits = (digits || '').replace(/\D/g, '').slice(0, 11);
    if (normalizedDigits.length <= 2) return normalizedDigits;
    if (normalizedDigits.length <= 10) return `${normalizedDigits.slice(0, 2)}-${normalizedDigits.slice(2)}`;
    return `${normalizedDigits.slice(0, 2)}-${normalizedDigits.slice(2, 10)}-${normalizedDigits.slice(10)}`;
}

function buildModalShell({
    isStackedModal,
    handleClose,
    title,
    subtitle,
    formContent,
    footer,
    confirmDialog,
    open,
}) {
    if (isStackedModal) {
        return (
            <>
                <div className="flex max-h-[85vh] w-full max-w-xl flex-col overflow-hidden rounded-xl border border-(--border-subtle) bg-(--bg-card) shadow-2xl">
                    <div className="flex items-center justify-between gap-4 border-b border-(--border-subtle) bg-(--bg-header) px-6 py-4">
                        <div className="min-w-0">
                            <h2 className="text-xl font-bold text-(--text-primary)">{title}</h2>
                            <p className="mt-1 text-sm text-(--text-secondary)">{subtitle}</p>
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
                {confirmDialog}
            </>
        );
    }

    return (
        <>
            <Modal
                open={open}
                onClose={handleClose}
                title={title}
                subtitle={subtitle}
                maxWidth="max-w-xl"
                footer={footer}
            >
                {formContent}
            </Modal>
            {confirmDialog}
        </>
    );
}

export function PersonFormModal({
    open = false,
    onClose,
    closeModal,
    title,
    subtitle,
    submitLabel,
    successTitle = 'Éxito',
    successDescription,
    errorTitle = 'Error',
    networkErrorDescription = 'Ocurrió un error al contactar al servidor.',
    submitAction,
    onSuccess,
    initialFormData = PERSON_FORM_INITIAL_VALUES,
    showTypeField = true,
    typeLabel = 'Tipo *',
    typeOptions = [
        { value: 'person', label: 'Persona Física' },
        { value: 'company', label: 'Empresa / Persona Jurídica' },
    ],
    secondaryIdentityField = null,
    validateExtraFields = () => ({}),
    confirmDialogDescription,
}) {
    const formId = useId();
    const [formData, setFormData] = useState(initialFormData);
    const [loading, setLoading] = useState(false);
    const [fieldErrors, setFieldErrors] = useState({});
    const [idType, setIdType] = useState('dni');
    const [skipEmail, setSkipEmail] = useState(false);
    const [skipPhone, setSkipPhone] = useState(false);
    const [skipAddress, setSkipAddress] = useState(false);
    const [confirmSkipOpen, setConfirmSkipOpen] = useState(false);
    const isStackedModal = typeof closeModal === 'function';
    const handleClose = closeModal || onClose;

    useEffect(() => {
        if (!open) {
            setFormData(initialFormData);
            setFieldErrors({});
            setIdType('dni');
            setSkipEmail(false);
            setSkipPhone(false);
            setSkipAddress(false);
            setConfirmSkipOpen(false);
        }
    }, [initialFormData, open]);

    const validateForm = () => {
        const errors = {};
        if (!formData.first_name?.trim()) {
            errors.first_name = 'El nombre o razón social es obligatorio.';
        }
        if (!formData.last_name?.trim()) {
            errors.last_name = 'El apellido es obligatorio.';
        }
        if (!formData.identification_number?.trim()) {
            errors.identification_number = idType === 'dni' ? 'El DNI es obligatorio.' : 'El CUIT/CUIL es obligatorio.';
        } else if (idType === 'cuit' && formData.identification_number.replace(/\D/g, '').length !== 11) {
            errors.identification_number = 'El CUIT/CUIL debe tener 11 dígitos (XX-XXXXXXXX-X).';
        }
        if (!formData.gender) {
            errors.gender = 'El género es obligatorio.';
        }
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

        return {
            ...errors,
            ...validateExtraFields(formData),
        };
    };

    const clearFieldError = (fieldName) => {
        setFieldErrors((prev) => ({ ...prev, [fieldName]: undefined }));
    };

    const handleInputChange = (event) => {
        const { name, value } = event.target;
        let filtered = value;
        if (name === 'first_name' || name === 'last_name') {
            filtered = value.replace(/[0-9]/g, '');
        } else if (name === 'phone') {
            filtered = value.replace(/[a-zA-Z]/g, '');
        }

        clearFieldError(name);
        setFormData((prev) => ({ ...prev, [name]: filtered }));
    };

    const resetFormState = () => {
        setFormData(initialFormData);
        setFieldErrors({});
        setIdType('dni');
        setSkipEmail(false);
        setSkipPhone(false);
        setSkipAddress(false);
    };

    const isWarningError = (msg) => msg?.startsWith('Falta cargar');

    const executeSave = async () => {
        setConfirmSkipOpen(false);
        setLoading(true);

        try {
            const result = await submitAction(formData);
            if (result?.ok) {
                showAppToast({
                    title: successTitle,
                    description: successDescription,
                    variant: 'success',
                });
                resetFormState();
                onSuccess?.(result.savedEntity ?? null);
                handleClose?.();
                return;
            }

            showAppToast({
                title: errorTitle,
                description: getApiErrorMessage(result, 'No se pudo guardar la información.'),
                variant: 'danger',
            });
        } catch {
            showAppToast({
                title: errorTitle,
                description: networkErrorDescription,
                variant: 'danger',
            });
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (event) => {
        event.preventDefault();

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

        if (skipEmail || skipPhone) {
            setConfirmSkipOpen(true);
            return;
        }

        await executeSave();
    };

    const secondaryField = secondaryIdentityField?.({
        formData,
        setFormData,
        fieldErrors,
        clearFieldError,
    });

    const footer = (
        <div className="flex w-full justify-center">
            <Button
                variant="primary"
                onClick={handleSubmit}
                isLoading={loading}
                icon={UserPlus}
                className="px-8"
            >
                {submitLabel}
            </Button>
        </div>
    );

    const confirmDialog = (
        <ConfirmDialog
            open={confirmSkipOpen}
            onOpenChange={setConfirmSkipOpen}
            type="warning"
            title="¿Guardar sin completar todos los campos?"
            description={confirmDialogDescription(skipEmail, skipPhone)}
            confirmText="Sí, guardar igual"
            cancelText="Volver"
            onConfirm={executeSave}
            onCancel={() => setConfirmSkipOpen(false)}
        />
    );

    const formContent = (
        <form id={`${formId}-person-form`} onSubmit={handleSubmit} className="space-y-4" noValidate>
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
                    <div className="flex items-center justify-between">
                        <label htmlFor={`${formId}-identification-number`} className="text-sm font-medium text-(--text-secondary)">
                            {idType === 'dni' ? 'DNI' : 'CUIT / CUIL'} <span className="text-red-500">*</span>
                        </label>
                        <div className="flex overflow-hidden rounded border border-(--border-default) text-xs">
                            <button
                                type="button"
                                onClick={() => {
                                    setIdType('dni');
                                    setFormData((prev) => ({ ...prev, identification_number: '' }));
                                    clearFieldError('identification_number');
                                }}
                                className={`px-2 py-0.5 transition-colors ${idType === 'dni' ? 'bg-blue-600 text-white' : 'bg-(--bg-input) text-(--text-secondary) hover:bg-(--bg-card-hover)'}`}
                            >DNI</button>
                            <button
                                type="button"
                                onClick={() => {
                                    setIdType('cuit');
                                    setFormData((prev) => ({ ...prev, identification_number: '' }));
                                    clearFieldError('identification_number');
                                }}
                                className={`px-2 py-0.5 transition-colors ${idType === 'cuit' ? 'bg-blue-600 text-white' : 'bg-(--bg-input) text-(--text-secondary) hover:bg-(--bg-card-hover)'}`}
                            >CUIT / CUIL</button>
                        </div>
                    </div>
                    <input
                        id={`${formId}-identification-number`}
                        name="identification_number"
                        inputMode="numeric"
                        value={idType === 'cuit' ? formatCuit(formData.identification_number) : formData.identification_number}
                        onKeyDown={(e) => {
                            if (['e', 'E', '+', '-', '.', ','].includes(e.key)) {
                                e.preventDefault();
                            }
                        }}
                        onChange={(event) => {
                            clearFieldError('identification_number');
                            const raw = event.target.value.replace(/\D/g, '').slice(0, idType === 'cuit' ? 11 : 8);
                            setFormData((prev) => ({ ...prev, identification_number: raw }));
                        }}
                        className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 text-(--text-primary) outline-none ${
                            fieldErrors.identification_number ? 'border-red-500 focus:ring-red-500' : 'border-(--border-default) focus:ring-blue-500'
                        }`}
                        placeholder={idType === 'dni' ? 'Ej: 12345678' : 'XX-XXXXXXXX-X'}
                    />
                    {fieldErrors.identification_number && <p className="text-xs text-red-500 mt-1">{fieldErrors.identification_number}</p>}
                </div>
                <div className="space-y-2">
                    {showTypeField ? (
                        <>
                            <label htmlFor={`${formId}-type`} className="text-sm font-medium text-(--text-secondary)">{typeLabel}</label>
                            <select
                                id={`${formId}-type`}
                                required
                                name="type"
                                value={formData.type}
                                onChange={handleInputChange}
                                className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none"
                            >
                                {typeOptions.map((option) => (
                                    <option key={option.value} value={option.value}>{option.label}</option>
                                ))}
                            </select>
                        </>
                    ) : secondaryField}
                </div>
            </div>

            {!showTypeField && secondaryField ? null : secondaryField ? (
                <div className="space-y-2">
                    {secondaryField}
                </div>
            ) : null}

            <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                    <label htmlFor={`${formId}-gender`} className="text-sm font-medium text-(--text-secondary)">Género *</label>
                    <Select
                        value={formData.gender}
                        onValueChange={(value) => {
                            clearFieldError('gender');
                            setFormData((prev) => ({ ...prev, gender: value }));
                        }}
                    >
                        <SelectTrigger id={`${formId}-gender`} aria-label="Género" className={fieldErrors.gender ? 'border-red-500 focus-visible:ring-red-500' : ''}>
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
                    {fieldErrors.gender && <p className="text-xs text-red-500 mt-1">{fieldErrors.gender}</p>}
                </div>
                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <label htmlFor={`${formId}-email`} className="text-sm font-medium text-(--text-secondary)">
                            Email {!skipEmail && <span className="text-red-500">*</span>}
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-(--text-tertiary) cursor-pointer select-none">
                            <input
                                type="checkbox"
                                checked={skipEmail}
                                onChange={(event) => {
                                    setSkipEmail(event.target.checked);
                                    if (event.target.checked) {
                                        setFormData((prev) => ({ ...prev, email: '' }));
                                        clearFieldError('email');
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
                        value={formData.email}
                        onChange={handleInputChange}
                        className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none transition-colors ${
                            skipEmail ? 'opacity-40 cursor-not-allowed border-(--border-default)' :
                            fieldErrors.email ? (isWarningError(fieldErrors.email) ? 'border-yellow-500 focus:ring-yellow-500' : 'border-red-500 focus:ring-red-500') : 'border-(--border-default)'
                        }`}
                        placeholder="correo@ejemplo.com"
                    />
                    {fieldErrors.email && <p className={`text-xs mt-1 ${isWarningError(fieldErrors.email) ? 'text-yellow-600 font-medium' : 'text-red-500'}`}>{fieldErrors.email}</p>}
                </div>
            </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label htmlFor={`${formId}-phone`} className="text-sm font-medium text-(--text-secondary)">
                        Teléfono {!skipPhone && <span className="text-red-500">*</span>}
                    </label>
                    <label className="flex items-center gap-1.5 text-xs text-(--text-tertiary) cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={skipPhone}
                            onChange={(event) => {
                                setSkipPhone(event.target.checked);
                                if (event.target.checked) {
                                    setFormData((prev) => ({ ...prev, phone: '' }));
                                    clearFieldError('phone');
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
                    value={formData.phone}
                    onChange={handleInputChange}
                className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none transition-colors ${
                    skipPhone ? 'opacity-40 cursor-not-allowed border-(--border-default)' :
                    fieldErrors.phone ? (isWarningError(fieldErrors.phone) ? 'border-yellow-500 focus:ring-yellow-500' : 'border-red-500 focus:ring-red-500') : 'border-(--border-default)'
                }`}
                placeholder="Ej: 1123456789"
            />
            {fieldErrors.phone && <p className={`text-xs mt-1 ${isWarningError(fieldErrors.phone) ? 'text-yellow-600 font-medium' : 'text-red-500'}`}>{fieldErrors.phone}</p>}
        </div>

            <div className="space-y-2">
                <div className="flex items-center justify-between">
                    <label htmlFor={`${formId}-address`} className="text-sm font-medium text-(--text-secondary)">Dirección</label>
                    <label className="flex items-center gap-1.5 text-xs text-(--text-tertiary) cursor-pointer select-none">
                        <input
                            type="checkbox"
                            checked={skipAddress}
                            onChange={(event) => {
                                setSkipAddress(event.target.checked);
                                if (event.target.checked) {
                                    setFormData((prev) => ({ ...prev, address: '' }));
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
                    value={formData.address}
                    onChange={handleInputChange}
                    className={`w-full px-3 py-2 bg-(--bg-input) border rounded-lg focus:ring-2 text-(--text-primary) outline-none transition-colors ${
                        skipAddress ? 'opacity-40 cursor-not-allowed border-(--border-default)' :
                        fieldErrors.address ? (isWarningError(fieldErrors.address) ? 'border-yellow-500 focus:ring-yellow-500' : 'border-red-500 focus:ring-red-500') : 'border-(--border-default) focus:ring-blue-500'
                    }`}
                    placeholder="Calle, Número, Ciudad"
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
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 bg-(--bg-input) border border-(--border-default) rounded-lg focus:ring-2 focus:ring-blue-500 text-(--text-primary) outline-none resize-none transition-colors"
                    placeholder="Información adicional relevante..."
                />
            </div>
        </form>
    );

    return buildModalShell({
        isStackedModal,
        handleClose,
        title,
        subtitle,
        formContent,
        footer,
        confirmDialog,
        open,
    });
}

export default PersonFormModal;
