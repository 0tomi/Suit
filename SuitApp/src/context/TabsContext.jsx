import { createContext, useContext, useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { useAuth } from './AuthContext.jsx';
import { useSettings } from './SettingsContext.jsx';
import { getPathMeta } from '../constants/tabRoutes.jsx';

const TabsContext = createContext(null);

const TABS_STORAGE_KEY = 'suit_tabs_state';
const SOFT_TAB_LIMIT = 8;

function generateId() {
    return Math.random().toString(36).slice(2, 9) + Date.now().toString(36);
}

/**
 * Crea un nuevo objeto tab con historial de navegación vacío.
 * El historial permite soportar navigate(-1) dentro del tab.
 */
function getPathnameOnly(path) {
    const qIdx = path.indexOf('?');
    return qIdx === -1 ? path : path.slice(0, qIdx);
}

function makeTab(path) {
    const meta = getPathMeta(getPathnameOnly(path));
    return {
        id: generateId(),
        initialPath: path,
        currentPath: path,
        history: [path],
        historyIndex: 0,
        label: meta.label,
        icon: meta.icon,
        navigationState: undefined, // estado de navegación (location.state), no se persiste
    };
}

function loadSavedTabs() {
    try {
        const raw = localStorage.getItem(TABS_STORAGE_KEY);
        if (!raw) return null;
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed.tabs) || parsed.tabs.length === 0) return null;
        return parsed;
    } catch {
        return null;
    }
}

/**
 * Construye el estado inicial leyendo localStorage.
 * Se llama UNA sola vez para evitar que double-calls generen IDs distintos.
 * @param {boolean} restoreTabs - Si false, siempre inicia con una sola pestaña en /agenda.
 */
function buildInitialState(restoreTabs = true) {
    const saved = restoreTabs ? loadSavedTabs() : null;
    if (saved) {
        const restoredTabs = saved.tabs.map(t => {
            const path = t.currentPath || t.initialPath;
            const meta = getPathMeta(getPathnameOnly(path));
            return {
                id: t.id,
                initialPath: t.initialPath,
                currentPath: path,
                history: [path],
                historyIndex: 0,
                label: meta.label,
                icon: meta.icon,
                navigationState: undefined,
            };
        });
        const activeExists = restoredTabs.some(t => t.id === saved.activeTabId);
        return {
            tabs: restoredTabs,
            activeTabId: activeExists ? saved.activeTabId : restoredTabs[0].id,
        };
    }
    const defaultTab = makeTab('/agenda');
    return { tabs: [defaultTab], activeTabId: defaultTab.id };
}

function saveTabs(tabs, activeTabId) {
    try {
        localStorage.setItem(TABS_STORAGE_KEY, JSON.stringify({
            tabs: tabs.map(t => ({ id: t.id, initialPath: t.initialPath, currentPath: t.currentPath })),
            activeTabId,
        }));
    } catch { /* ignorar */ }
}

function clearSavedTabs() {
    try { localStorage.removeItem(TABS_STORAGE_KEY); } catch { /* ignorar */ }
}

export const TabsProvider = ({ children }) => {
    const { user } = useAuth();
    const { restoreTabs } = useSettings();
    const initializedRef = useRef(false);

    // buildInitialState() se llama UNA sola vez en el lazy initializer.
    // restoreTabs se captura en el closure inicial; para cambios en caliente
    // el usuario tendría que cerrar sesión y volver a entrar.
    const [state, setState] = useState(() => {
        if (user) {
            initializedRef.current = true;
            return buildInitialState(restoreTabs);
        }
        const defaultTab = makeTab('/agenda');
        return { tabs: [defaultTab], activeTabId: defaultTab.id };
    });

    const { tabs, activeTabId } = state;

    // Persistir en localStorage cuando cambia el estado (solo con usuario activo)
    useEffect(() => {
        if (user) saveTabs(tabs, activeTabId);
    }, [tabs, activeTabId, user]);

    // Resetear en logout, restaurar en login
    const prevUserRef = useRef(user);
    useEffect(() => {
        const wasLoggedIn = !!prevUserRef.current;
        const isLoggedIn = !!user;
        prevUserRef.current = user;

        if (!isLoggedIn && wasLoggedIn) {
            clearSavedTabs();
            const defaultTab = makeTab('/agenda');
            setState({ tabs: [defaultTab], activeTabId: defaultTab.id });
            initializedRef.current = false;
        } else if (isLoggedIn && !wasLoggedIn && !initializedRef.current) {
            initializedRef.current = true;
            setState(buildInitialState(restoreTabs));
        }
    }, [user, restoreTabs]);

    /**
     * Navega dentro del tab activo (llamado por el custom navigator de TabContent).
     * type: 'push' agrega al historial, 'replace' reemplaza la entrada actual.
     * navigationState: location.state de React Router (ej: prefillContent desde UseTemplateModal).
     */
    const navigateInTab = useCallback((tabId, path, type = 'push', navigationState) => {
        setState(prev => ({
            ...prev,
            tabs: prev.tabs.map(t => {
                if (t.id !== tabId) return t;
                // getPathMeta necesita solo el pathname sin query string
                const meta = getPathMeta(getPathnameOnly(path));
                if (type === 'replace') {
                    const newHistory = [...t.history];
                    newHistory[t.historyIndex] = path;
                    return { ...t, currentPath: path, navigationState, history: newHistory, label: meta.label, icon: meta.icon };
                }
                // push: truncar el futuro y agregar
                const newHistory = [...t.history.slice(0, t.historyIndex + 1), path];
                return { ...t, currentPath: path, navigationState, history: newHistory, historyIndex: newHistory.length - 1, label: meta.label, icon: meta.icon };
            }),
        }));
    }, []);

    /**
     * Navega hacia atrás/adelante en el historial del tab activo.
     * delta: -1 = atrás, +1 = adelante
     * Limpia navigationState ya que al volver al historial no hay estado nuevo.
     */
    const goInTab = useCallback((tabId, delta) => {
        setState(prev => ({
            ...prev,
            tabs: prev.tabs.map(t => {
                if (t.id !== tabId) return t;
                const newIndex = Math.max(0, Math.min(t.history.length - 1, t.historyIndex + delta));
                const newPath = t.history[newIndex];
                const meta = getPathMeta(getPathnameOnly(newPath));
                return { ...t, currentPath: newPath, navigationState: undefined, historyIndex: newIndex, label: meta.label, icon: meta.icon };
            }),
        }));
    }, []);

    /**
     * Navega el tab activo hacia un path.
     * Llamado desde Sidebar, CommandPalette, hotkeys — todos externos al tab.
     * No tiene navigationState (es navegación por sección, no por acción de formulario).
     */
    const openTab = useCallback((path) => {
        setState(prev => {
            if (prev.tabs.length === 0) {
                const t = makeTab(path);
                return { tabs: [t], activeTabId: t.id };
            }
            // Navegar en el tab activo
            return {
                ...prev,
                tabs: prev.tabs.map(t => {
                    if (t.id !== prev.activeTabId) return t;
                    const meta = getPathMeta(getPathnameOnly(path));
                    const newHistory = [...t.history.slice(0, t.historyIndex + 1), path];
                    return { ...t, currentPath: path, navigationState: undefined, history: newHistory, historyIndex: newHistory.length - 1, label: meta.label, icon: meta.icon };
                }),
            };
        });
    }, []);

    /**
     * Abre un path en una nueva pestaña.
     * Si ya existe una pestaña con ese path, la activa.
     */
    const openInNewTab = useCallback((path) => {
        setState(prev => {
            if (prev.tabs.length >= SOFT_TAB_LIMIT) {
                console.warn(`[Tabs] Límite suave de ${SOFT_TAB_LIMIT} pestañas alcanzado.`);
            }
            const newTab = makeTab(path);
            return { tabs: [...prev.tabs, newTab], activeTabId: newTab.id };
        });
    }, []);

    const closeTab = useCallback((tabId) => {
        setState(prev => {
            if (prev.tabs.length <= 1) return prev;
            const idx = prev.tabs.findIndex(t => t.id === tabId);
            if (idx === -1) return prev;
            const nextTabs = prev.tabs.filter(t => t.id !== tabId);
            const nextActiveId = prev.activeTabId === tabId
                ? nextTabs[Math.max(0, idx - 1)].id
                : prev.activeTabId;
            return { tabs: nextTabs, activeTabId: nextActiveId };
        });
    }, []);

    const activateTab = useCallback((tabId) => {
        setState(prev => ({ ...prev, activeTabId: tabId }));
    }, []);

    /**
     * Cierra todas las pestañas y reinicia a una única pestaña en /agenda.
     * Útil para el "Cerrar todas" del menú contextual de la TabBar.
     */
    const closeAllTabs = useCallback(() => {
        const defaultTab = makeTab('/agenda');
        setState({ tabs: [defaultTab], activeTabId: defaultTab.id });
    }, []);

    const updateTabLabel = useCallback((tabId, label) => {
        setState(prev => ({
            ...prev,
            tabs: prev.tabs.map(t => t.id !== tabId ? t : { ...t, label }),
        }));
    }, []);

    const activeTab = useMemo(
        () => tabs.find(t => t.id === activeTabId) ?? tabs[0],
        [tabs, activeTabId]
    );

    const value = useMemo(() => ({
        tabs,
        activeTabId,
        activeTab,
        openTab,
        openInNewTab,
        closeTab,
        closeAllTabs,
        activateTab,
        navigateInTab,
        goInTab,
        updateTabLabel,
        softTabLimit: SOFT_TAB_LIMIT,
    }), [tabs, activeTabId, activeTab, openTab, openInNewTab, closeTab, closeAllTabs, activateTab, navigateInTab, goInTab, updateTabLabel]);

    return (
        <TabsContext.Provider value={value}>
            {children}
        </TabsContext.Provider>
    );
};

export const useTabs = () => {
    const ctx = useContext(TabsContext);
    if (!ctx) throw new Error('useTabs debe usarse dentro de TabsProvider');
    return ctx;
};
