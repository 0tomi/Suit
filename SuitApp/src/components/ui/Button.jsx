import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Componente UI reutilizable para Botones.
 * Soporta variantes, tamaños y estado de carga.
 */
export const Button = ({
    children,
    variant = 'primary', // primary, secondary, danger, outline, ghost
    size = 'md', // sm, md, lg
    className = '',
    disabled = false,
    isLoading = false,
    icon: Icon,
    onClick,
    type = 'button',
    ...props
}) => {
    const baseStyles = "inline-flex items-center justify-center font-medium rounded-lg transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-offset-2";

    const variants = {
        primary: "bg-blue-600 hover:bg-blue-700 text-white focus:ring-blue-500",
        secondary: "bg-(--bg-input) hover:bg-(--border-subtle) text-(--text-primary) border border-transparent focus:ring-gray-500",
        outline: "bg-(--bg-card) border border-(--border-default) text-(--text-primary) hover:bg-(--bg-card-hover) focus:ring-blue-500 shadow-sm",
        danger: "bg-red-600 hover:bg-red-700 text-white focus:ring-red-500",
        ghost: "bg-transparent text-(--text-secondary) hover:bg-(--bg-card-hover) hover:text-(--text-primary) shadow-none border-transparent",
    };

    const sizes = {
        sm: "px-3 py-1.5 text-sm gap-1.5",
        md: "px-5 py-2.5 text-sm gap-2",
        lg: "px-6 py-3 text-base gap-2",
        icon: "p-2", // For icon-only buttons like the Go Back arrow
    };

    const classes = [
        baseStyles,
        variants[variant] || variants.primary,
        sizes[size] || sizes.md,
        (disabled || isLoading) ? 'opacity-50 cursor-not-allowed shadow-none' : '',
        className
    ].filter(Boolean).join(' ');

    return (
        <button
            type={type}
            onClick={onClick}
            disabled={disabled || isLoading}
            className={classes}
            aria-busy={isLoading || undefined}
            {...props}
        >
            {isLoading
                ? <Loader2 className={`${size === 'sm' ? 'w-4 h-4' : 'w-5 h-5'} animate-spin`} />
                : Icon && <Icon className={size === 'sm' ? "w-4 h-4" : "w-5 h-5"} />}
            {children && <span>{children}</span>}
        </button>
    );
};
