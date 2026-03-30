import { useMemo } from 'react';
import { useRoles } from '../../context/RolesContext';
import { usePartes } from '../../context/PartesContext.jsx';
import { createParte } from '../../services/parteService.js';
import { createLogger } from '../../services/logService';
import {
    extractEntityFromResponse,
    PERSON_FORM_INITIAL_VALUES,
} from '../../services/personAdapters.js';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '../ui/Select';
import PersonFormModal from './PersonFormModal.jsx';

const logger = createLogger('NewParteModal');

export function NewParteModal({ open = false, onClose, closeModal, onParteCreated, onSuccess }) {
    const { roles } = useRoles();
    const { refreshPartes, loadLocalPartes } = usePartes();
    const initialFormData = useMemo(() => ({
        ...PERSON_FORM_INITIAL_VALUES,
        type: 'person',
    }), []);

    const submitAction = async (formData) => {
        const result = await createParte(formData);
        if (!result.ok) {
            return result;
        }

        const createdParte = extractEntityFromResponse(result.data, ['parte']);
        const savedEntity = createdParte
            ? { ...formData, ...createdParte }
            : { ...formData, ...result.data };

        try {
            await loadLocalPartes();
            void refreshPartes();
        } catch (cacheError) {
            logger.warn('loadLocalPartes failed after create — fallback a refreshPartes', cacheError);
            await refreshPartes();
        }

        return {
            ok: true,
            savedEntity,
        };
    };

    return (
        <PersonFormModal
            open={open}
            onClose={onClose}
            closeModal={closeModal}
            title="Nueva Parte"
            subtitle="Cargá la parte sin salir del directorio actual."
            submitLabel="Crear Parte"
            successDescription="Parte creada correctamente."
            submitAction={submitAction}
            initialFormData={initialFormData}
            showTypeField={false}
            onSuccess={(savedEntity) => {
                onParteCreated?.(savedEntity);
                onSuccess?.(savedEntity);
            }}
            secondaryIdentityField={({ formData, setFormData, fieldErrors, clearFieldError }) => (
                <>
                    <label className="text-sm font-medium text-(--text-secondary)">Rol *</label>
                    <Select
                        onValueChange={(value) => {
                            clearFieldError('rol_id');
                            setFormData((prev) => ({ ...prev, rol_id: value }));
                        }}
                        value={formData.rol_id}
                    >
                        <SelectTrigger
                            aria-invalid={Boolean(fieldErrors.rol_id)}
                            className={fieldErrors.rol_id ? 'border-red-300 focus:ring-red-500' : ''}
                        >
                            <SelectValue placeholder="Seleccionar rol..." />
                        </SelectTrigger>
                        <SelectContent>
                            {roles.map((rol) => (
                                <SelectItem key={rol.id} value={String(rol.id)}>
                                    {rol.titulo}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    {fieldErrors.rol_id ? (
                        <p className="mt-1 text-xs text-red-600">{fieldErrors.rol_id}</p>
                    ) : null}
                </>
            )}
            validateExtraFields={(formData) => {
                if (!formData.rol_id) {
                    return { rol_id: 'Seleccioná un rol para la parte.' };
                }
                return {};
            }}
            confirmDialogDescription={(skipEmail, skipPhone) => (
                <span>
                    Estás a punto de guardar la parte sin completar:
                    {skipEmail && skipPhone ? <> <strong>Email</strong> y <strong>Teléfono</strong></> : skipEmail ? <> <strong>Email</strong></> : <> <strong>Teléfono</strong></>}.
                    {' '}Podrás editarla más adelante.
                </span>
            )}
        />
    );
}

export default NewParteModal;
