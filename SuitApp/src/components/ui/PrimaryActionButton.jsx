import React from 'react';
import { Plus } from 'lucide-react';
import { Button } from './Button';

/**
 * Boton de accion primaria para encabezados de seccion.
 * Centraliza estilo/comportamiento para "Nuevo ..." en toda la app.
 */
export const PrimaryActionButton = ({
    label,
    onClick,
    icon = Plus,
    variant = "primary",
    className = '',
    ...props
}) => {
    return (
        <Button
            variant={variant}
            onClick={onClick}
            icon={icon}
            className={`min-w-fit whitespace-nowrap text-base font-normal ${className}`.trim()}
            {...props}
        >
            {label}
        </Button>
    );
};
