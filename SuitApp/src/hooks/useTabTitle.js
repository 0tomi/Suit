import { useEffect } from 'react';
import { useTabs } from '../context/TabsContext';
import { useTabId } from '../components/TabBar/TabContent';

/**
 * Permite que una página establezca un label dinámico para su pestaña.
 * Cuando `title` es falsy, no actualiza el label (preserva el derivado del path).
 *
 * Uso:
 *   useTabTitle(caseData?.title);           // CaseDetail
 *   useTabTitle(title || 'Editor de documentos'); // DocumentEditor
 *
 * @param {string | null | undefined} title
 */
export function useTabTitle(title) {
    const { updateTabLabel } = useTabs();
    const tabId = useTabId();

    useEffect(() => {
        if (tabId && title) {
            updateTabLabel(tabId, title);
        }
    }, [tabId, title, updateTabLabel]);
}
