import { isRouteErrorResponse, useRouteError } from 'react-router-dom';
import { AlertTriangle } from 'lucide-react';
import { createLogger } from '../services/logService.js';

const logger = createLogger('route-error-fallback');

const RouteErrorFallback = () => {
    const routeError = useRouteError();

    if (routeError) {
        void logger.error('route error element rendered', {
            error: routeError instanceof Error ? {
                name: routeError.name,
                message: routeError.message,
                stack: routeError.stack,
            } : routeError,
        });
    }

    const detail = isRouteErrorResponse(routeError)
        ? `${routeError.status} ${routeError.statusText}`
        : (routeError instanceof Error ? routeError.message : 'Error inesperado');

    return (
        <section className="min-h-screen bg-(--bg-page) flex items-center justify-center px-6 py-10">
            <div className="w-full max-w-xl rounded-2xl border border-(--border-default) bg-(--bg-surface) p-8 text-center shadow-lg">
                <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
                    <AlertTriangle size={28} />
                </div>
                <h1 className="text-2xl font-semibold text-(--text-primary)">
                    Ha ocurrido un error
                </h1>
                <p className="mt-2 text-sm text-(--text-secondary)">
                    Esta aplicacion todavia esta en desarrollo.
                </p>
                <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">
                    {detail}
                </p>
                <button
                    type="button"
                    onClick={() => window.location.reload()}
                    className="mt-6 inline-flex items-center justify-center rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                >
                    Reintentar
                </button>
            </div>
        </section>
    );
};

export default RouteErrorFallback;
