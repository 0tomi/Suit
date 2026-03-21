import React from 'react';

/**
 * Componente UI reutilizable para Etiquetas/Badges.
 */
export const Badge = ({
    children,
    variant = 'default',
    className = ''
}) => {
    const baseStyles = "inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border";

    // Variants can be extended. By default maps common statuses.
    const variants = {
        default: "bg-gray-100 text-gray-700 border-gray-200",
        success: "bg-green-100 text-green-700 border-green-200", // Activo, Finalizado
        warning: "bg-yellow-100 text-yellow-700 border-yellow-200", // Pendiente
        danger: "bg-red-100 text-red-700 border-red-200", // Deudor, Crítico
        info: "bg-blue-100 text-blue-700 border-blue-200", // En Proceso, Info
        admin: "bg-purple-100 text-purple-700 border-purple-200", // Admin roles
    };

    const variantStyles = variants[variant] || variants.default;

    return (
        <span className={`${baseStyles} ${variantStyles} ${className}`}>
            {children}
        </span>
    );
};
