import { useMemo } from 'react';
import { useDeadlines } from '../context/DeadlinesContext';

/**
 * Calcula los conteos de urgentes y vencidos para el badge del sidebar.
 * - overdueCount: vencimientos con status 'Vencido'
 * - urgentCount: vencimientos con priority 'Urgente' y status no terminal
 * - badgeColor: 'red' si hay vencidos, 'yellow' si solo hay urgentes, null si nada
 */
export function useDeadlineBadge() {
    const { deadlines } = useDeadlines();

    const { urgentCount, overdueCount, badgeColor } = useMemo(() => {
        if (!deadlines || deadlines.length === 0) {
            return { urgentCount: 0, overdueCount: 0, badgeColor: null };
        }

        let overdue = 0;
        let urgent = 0;

        for (const d of deadlines) {
            if (d.status === 'Cumplido') continue;

            if (d.status === 'Vencido') {
                overdue++;
            } else if (d.priority === 'Urgente') {
                urgent++;
            }
        }

        let color = null;
        if (overdue > 0) color = 'red';
        else if (urgent > 0) color = 'yellow';

        return { urgentCount: urgent, overdueCount: overdue, badgeColor: color };
    }, [deadlines]);

    return { urgentCount, overdueCount, badgeColor };
}

/**
 * Versión de useDeadlineBadge filtrada por expediente.
 */
export function useCaseDeadlineBadge(caseId) {
    const { deadlines } = useDeadlines();

    return useMemo(() => {
        if (!deadlines || !caseId) {
            return { urgentCount: 0, overdueCount: 0, badgeColor: null };
        }

        let overdue = 0;
        let urgent = 0;

        for (const d of deadlines) {
            if (Number(d.suit_case_id) !== Number(caseId)) continue;
            if (d.status === 'Cumplido') continue;

            if (d.status === 'Vencido') {
                overdue++;
            } else if (d.priority === 'Urgente') {
                urgent++;
            }
        }

        let color = null;
        if (overdue > 0) color = 'red';
        else if (urgent > 0) color = 'yellow';

        return { urgentCount: urgent, overdueCount: overdue, badgeColor: color };
    }, [deadlines, caseId]);
}
