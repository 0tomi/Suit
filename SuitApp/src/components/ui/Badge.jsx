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
        default: "bg-gray-100 text-gray-700 border-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-700",
        success: "bg-green-100 text-green-700 border-green-200 dark:bg-green-900/50 dark:text-green-300 dark:border-green-800", // Activo, Finalizado
        warning: "bg-yellow-100 text-yellow-700 border-yellow-200 dark:bg-yellow-900/50 dark:text-yellow-300 dark:border-yellow-800", // Pendiente
        danger: "bg-red-100 text-red-700 border-red-200 dark:bg-red-900/50 dark:text-red-300 dark:border-red-800", // Deudor, Crítico
        info: "bg-blue-100 text-blue-700 border-blue-200 dark:bg-blue-900/50 dark:text-blue-300 dark:border-blue-800", // En Proceso, Info
        admin: "bg-purple-100 text-purple-700 border-purple-200 dark:bg-purple-900/50 dark:text-purple-300 dark:border-purple-800", // Admin roles
    };

    const variantStyles = variants[variant] || variants.default;

    return (
        <span className={`${baseStyles} ${variantStyles} ${className}`}>
            {children}
        </span>
    );
};
