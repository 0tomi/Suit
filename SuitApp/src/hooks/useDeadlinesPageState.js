import { useState } from 'react';

/**
 * Encapsula el estado de la página Deadlines.
 * Los grupos lógicos son: filtros persistidos, filtro de fecha, modales y batch selection.
 *
 * @param {object} initialFilters - Filtros restaurados desde localStorage.
 */
export function useDeadlinesPageState(initialFilters = {}) {
    // Filtros persistidos en localStorage
    const [searchTerm, setSearchTerm]           = useState(initialFilters.searchTerm     ?? '');
    const [categoryFilter, setCategoryFilter]   = useState(initialFilters.categoryFilter ?? 'all-except-completed');
    const [priorityFilter, setPriorityFilter]   = useState(initialFilters.priorityFilter ?? 'all');
    const [sortMode, setSortMode]               = useState(initialFilters.sortMode       ?? 'date-asc');

    // Filtro de fecha por KPI cards (no se persiste)
    const [dateFilter, setDateFilter]           = useState('all');

    // Modales
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
    const [postponeModalOpen, setPostponeModalOpen] = useState(false);
    const [selectedDeadline, setSelectedDeadline]   = useState(null);

    // Batch selection
    const [selectedIds, setSelectedIds]     = useState(new Set());
    const [batchLoading, setBatchLoading]   = useState(false);

    return {
        searchTerm, setSearchTerm,
        categoryFilter, setCategoryFilter,
        priorityFilter, setPriorityFilter,
        sortMode, setSortMode,
        dateFilter, setDateFilter,
        isCreateModalOpen, setIsCreateModalOpen,
        postponeModalOpen, setPostponeModalOpen,
        selectedDeadline, setSelectedDeadline,
        selectedIds, setSelectedIds,
        batchLoading, setBatchLoading,
    };
}
