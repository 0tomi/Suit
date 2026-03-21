import React from 'react';

const EMPTY_COLUMNS = [];

/**
 * Estructura de Tabla común reutilizable con Tailwind.
 */
export const Table = ({
    columns = EMPTY_COLUMNS, // [{ header: 'Nombre', align: 'left', className: '' }]
    children, // tr/td mappings go here
    emptyMessage = "No se encontraron resultados.",
    isEmpty = false,
    className = ''
}) => {
    return (
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
                    <tbody className="divide-y divide-(--border-subtle) bg-(--bg-card)">
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
};
