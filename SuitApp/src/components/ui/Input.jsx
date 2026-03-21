/**
 * Primitivo de formulario: input de texto.
 * Aplica estilos base del design system y soporta todos los atributos HTML nativos.
 */
export const Input = ({ className = '', ...props }) => {
    const base =
        'w-full rounded-lg border border-(--border-default) bg-(--bg-input) px-3 py-2 text-sm text-(--text-primary) placeholder:text-(--text-tertiary) focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50 disabled:cursor-not-allowed transition-colors';

    return <input className={`${base} ${className}`} {...props} />;
};
