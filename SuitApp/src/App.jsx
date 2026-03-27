import { Suspense, lazy, useEffect } from 'react';
import { createBrowserRouter, createHashRouter, RouterProvider, createRoutesFromElements, Route, Outlet, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ApiProvider } from './context/ApiContext';
import { AppProviders } from './context/AppProviders';
import { ModalProvider } from './context/ModalContext.jsx';
import { ThemeProvider } from './context/ThemeContext';
import { BellRing, Loader2 } from 'lucide-react';
import ErrorBoundary from './components/ErrorBoundary';
import RouteErrorFallback from './components/RouteErrorFallback.jsx';
import ServerSetup from './components/ServerSetup';
import ServerUnavailableAlert from './components/ServerUnavailableAlert';
import ProtectedRoute from './components/ProtectedRoute';
import MainLayout from './layouts/MainLayout';
import { Toaster } from './components/ui/toaster';
import { showAppToast } from './components/ui/show-app-toast.jsx';
import { buildTriggeredNotificationDescription } from './utils/notifications/buildTriggeredNotificationDescription.js';
import GlobalHotkeysHandlers from './components/GlobalHotkeysHandlers.jsx';
import { useTabs } from './context/TabsContext.jsx';
const Login = lazy(() => import('./pages/Login.jsx'));

/**
 * NotificationRuntime — escucha eventos de notificaciones de Electron y los
 * redirige al sistema de tabs (en vez de navegar el router exterior).
 *
 * - Click en notificación nativa de evento → navega en la tab activa a /agenda
 * - Recordatorio disparado → muestra toast
 */
function NotificationRuntime() {
    const { openTab } = useTabs();

    useEffect(() => {
        if (!window.electronAPI?.notifications) return;

        const unsubscribeEvent = window.electronAPI.notifications.onOpenEvent((payload) => {
            if (!payload?.eventId) return;
            // Navegar en la tab activa hacia agenda con el evento destacado.
            // La navegación real ocurre dentro del MemoryRouter del tab activo,
            // pero el state de highlight se pasa via sessionStorage para cruzar el límite.
            try {
                sessionStorage.setItem(
                    'agenda_highlight',
                    JSON.stringify({ eventId: payload.eventId, nonce: Date.now() })
                );
            } catch { /* ignorar */ }
            openTab('/agenda');
        });

        const unsubscribeTriggered = window.electronAPI.notifications.onTriggered?.((payload) => {
            showAppToast({
                id: `event-reminder-${payload?.eventId ?? 'unknown'}-${payload?.notifyAt ?? Date.now()}`,
                title: payload?.title || 'Recordatorio de evento',
                description: buildTriggeredNotificationDescription(payload),
                variant: 'info',
                duration: 5000,
                position: 'top-center',
                icon: <BellRing size={14} />,
            });
        });

        return () => {
            unsubscribeEvent?.();
            unsubscribeTriggered?.();
        };
    }, [openTab]);

    return (
        <>
            <ServerSetup />
            <ServerUnavailableAlert />
            <Toaster />

            <Suspense fallback={
                <div className="min-h-screen flex items-center justify-center bg-(--bg-page)">
                    <div className="text-center">
                        <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto mb-3" />
                        <p className="text-gray-500 text-sm">Cargando...</p>
                    </div>
                </div>
            }>
                <Outlet />
            </Suspense>
        </>
    );
}

function RootComponent() {
    return (
        <ApiProvider>
            <AuthProvider>
                <AppProviders>
                    {/* ModalProvider va aquí para que los modales tengan acceso a todos los resource providers */}
                    <ModalProvider>
                        <GlobalHotkeysHandlers />
                        <NotificationRuntime />
                    </ModalProvider>
                </AppProviders>
            </AuthProvider>
        </ApiProvider>
    );
}

function RootRouteErrorElement() {
    return (
        <ApiProvider>
            <AuthProvider>
                <AppProviders>
                    <RouteErrorFallback />
                </AppProviders>
            </AuthProvider>
        </ApiProvider>
    );
}

/**
 * Router exterior simplificado.
 * Solo maneja /login y la shell protegida (MainLayout).
 * Toda la navegación interna entre secciones ocurre dentro de los
 * MemoryRouter individuales de cada pestaña (TabContent).
 */
const appRoutes = createRoutesFromElements(
    <Route element={<RootComponent />} errorElement={<RootRouteErrorElement />}>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
            <Route path="/*" element={<MainLayout />} />
        </Route>
        <Route path="/" element={<Navigate to="/agenda" replace />} />
    </Route>
);

const router = window.location.protocol === 'file:'
    ? createHashRouter(appRoutes)
    : createBrowserRouter(appRoutes);

function App() {
    return (
        <ErrorBoundary>
            <ThemeProvider>
                <RouterProvider router={router} />
            </ThemeProvider>
        </ErrorBoundary>
    );
}

export default App;
