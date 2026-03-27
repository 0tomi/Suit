import { Suspense, createContext, useContext, useCallback, useMemo } from 'react';
import {
    Routes, Route, Navigate,
    UNSAFE_NavigationContext,
    UNSAFE_LocationContext,
} from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useTabs } from '../../context/TabsContext';
import { TAB_INTERNAL_ROUTES } from '../../constants/tabRoutes.jsx';

function parseFullPath(fullPath) {
    const hashIdx = fullPath.indexOf('#');
    const pathAndSearch = hashIdx === -1 ? fullPath : fullPath.slice(0, hashIdx);
    const hash = hashIdx === -1 ? '' : fullPath.slice(hashIdx);
    const qIdx = pathAndSearch.indexOf('?');

    return {
        pathname: qIdx === -1 ? pathAndSearch : pathAndSearch.slice(0, qIdx),
        search: qIdx === -1 ? '' : pathAndSearch.slice(qIdx),
        hash,
    };
}

// ---------------------------------------------------------------------------
// Context interno: expone el tabId a hooks que lo necesiten (ej: usePageFocus)
// ---------------------------------------------------------------------------
const TabIdContext = createContext(null);
export const useTabId = () => useContext(TabIdContext);

// ---------------------------------------------------------------------------
// TabRouterProvider
//
// Provee los contextos internos de React Router (NavigationContext +
// LocationContext) con valores específicos del tab, sin usar ningún componente
// <Router> anidado. Esto evita el error de React Router v7 que prohíbe
// routers anidados, mientras mantiene useNavigate / useLocation / useParams
// funcionando correctamente en todas las páginas del tab.
// ---------------------------------------------------------------------------
function TabRouterProvider({ tab, onNavigate, onGoBack, children }) {
    const location = useMemo(() => ({
        ...parseFullPath(tab.currentPath),
        // navigationState se pierde entre sesiones intencionalmente (no se persiste)
        state: tab.navigationState,
        // historyIndex como key garantiza un id único por navegación, incluso al reusar el mismo path
        key: `${tab.id}-${tab.historyIndex}`,
    }), [tab]);

    // Helper para construir el path completo (pathname + search) desde un argumento To de React Router.
    // React Router siempre pasa un objeto { pathname, search, hash } al navigator.
    const resolveFullPath = (to) => {
        if (typeof to === 'string') {
            // Permite navegaciones relativas de search/hash sin perder el pathname actual.
            if (to.startsWith('?') || to.startsWith('#')) {
                return `${location.pathname}${to}`;
            }
            return to;
        }
        const pathname = to.pathname ?? location.pathname;
        const search   = to.search ?? '';
        const hash     = to.hash ?? '';
        return `${pathname}${search}${hash}`;
    };

    // Navigator: implementa el contrato que useNavigate() espera internamente.
    // push(to, state) y replace(to, state) reciben state como segundo argumento.
    const navigator = useMemo(() => ({
        createHref: (to) => resolveFullPath(to),
        encodeLocation: (to) => parseFullPath(resolveFullPath(to)),
        push: (to, state) => {
            onNavigate(resolveFullPath(to), 'push', state);
        },
        replace: (to, state) => {
            onNavigate(resolveFullPath(to), 'replace', state);
        },
        go: (delta) => onGoBack(delta),
    }), [location.pathname, onNavigate, onGoBack]);

    const navCtx = useMemo(() => ({
        basename: '/',
        navigator,
        static: false,
        future: {},
    }), [navigator]);

    const locCtx = useMemo(() => ({
        location,
        navigationType: 'PUSH',
    }), [location]);

    return (
        <UNSAFE_NavigationContext.Provider value={navCtx}>
            <UNSAFE_LocationContext.Provider value={locCtx}>
                {children}
            </UNSAFE_LocationContext.Provider>
        </UNSAFE_NavigationContext.Provider>
    );
}

// ---------------------------------------------------------------------------
// Fallback de carga para componentes lazy
// ---------------------------------------------------------------------------
function TabSuspenseFallback() {
    return (
        <div className="flex-1 flex items-center justify-center h-full">
            <div className="text-center">
                <Loader2 className="w-7 h-7 animate-spin text-blue-500 mx-auto mb-2" />
                <p className="text-sm text-(--text-secondary)">Cargando...</p>
            </div>
        </div>
    );
}

// ---------------------------------------------------------------------------
// TabContent — tab individual sin Router anidado
// ---------------------------------------------------------------------------

/**
 * Renderiza el contenido de una pestaña proveyendo su propio contexto de
 * navegación y location. No usa <MemoryRouter> para evitar el error de
 * React Router v7 con routers anidados.
 *
 * display:none mantiene el tab montado sin espacio visual (keep-alive).
 */
export function TabContent({ tab, isActive }) {
    const { navigateInTab, goInTab } = useTabs();

    const handleNavigate = useCallback((path, type, state) => {
        navigateInTab(tab.id, path, type, state);
    }, [tab.id, navigateInTab]);

    const handleGoBack = useCallback((delta) => {
        goInTab(tab.id, delta);
    }, [tab.id, goInTab]);

    return (
        <div
            className="flex-1 min-h-0 w-full h-full"
            style={{ display: isActive ? 'flex' : 'none', flexDirection: 'column' }}
            aria-hidden={!isActive}
        >
            <TabIdContext.Provider value={tab.id}>
                <TabRouterProvider
                    tab={tab}
                    onNavigate={handleNavigate}
                    onGoBack={handleGoBack}
                >
                    <Suspense fallback={<TabSuspenseFallback />}>
                        <Routes>
                            <Route path="/" element={<Navigate to="/agenda" replace />} />
                            {TAB_INTERNAL_ROUTES.map(({ path, component: Component }) => (
                                <Route key={path} path={path} element={<Component />} />
                            ))}
                            <Route path="*" element={<Navigate to="/agenda" replace />} />
                        </Routes>
                    </Suspense>
                </TabRouterProvider>
            </TabIdContext.Provider>
        </div>
    );
}
