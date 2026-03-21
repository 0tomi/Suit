/**
 * Colores por defecto para los estados de vencimientos.
 * Estos valores son sobreescribibles desde Configuración (guardados en localStorage).
 * Se usan con opacidad reducida (20%) como fondo de fila para no opacar el texto.
 */
export const DEADLINE_COLOR_DEFAULTS = {
    pendingNormal: null,           // null = fondo por defecto (--bg-card), sin tinte
    pendingUrgent: '#f97316',      // orange-500
    completed: '#9ca3af',          // gray-400
    postponedNormal: '#3b82f6',    // blue-500
    postponedUrgent: '#f97316',    // orange-500
    overdue: '#ef4444',            // red-500
};

/**
 * Resuelve el estado de visualización de un vencimiento:
 * 'pendingNormal' | 'pendingUrgent' | 'completed' | 'postponedNormal' | 'postponedUrgent' | 'overdue'
 */
export function resolveDeadlineColorKey(deadline) {
    const status = deadline?.status;
    const priority = deadline?.priority;

    if (status === 'Cumplido') return 'completed';
    if (status === 'Vencido') return 'overdue';
    if (status === 'Prorrogado') {
        return priority === 'Urgente' ? 'postponedUrgent' : 'postponedNormal';
    }
    // Pendiente (default)
    return priority === 'Urgente' ? 'pendingUrgent' : 'pendingNormal';
}

