/**
 * Primitivo de formulario: etiqueta para campos de input.
 * Soporta todos los atributos HTML nativos de <label>.
 */
export const Label = ({ className = '', children, ...props }) => {
    const base = 'block text-sm font-medium text-(--text-secondary) mb-1';

    return (
        <label className={`${base} ${className}`} {...props}>
            {children}
        </label>
    );
};
