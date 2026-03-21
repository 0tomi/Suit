import React from 'react';

/**
 * FilterBarLayout — Layout estandarizado para las barras de filtros de la aplicación.
 * Proporciona un contenedor con fondo de tarjeta, bordes sutiles y una disposición
 * flexible para el buscador, los filtros y el contador de resultados.
 */
export const FilterBarLayout = ({ 
    searchBar, 
    filters, 
    resultCount,
    className = "",
    topPadding = false,
    vertical = false
}) => {
    return (
        <div className={`bg-(--bg-card) rounded-xl shadow-sm border border-(--border-subtle) ${topPadding ? 'space-y-4' : 'space-y-3'} p-4 ${className}`}>
            <div className={`flex ${vertical ? 'flex-col items-stretch' : 'flex-wrap items-center'} gap-4`}>
                {/* Lado izquierdo o superior: Buscador */}
                {searchBar && (
                    <div className={vertical ? "w-full" : "flex-1 min-w-[250px]"}>
                        {searchBar}
                    </div>
                )}

                {/* Lado derecho o inferior: Selectores de filtros y ordenamiento */}
                {filters && (
                    <div className={`flex items-center gap-4 flex-wrap ${vertical ? "w-full" : ""}`}>
                        {filters}
                    </div>
                )}
            </div>

            {/* Fila inferior: Contador de resultados (opcional) */}
            {resultCount != null && (
                <div className="pt-1">
                    <p className="text-xs text-(--text-tertiary) pl-1">
                        {resultCount}
                    </p>
                </div>
            )}
        </div>
    );
};
