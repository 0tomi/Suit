import React from 'react';

/**
 * Componente que envuelve contenido (como tablas o listas) y aplica una animación 
 * de desvanecimiento suave cada vez que cambia un "trigger" (usualmente los filtros).
 * 
 * @param {any} trigger - Cualquier valor que al cambiar deba reiniciar la animación.
 * @param {React.ReactNode} children - El contenido a animar.
 * @param {string} className - Clases adicionales opcionales.
 */
export function AnimatedFilterContent({ trigger, children, className = '' }) {
    return (
        <div 
            key={trigger} 
            className={`animate-filter-fade ${className}`}
        >
            {children}
        </div>
    );
}
