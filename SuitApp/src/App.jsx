import { Suspense, lazy, useEffect } from 'react';
import { createBrowserRouter, createHashRouter, RouterProvider, createRoutesFromElements, Route, useNavigate, Outlet, Navigate } from 'react-router-dom';
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
const Login = lazy(() => import('./pages/Login.jsx'));

const Documents = lazy(() => import('./pages/Documents'));
const DocumentEditor = lazy(() => import('./pages/DocumentEditor'));
const Cases = lazy(() => import('./pages/Cases'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const People = lazy(() => import('./pages/People'));
const ClientDetail = lazy(() => import('./pages/ClientDetail'));
const Economia = lazy(() => import('./pages/Economia'));
const Categories = lazy(() => import('./pages/Categories'));
const TemplateGallery = lazy(() => import('./pages/TemplateGallery'));
const Agenda = lazy(() => import('./pages/Agenda'));
const AdminPanel = lazy(() => import('./pages/AdminPanel'));
const Settings = lazy(() => import('./pages/Settings'));
const Deadlines = lazy(() => import('./pages/Deadlines'));
const DeadlineDetail = lazy(() => import('./pages/DeadlineDetail'));
const Sections = lazy(() => import('./pages/Sections'));
const Reports = lazy(() => import('./pages/Reports'));

// Escucha eventos emitidos desde Electron main cuando el usuario hace click
// en una notificación nativa o en el resumen de recordatorios perdidos.
function NotificationRuntime() {
    const navigate = useNavigate();
    useEffect(() => {
        if (!window.electronAPI?.notifications) return;

        const unsubscribeEvent = window.electronAPI.notifications.onOpenEvent((payload) => {
            if (!payload?.eventId) return;
            navigate('/agenda', {
                state: {
                    highlightedEventId: payload.eventId,
                    notificationNonce: Date.now(),
                },
            });
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
    }, [navigate]);

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

const appRoutes = createRoutesFromElements(
    <Route element={<RootComponent />} errorElement={<RootRouteErrorElement />}>
        <Route path="/login" element={<Login />} />
        <Route element={<ProtectedRoute />}>
            <Route element={<MainLayout />}>
                <Route path="/" element={<Navigate to="/agenda" replace />} />
                <Route path="/reports" element={<Reports />} />
                <Route path="/agenda" element={<Agenda />} />
                <Route path="/documents" element={<Documents />} />
                <Route path="/documents/new" element={<DocumentEditor />} />
                <Route path="/documents/edit/:id?" element={<DocumentEditor />} />
                <Route path="/cases" element={<Cases />} />
                <Route path="/cases/:id" element={<CaseDetail />} />
                <Route path="/people" element={<People />} />
                <Route path="/people/:id" element={<ClientDetail />} />
                <Route path="/economia" element={<Economia />} />
                <Route path="/categorias" element={<Categories />} />
                <Route path="/deadlines" element={<Deadlines />} />
                <Route path="/deadlines/:id" element={<DeadlineDetail />} />
                <Route path="/templates" element={<TemplateGallery />} />
                <Route path="/admin" element={<AdminPanel />} />
                <Route path="/settings" element={<Settings />} />
                <Route path="/sections" element={<Sections />} />
            </Route>
        </Route>
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
