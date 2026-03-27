import React, { useState } from 'react';
import { AnimatedFilterContent } from './AnimatedFilterContent';
import { useSettings } from '../../context/SettingsContext';

const EMPTY_COLUMNS = [];

/**
 * Estructura de Tabla común reutilizable con Tailwind.
 */
export const Table = ({
    columns = EMPTY_COLUMNS, // [{ header: 'Nombre', align: 'left', className: '' }]
    children, // tr/td mappings go here
    emptyMessage = "No se encontraron resultados.",
    isEmpty = false,
    className = '',
    trigger, // Trigger opcional para la animación de filtro
    currentPage // Página actual para la animación de paginación
}) => {
    const { tablePageAnimationsEnabled } = useSettings();
    const [prevPage, setPrevPage] = useState(currentPage);
    const [direction, setDirection] = useState('next');

    // Ajustar dirección cuando cambia el currentPage durante el render (patrón recomendado por React)
    if (currentPage !== prevPage) {
        if (currentPage !== undefined && prevPage !== undefined) {
            if (currentPage > prevPage) {
                setDirection('next');
            } else if (currentPage < prevPage) {
                setDirection('prev');
            }
        }
        setPrevPage(currentPage);
    }

    const animationClass = (tablePageAnimationsEnabled && currentPage !== undefined)
        ? `animate-table-${direction}`
        : '';

    const tableMarkup = (
        <div className={`bg-(--bg-card) rounded-xl shadow-sm border border-(--border-subtle) overflow-hidden ${className}`}>
            <div className="overflow-x-auto w-full">
                <table className="w-full text-left border-collapse">
                    <thead className="bg-(--bg-header) border-b border-(--border-subtle)">
                        <tr>
                            {columns.map((col) => (
                                <th
                                    key={col.key ?? col.header}
                                    className={`px-6 py-4 text-xs font-semibold text-(--text-secondary) uppercase tracking-wider ${col.align === 'right' ? 'text-right' : 'text-left'} ${col.className || ''}`}
                                >
                                    {col.header}
                                </th>
                            ))}
                        </tr>
                    </thead>
                    <tbody
                        key={currentPage} // Forzar re-render de las filas para disparar la animación
                        className={`divide-y divide-(--border-subtle) bg-(--bg-card) ${animationClass}`}
                    >
                        {children}
                    </tbody>
                </table>
            </div>
            {isEmpty && (
                <div className="p-8 text-center text-(--text-secondary) text-sm italic">
                    {emptyMessage}
                </div>
            )}
        </div>
    );

    if (trigger !== undefined) {
        return <AnimatedFilterContent trigger={trigger}>{tableMarkup}</AnimatedFilterContent>;
    }

    return tableMarkup;
};
