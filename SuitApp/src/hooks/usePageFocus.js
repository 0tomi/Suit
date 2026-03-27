import { useEffect, useRef } from 'react';
import { useTabs } from '../context/TabsContext';
import { useLatest } from './useLatest';

// Importamos el TabIdContext directamente desde TabContent para evitar dependencia circular
// El contexto se exporta desde TabContent y se consume aquí.
import { useTabId } from '../components/TabBar/TabContent';

/**
 * Ejecuta un callback cuando la página entra en foco dentro de su tab:
 * - primer render si monta ya activa
 * - transición inactiva -> activa
 * Equivalente al anterior usePageFocus basado en KeepAlive.
 *
 * El parámetro `path` se mantiene por compatibilidad pero ya no se usa.
 *
 * @param {{ onFocus: function, path?: string }} options
 */
export const usePageFocus = ({ onFocus }) => {
    const { activeTabId } = useTabs();
    const tabId = useTabId();
    const onFocusLatest = useLatest(onFocus);

    const isActive = tabId != null && activeTabId === tabId;
    const prevActive = useRef(false);

    useEffect(() => {
        if (isActive && !prevActive.current) {
            onFocusLatest.current?.();
        }
        prevActive.current = isActive;
    }, [isActive, onFocusLatest]);
};
