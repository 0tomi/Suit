import { useState, useReducer } from 'react';
import { useCases } from '../../context/CasesContext';
import { useGastoCatalogo } from '../../context/GastoCatalogoContext';
import { createGastoCaso } from '../../services/gastoSuitCaseService';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Label } from '../ui/Label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import { showAppToast } from '../ui/show-app-toast';
import { createLogger } from '../../services/logService';
import { getApiErrorMessage } from '../../utils/apiErrorMessage';
import { useCaseClientsOptions } from '../../hooks/useCaseClientsOptions.js';
import { Modal } from '../ui/Modal';

const logger = createLogger('NewGastoModal');

const formInitial = {
    suit_case_id: '',
    client_id: '',
    gasto_id: '',
    monto: '',
};

function validateGastoForm(form) {
    const errors = {};

    if (!form.suit_case_id) {
        errors.suit_case_id = 'Seleccioná un caso.';
    }

    if (!form.gasto_id) {
        errors.gasto_id = 'Seleccioná un tipo de gasto.';
    }

    if (!form.client_id) {
        errors.client_id = 'Seleccioná un cliente.';
    }

    if (!form.monto || Number(form.monto) <= 0) {
        errors.monto = 'El monto debe ser mayor a cero.';
    }

    return errors;
}

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

export function NewGastoModal({ closeModal, onSuccess, caseId }) {
    const { cases } = useCases();
    const { gastos_catalogo: gastosCatalogo = [] } = useGastoCatalogo();
    const [form, dispatch] = useReducer(formReducer, { ...formInitial, suit_case_id: caseId || '' });
    const [loading, setLoading] = useState(false);
    const [formError, setFormError] = useState('');
    const [fieldErrors, setFieldErrors] = useState({});
    const {
        clients: availableClients,
        loading: caseClientsLoading,
        error: caseClientsError,
    } = useCaseClientsOptions(form.suit_case_id);

    const handleFieldChange = (field) => (e) => {
        setFieldErrors((prev) => ({ ...prev, [field]: undefined }));
        if (formError) setFormError('');
        dispatch({ type: 'SET_FIELD', field, payload: e.target.value });
    };

    const handleSelectChange = (field) => (value) => {
        setFieldErrors((prev) => ({
            ...prev,
            [field]: undefined,
            ...(field === 'suit_case_id' ? { client_id: undefined } : {}),
        }));
        if (formError) setFormError('');

        if (field === 'suit_case_id') {
            // El cliente queda condicionado por el expediente, así que lo
            // reiniciamos cada vez que el usuario cambia de caso.
            dispatch({ type: 'SET_FIELD', field: 'suit_case_id', payload: value });
            dispatch({ type: 'SET_FIELD', field: 'client_id', payload: '' });
            return;
        }

        dispatch({ type: 'SET_FIELD', field, payload: value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();

        const validationErrors = validateGastoForm(form);
        if (Object.keys(validationErrors).length > 0) {
            const validationMessage = Object.values(validationErrors).join(' ');
            setFieldErrors(validationErrors);
            setFormError(validationMessage);
            showAppToast({
                title: 'No se pudo crear el gasto',
                description: validationMessage,
                variant: 'danger',
            });
            return;
        }

        setLoading(true);
        try {
            const result = await createGastoCaso(form.suit_case_id, {
                client_id: form.client_id,
                gasto_id: form.gasto_id,
                monto: form.monto,
            });
            if (result.ok) {
                showAppToast({ title: 'Éxito', description: 'Gasto creado correctamente.', variant: 'success' });
                setFormError('');
                setFieldErrors({});
                onSuccess();
                closeModal();
            } else {
                const serverMessage = getApiErrorMessage(result, 'No se pudo crear el gasto.');
                setFormError(serverMessage);
                showAppToast({ title: 'Error', description: serverMessage, variant: 'danger' });
            }
        } catch (err) {
            logger.error('Error creating gasto', err);
            const networkMessage = 'Ocurrió un error al contactar al servidor.';
            setFormError(networkMessage);
            showAppToast({ title: 'Error de Red', description: networkMessage, variant: 'danger' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            open={true}
            onClose={closeModal}
            title="Crear Nuevo Gasto"
            maxWidth="max-w-md"
            noOverlay
        >
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                {formError ? (
                    <div
                        data-testid="new-gasto-error-banner"
                        className="rounded-lg border border-(--border-danger) bg-(--bg-danger-subtle) px-4 py-3 text-sm text-(--text-danger)"
                    >
                        {formError}
                    </div>
                ) : null}
                <div>
                    <Label htmlFor="gasto-case_id">Caso <span className="text-red-500">*</span></Label>
                    <Select onValueChange={handleSelectChange('suit_case_id')} value={form.suit_case_id} disabled={!!caseId}>
                        <SelectTrigger
                            id="gasto-case_id"
                            aria-invalid={Boolean(fieldErrors.suit_case_id)}
                            className={fieldErrors.suit_case_id ? 'border-red-300 focus:ring-red-500' : ''}
                        >
                            <SelectValue placeholder="Seleccionar caso..." />
                        </SelectTrigger>
                        <SelectContent>{cases.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.title}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldErrors.suit_case_id ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.suit_case_id}</p>
                    ) : null}
                </div>
                <div>
                    <Label htmlFor="gasto_id">Tipo de Gasto <span className="text-red-500">*</span></Label>
                    <Select onValueChange={handleSelectChange('gasto_id')} value={form.gasto_id}>
                        <SelectTrigger
                            id="gasto_id"
                            aria-invalid={Boolean(fieldErrors.gasto_id)}
                            className={fieldErrors.gasto_id ? 'border-red-300 focus:ring-red-500' : ''}
                        >
                            <SelectValue placeholder="Seleccionar tipo..." />
                        </SelectTrigger>
                        <SelectContent>{gastosCatalogo.map(g => <SelectItem key={g.id} value={String(g.id)}>{g.titulo}</SelectItem>)}</SelectContent>
                    </Select>
                    {fieldErrors.gasto_id ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.gasto_id}</p>
                    ) : null}
                </div>
                <div>
                    <Label htmlFor="gasto-client_id">Cliente <span className="text-red-500">*</span></Label>
                    <Select
                        onValueChange={handleSelectChange('client_id')}
                        value={form.client_id}
                        disabled={!form.suit_case_id || caseClientsLoading || availableClients.length === 0}
                    >
                        <SelectTrigger
                            id="gasto-client_id"
                            aria-invalid={Boolean(fieldErrors.client_id)}
                            className={fieldErrors.client_id ? 'border-red-300 focus:ring-red-500' : ''}
                        >
                            <SelectValue placeholder="Seleccionar cliente..." />
                        </SelectTrigger>
                        <SelectContent>
                            {availableClients.map(c => <SelectItem key={c.id} value={String(c.id)}>{c.first_name} {c.last_name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                    {fieldErrors.client_id ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.client_id}</p>
                    ) : null}
                    {caseClientsError ? (
                        <p className="mt-1 text-xs text-red-600">{caseClientsError}</p>
                    ) : null}
                    {!caseClientsError && form.suit_case_id && availableClients.length === 0 && !caseClientsLoading ? (
                        <p className="mt-1 text-xs text-(--text-secondary)">El caso seleccionado no tiene clientes vinculados.</p>
                    ) : null}
                </div>
                <div>
                    <Label htmlFor="gasto-monto">Monto <span className="text-red-500">*</span></Label>
                    <Input
                        id="gasto-monto"
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={form.monto}
                        onChange={handleFieldChange('monto')}
                        onKeyDown={(e) => ['e', 'E'].includes(e.key) && e.preventDefault()}
                        aria-invalid={Boolean(fieldErrors.monto)}
                        className={fieldErrors.monto ? 'border-red-300 focus:ring-red-500' : ''}
                        required
                    />
                    {fieldErrors.monto ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.monto}</p>
                    ) : null}
                </div>
                <div className="flex justify-center pt-4">
                    <Button type="submit" disabled={loading}>{loading ? 'Creando...' : 'Crear Gasto'}</Button>
                </div>
            </form>
        </Modal>
    );
}
