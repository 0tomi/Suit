export const DEFAULT_CLIENT_GENDER = 'X';

export const CLIENT_GENDER_OPTIONS = [
    { value: 'M', label: 'Masculino' },
    { value: 'F', label: 'Femenino' },
    { value: 'X', label: 'X' },
];

/**
 * Normaliza el género al contrato soportado por la API.
 * Si llega vacío o inválido, usa `X` para mantener un payload consistente.
 */
export function normalizeClientGender(value) {
    const normalized = typeof value === 'string' ? value.trim().toUpperCase() : '';
    return CLIENT_GENDER_OPTIONS.some((option) => option.value === normalized)
        ? normalized
        : DEFAULT_CLIENT_GENDER;
}
