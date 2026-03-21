/**
 * Traduce el estado crudo del caso a una etiqueta estable para la UI.
 * Centralizarlo evita que la lista y el detalle muestren estados distintos.
 */
export function getCaseStatusLabel(caseItem) {
    if (!caseItem) return 'Inicial';

    if (caseItem.end_date || caseItem.endDate) {
        return 'Finalizado';
    }

    const rawStatus = String(caseItem.status ?? '').trim().toLowerCase();
    if (rawStatus === 'closed' || rawStatus === 'finalizado') {
        return 'Finalizado';
    }

    if (rawStatus === 'open' || rawStatus === 'active' || rawStatus === 'activo') {
        return 'Activo';
    }

    return caseItem.status || 'Inicial';
}

/**
 * Indica si el caso debe tratarse como cerrado para acciones de UI.
 */
export function isCaseClosed(caseItem) {
    return getCaseStatusLabel(caseItem) === 'Finalizado';
}
