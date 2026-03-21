import { useState } from 'react';

/**
 * Encapsula los 13 useState de la página Cases.
 * Los grupos lógicos son: filtros persistidos, casos cerrados, modales y estado de reporte.
 *
 * @param {object} initialFilters - Filtros restaurados desde localStorage (ya mergeados con defaults).
 */
export function useCasesPageState(initialFilters = {}) {
    // Filtros persistidos en localStorage
    const [searchTerm, setSearchTerm]       = useState(initialFilters.searchTerm   ?? '');
    const [statusFilter, setStatusFilter]   = useState(initialFilters.statusFilter ?? 'Activo');
    const [typeFilter, setTypeFilter]       = useState(initialFilters.typeFilter   ?? 'all');
    const [sortBy, setSortBy]               = useState(initialFilters.sortBy       ?? 'updated_at');
    const [sortOrder, setSortOrder]         = useState(initialFilters.sortOrder    ?? 'desc');

    // Casos cerrados (carga lazy)
    const [closedCases, setClosedCases]     = useState([]);
    const [loadingClosed, setLoadingClosed] = useState(false);
    const [closedLoaded, setClosedLoaded]   = useState(false);

    // Modal de nuevo caso
    const [isModalOpen, setIsModalOpen]     = useState(false);

    // Modal y estado del reporte personalizado
    const [reportModalOpen, setReportModalOpen]     = useState(false);
    const [reportData, setReportData]               = useState(null);
    const [activeReportCase, setActiveReportCase]   = useState(null);
    const [isDownloading, setIsDownloading]         = useState(false);

    return {
        searchTerm, setSearchTerm,
        statusFilter, setStatusFilter,
        typeFilter, setTypeFilter,
        sortBy, setSortBy,
        sortOrder, setSortOrder,
        closedCases, setClosedCases,
        loadingClosed, setLoadingClosed,
        closedLoaded, setClosedLoaded,
        isModalOpen, setIsModalOpen,
        reportModalOpen, setReportModalOpen,
        reportData, setReportData,
        activeReportCase, setActiveReportCase,
        isDownloading, setIsDownloading,
    };
}
